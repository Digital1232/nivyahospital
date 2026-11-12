// Reception panel API. One endpoint, POST { action, ...fields }.
// Every action except "login" needs a signed-in staff session.
const crypto = require('crypto');
const { CATALOG } = require('./_lib/razorpay');
const { q, one, configured } = require('./_lib/db');
const auth = require('./_lib/auth');
const S = require('./_lib/schedule');
const catalog = require('./_lib/catalog');

const DOCTORS = Object.keys(CATALOG.doctors);
const STATUSES = ['booked', 'confirmed', 'arrived', 'in_consult', 'completed', 'cancelled', 'no_show'];

class Bad extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const need = (ok, msg) => { if (!ok) throw new Bad(msg); };
const doctorOf = (d) => { need(DOCTORS.includes(d), 'Unknown doctor.'); return d; };
const dateOf = (d) => { need(S.isIso(d), 'Invalid date.'); return d; };
const newId = (prefix) => {
	const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	return prefix + '-' + Array.from(crypto.randomBytes(8), (x) => A[x % A.length]).join('');
};

const audit = (user, action, apptId, detail) =>
	q(`INSERT INTO audit_log (actor, action, appointment_id, detail) VALUES ($1, $2, $3, $4)`,
		[user.u, action, apptId || null, JSON.stringify(detail || {})]);

const APPT_SELECT = `SELECT a.*, p.name, p.phone, p.age, p.gender, p.email
	FROM appointments a LEFT JOIN patients p ON p.id = a.patient_id`;

const patientFrom = async (b) => {
	const name = clean(b.name, 80);
	const phone = clean(b.phone, 10);
	need(name.length >= 2, 'Enter the patient name.');
	need(/^[6-9]\d{9}$/.test(phone), 'Enter a valid 10-digit mobile number.');
	const age = b.age === '' || b.age == null ? null : Number(b.age);
	need(age === null || (Number.isInteger(age) && age >= 0 && age <= 120), 'Enter a valid age.');
	const gender = clean(b.gender, 10) || null;
	need(!gender || ['Female', 'Male', 'Other'].includes(gender), 'Invalid gender.');
	const row = await one(
		`INSERT INTO patients (name, name_key, phone, email, age, gender) VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (phone, name_key) DO UPDATE SET
			name = EXCLUDED.name,
			email = COALESCE(EXCLUDED.email, patients.email),
			age = COALESCE(EXCLUDED.age, patients.age),
			gender = COALESCE(EXCLUDED.gender, patients.gender)
		 RETURNING id`,
		[name, name.toLowerCase(), phone, clean(b.email, 120) || null, age, gender]);
	return row.id;
};

// Next token for this doctor today and the appointment update, in one statement.
const TOKEN_CTE = `WITH t AS (
	INSERT INTO token_counters (date, doctor, last) VALUES ($1, $2, 1)
	ON CONFLICT (date, doctor) DO UPDATE SET last = token_counters.last + 1
	RETURNING last)`;

// Hospital details and WhatsApp message templates, editable by an admin in Settings.
// Placeholders: {name} {doctor} {when} {id} {token} {reason} {phone} {address}
const PANEL_DEFAULTS = {
	hospitalPhone: '+91 95664 43300',
	address: '110-F/5 Barani Nagar, Vannarpettai, Tirunelveli',
	templates: {
		confirm: 'Hello {name}, your appointment with {doctor} at Nivya Hospitals is confirmed for {when}. Booking ID: {id}. Please show this at the reception. For help call {phone}.',
		reminder: 'Hello {name}, a reminder of your appointment with {doctor} at Nivya Hospitals on {when}. Booking ID: {id}. Address: {address}.',
		reschedule: 'Hello {name}, your appointment with {doctor} at Nivya Hospitals has been rescheduled to {when}. Booking ID: {id}. For help call {phone}.',
		cancel: 'Hello {name}, your appointment with {doctor} on {when} at Nivya Hospitals has been cancelled{reason}. Please call {phone} to book again.',
		token: 'Hello {name}, your token number for {doctor} today at Nivya Hospitals is {token}. Please wait for your turn.'
	}
};
const TEMPLATE_KEYS = Object.keys(PANEL_DEFAULTS.templates);
const panelSettings = async () => {
	const row = await one(`SELECT value FROM settings WHERE key = 'panel'`);
	const v = (row && row.value) || {};
	return {
		hospitalPhone: v.hospitalPhone || PANEL_DEFAULTS.hospitalPhone,
		address: v.address || PANEL_DEFAULTS.address,
		templates: Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, (v.templates && v.templates[k]) || PANEL_DEFAULTS.templates[k]]))
	};
};

const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

const actions = {
	async me(b, user) {
		return {
			user: { username: user.u, name: user.name, role: user.role },
			doctors: DOCTORS.map((d) => ({ name: d, speciality: CATALOG.doctors[d].speciality })),
			today: S.todayIso(),
			settings: await panelSettings()
		};
	},

	async dashboard(b) {
		const date = b.date ? dateOf(b.date) : S.todayIso();
		const rows = await q(`SELECT doctor, source, status, token_no FROM appointments WHERE date = $1`, [date]);
		const count = (f) => rows.filter(f).length;
		const live = (r) => !['cancelled', 'no_show'].includes(r.status);
		const perDoctor = DOCTORS.map((d) => {
			const mine = rows.filter((r) => r.doctor === d);
			const waiting = mine.filter((r) => r.status === 'arrived').map((r) => r.token_no).sort((x, y) => x - y);
			const inConsult = mine.filter((r) => r.status === 'in_consult').map((r) => r.token_no);
			return {
				doctor: d,
				expected: mine.filter((r) => ['booked', 'confirmed'].includes(r.status)).length,
				waiting: waiting.length,
				next: waiting[0] || null,
				current: inConsult[0] || null,
				completed: mine.filter((r) => r.status === 'completed').length
			};
		});
		const leave = await q(`SELECT doctor, reason FROM doctor_leave WHERE date = $1`, [date]);
		const tomorrow = new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
		// Patients booked for today who have not checked in yet, in time order.
		const expectedList = await q(`${APPT_SELECT} WHERE a.date = $1 AND a.status IN ('booked', 'confirmed')
			ORDER BY a.time_min NULLS LAST, a.id LIMIT 50`, [date]);
		const tomorrowRows = await q(`SELECT doctor, status, count(*)::int AS n FROM appointments
			WHERE date = $1 AND status IN ('booked', 'confirmed') GROUP BY doctor, status`, [tomorrow]);
		const upcomingLeave = await q(`SELECT id, doctor, date, reason FROM doctor_leave WHERE date > $1 AND date <= $2 ORDER BY date, doctor LIMIT 20`,
			[date, new Date(Date.parse(date + 'T00:00:00Z') + 30 * 86400000).toISOString().slice(0, 10)]);
		return {
			expectedList,
			tomorrow: {
				date: tomorrow,
				perDoctor: DOCTORS.map((d) => ({
					doctor: d,
					booked: tomorrowRows.filter((r) => r.doctor === d).reduce((s, r) => s + r.n, 0),
					unconfirmed: tomorrowRows.filter((r) => r.doctor === d && r.status === 'booked').reduce((s, r) => s + r.n, 0)
				})),
				leave: (await q(`SELECT doctor FROM doctor_leave WHERE date = $1`, [tomorrow])).map((r) => r.doctor)
			},
			upcomingLeave,
			date,
			totals: {
				online: count((r) => r.source === 'online' && live(r)),
				walkin: count((r) => r.source === 'walkin' && live(r)),
				expected: count((r) => ['booked', 'confirmed'].includes(r.status)),
				waiting: count((r) => r.status === 'arrived'),
				inConsult: count((r) => r.status === 'in_consult'),
				completed: count((r) => r.status === 'completed'),
				cancelled: count((r) => r.status === 'cancelled'),
				noShow: count((r) => r.status === 'no_show')
			},
			perDoctor,
			leave
		};
	},

	async appointments(b) {
		const where = [];
		const params = [];
		const add = (sql, v) => { params.push(v); where.push(sql.replace('?', '$' + params.length)); };
		if (b.date) add('a.date = ?', dateOf(b.date));
		if (b.from) add('a.date >= ?', dateOf(b.from));
		if (b.to) add('a.date <= ?', dateOf(b.to));
		if (b.doctor) add('a.doctor = ?', doctorOf(b.doctor));
		if (b.patient_id) add('a.patient_id = ?', Number(b.patient_id));
		if (b.source) { need(['online', 'walkin'].includes(b.source), 'Invalid source.'); add('a.source = ?', b.source); }
		if (b.status) { need(STATUSES.includes(b.status), 'Invalid status.'); add('a.status = ?', b.status); }
		const term = clean(b.search, 60);
		if (term) {
			params.push('%' + term.toLowerCase() + '%');
			const n = '$' + params.length;
			where.push(`(lower(p.name) LIKE ${n} OR p.phone LIKE ${n} OR lower(a.booking_id) LIKE ${n})`);
		}
		// Exports may ask for more rows than the on-screen list.
		const limit = b.export ? 5000 : 300;
		const rows = await q(`${APPT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
			ORDER BY a.date DESC, a.token_no NULLS LAST, a.time_min NULLS LAST, a.id DESC LIMIT ${limit}`, params);
		return { appointments: rows, limit };
	},

	async update(b, user) {
		const id = Number(b.id);
		need(Number.isInteger(id), 'Invalid appointment.');
		const a = await one(`SELECT * FROM appointments WHERE id = $1`, [id]);
		need(a, 'Appointment not found.');
		const op = String(b.op || '');
		const from = (...st) => need(st.includes(a.status), 'This action is not allowed for a ' + a.status.replace('_', ' ') + ' appointment.');
		const set = async (fields, extraWhere = '') => {
			const keys = Object.keys(fields);
			const vals = keys.map((k) => fields[k]);
			const sql = `UPDATE appointments SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now()
				WHERE id = $1 ${extraWhere} RETURNING id`;
			const r = await q(sql, [id, ...vals]);
			need(r.length, 'The appointment changed meanwhile. Please refresh.');
		};
		switch (op) {
			case 'confirm': from('booked'); await set({ status: 'confirmed' }, `AND status = 'booked'`); break;
			case 'cancel': from('booked', 'confirmed', 'arrived'); await set({ status: 'cancelled', notes: clean(b.reason, 200) || a.notes }); break;
			case 'no_show': from('booked', 'confirmed', 'arrived'); await set({ status: 'no_show' }); break;
			case 'start': from('arrived'); await set({ status: 'in_consult', started_at: new Date().toISOString() }, `AND status = 'arrived'`); break;
			case 'requeue': from('in_consult'); await set({ status: 'arrived', started_at: null }); break;
			case 'complete': from('arrived', 'in_consult'); await set({ status: 'completed', completed_at: new Date().toISOString() }); break;
			case 'arrive': {
				from('booked', 'confirmed');
				need(a.date === S.todayIso(), 'Patients can check in only on the appointment day.');
				const r = await q(`${TOKEN_CTE}
					UPDATE appointments SET status = 'arrived', token_no = (SELECT last FROM t), arrived_at = now(), updated_at = now()
					WHERE id = $3 AND status IN ('booked', 'confirmed') RETURNING token_no`, [a.date, a.doctor, id]);
				need(r.length, 'The appointment changed meanwhile. Please refresh.');
				break;
			}
			case 'reschedule': {
				from('booked', 'confirmed');
				const date = dateOf(b.date);
				const min = S.toMin(b.time);
				need(min != null, 'Invalid time.');
				need(date >= S.todayIso(), 'Pick today or a later date.');
				need(!(await S.onLeave(a.doctor, date)), 'The doctor is on leave that day.');
				await set({ date, time: S.toTime(min), time_min: min });
				break;
			}
			case 'note': await set({ notes: clean(b.notes, 300) }); break;
			default: throw new Bad('Unknown action.');
		}
		await audit(user, op, id, op === 'reschedule' ? { from: a.date + ' ' + a.time, to: b.date + ' ' + b.time } : { from: a.status });
		return { appointment: await one(`${APPT_SELECT} WHERE a.id = $1`, [id]) };
	},

	async walkin(b, user) {
		const doctor = doctorOf(b.doctor);
		const patientId = await patientFrom(b);
		const date = S.todayIso();
		const min = S.nowMin();
		const type = b.visit_type === 'old' ? 'old' : 'new';
		const row = await one(`${TOKEN_CTE}
			INSERT INTO appointments (booking_id, source, patient_id, doctor, date, time, time_min, visit_type, reason, status, token_no, arrived_at, created_by)
			VALUES ($3, 'walkin', $4, $2, $1, $5, $6, $7, $8, 'arrived', (SELECT last FROM t), now(), $9)
			RETURNING id`,
			[date, doctor, newId('WLK'), patientId, S.toTime(min), min, type, clean(b.reason, 200) || null, user.u]);
		await audit(user, 'walkin', row.id, { doctor });
		return { appointment: await one(`${APPT_SELECT} WHERE a.id = $1`, [row.id]) };
	},

	async patients(b) {
		const phone = clean(b.phone, 10).replace(/\D/g, '');
		need(phone.length >= 4, 'Type at least 4 digits of the phone number.');
		const rows = await q(`SELECT p.*, (SELECT max(date) FROM appointments a WHERE a.patient_id = p.id) AS last_visit,
				(SELECT count(*)::int FROM appointments a WHERE a.patient_id = p.id AND a.status = 'completed') AS visits
			FROM patients p WHERE p.phone LIKE $1 ORDER BY p.name LIMIT 20`, [phone + '%']);
		return { patients: rows };
	},

	async queue(b) {
		const date = b.date ? dateOf(b.date) : S.todayIso();
		const rows = await q(`${APPT_SELECT} WHERE a.date = $1 AND a.status IN ('arrived', 'in_consult', 'completed', 'no_show') AND a.token_no IS NOT NULL
			ORDER BY a.doctor, a.token_no`, [date]);
		return { date, queue: rows };
	},

	async schedule() {
		const out = [];
		for (const d of DOCTORS) {
			const s = await S.getSchedule(d);
			const leave = await q(`SELECT l.id, l.date, l.reason,
					(SELECT count(*)::int FROM appointments a WHERE a.doctor = l.doctor AND a.date = l.date AND a.status IN ('booked', 'confirmed')) AS affected
				FROM doctor_leave l WHERE l.doctor = $1 AND l.date >= $2 ORDER BY l.date`, [d, S.todayIso()]);
			out.push({ doctor: d, days: s.days, start_min: s.start_min, end_min: s.end_min, capacity: s.capacity, online: s.online, note: s.note || '', leave });
		}
		return { schedule: out };
	},

	async saveSchedule(b, user) {
		const doctor = doctorOf(b.doctor);
		const days = [...new Set((Array.isArray(b.days) ? b.days : []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
		const start = Number(b.start_min), end = Number(b.end_min);
		need([start, end].every((m) => Number.isInteger(m) && m >= 0 && m <= 1440 && m % 15 === 0), 'Invalid OP timing.');
		need(start < end, 'OP end time must be after the start time.');
		const cap = b.capacity === '' || b.capacity == null ? null : Number(b.capacity);
		need(cap === null || (Number.isInteger(cap) && cap >= 1 && cap <= 200), 'Capacity must be a number from 1 to 200, or empty for no limit.');
		await q(`INSERT INTO doctor_schedule (doctor, days, start_min, end_min, capacity, online, note) VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (doctor) DO UPDATE SET days = $2, start_min = $3, end_min = $4, capacity = $5, online = $6, note = $7`,
			[doctor, days, start, end, cap, b.online !== false, clean(b.note, 200)]);
		await audit(user, 'schedule', null, { doctor, days, start, end, cap, online: b.online !== false });
		return actions.schedule();
	},

	async addLeave(b, user) {
		const doctor = doctorOf(b.doctor);
		const date = dateOf(b.date);
		need(date >= S.todayIso(), 'Pick today or a later date.');
		await q(`INSERT INTO doctor_leave (doctor, date, reason) VALUES ($1, $2, $3) ON CONFLICT (doctor, date) DO UPDATE SET reason = $3`,
			[doctor, date, clean(b.reason, 120) || null]);
		await audit(user, 'leave_add', null, { doctor, date });
		return actions.schedule();
	},

	async removeLeave(b, user) {
		const r = await q(`DELETE FROM doctor_leave WHERE id = $1 RETURNING doctor, date`, [Number(b.id)]);
		if (r.length) await audit(user, 'leave_remove', null, r[0]);
		return actions.schedule();
	},

	/* ---------- Booking settings (fees, booking type, slots, services) ---------- */
	async booking() {
		const merged = await catalog.getCatalog();
		const overrides = await catalog.getOverrides();
		const out = [];
		for (const name of DOCTORS) {
			const d = merged.doctors[name];
			const s = await S.getSchedule(name);
			out.push({
				doctor: name,
				speciality: d.speciality,
				bookingMode: d.bookingMode === 'request' ? 'request' : 'online',
				feeStatus: d.feeStatus === 'pending' ? 'pending' : 'set',
				fees: d.fees || { new: null, old: null },
				opHours: d.opHours || '',
				bookingSessions: d.bookingSessions || [],
				addons: d.addons || [],
				customised: Object.prototype.hasOwnProperty.call(overrides, name),
				schedule: { start_min: s.start_min, end_min: s.end_min, online: s.online }
			});
		}
		return { booking: out };
	},

	async saveBooking(b, user) {
		need(user.role === 'admin', 'Only an admin can change fees and booking settings.');
		const doctor = doctorOf(b.doctor);
		const overrides = await catalog.getOverrides();
		if (b.reset) {
			delete overrides[doctor];
		} else {
			const mode = b.bookingMode === 'request' ? 'request' : 'online';
			const pending = b.feeStatus === 'pending';
			const fee = (v, label) => {
				if (v === '' || v == null) return null;
				const n = Number(v);
				need(Number.isInteger(n) && n >= 0 && n <= 100000, label + ' must be a whole number of rupees.');
				return n;
			};
			const fees = { new: fee(b.fees && b.fees.new, 'New patient fee'), old: fee(b.fees && b.fees.old, 'Follow-up fee') };
			if (mode === 'online' && !pending) need(fees.new > 0 && fees.old > 0, 'Enter both fees, or choose "Fee to be confirmed".');
			const sessions = (Array.isArray(b.bookingSessions) ? b.bookingSessions : []).slice(0, 4).map((x) => {
				const slots = [...new Set((Array.isArray(x.slots) ? x.slots : []).map((t) => {
					const m = S.toMin(clean(t, 10).toUpperCase());
					need(m != null, 'Invalid time "' + clean(t, 10) + '". Use a format like 10:30 AM.');
					return m;
				}))].sort((p, q2) => p - q2).slice(0, 24).map(S.toTime);
				return { name: clean(x.name, 20) || 'Session', slots };
			}).filter((x) => x.slots.length);
			const ids = new Set();
			const addons = (Array.isArray(b.addons) ? b.addons : []).slice(0, 10).map((a) => {
				const name = clean(a.name, 60);
				need(name.length >= 2, 'Enter a name for each paid service.');
				const price = Number(a.price);
				need(Number.isInteger(price) && price >= 1 && price <= 100000, 'Price for "' + name + '" must be a whole number of rupees.');
				let id = clean(a.id, 40).replace(/[^a-z0-9-]/g, '') || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'service';
				while (ids.has(id)) id += '-2';
				ids.add(id);
				return { id, name, price };
			});
			overrides[doctor] = {
				bookingMode: mode, feeStatus: pending ? 'pending' : 'set', fees,
				opHours: clean(b.opHours, 120), bookingSessions: sessions, addons
			};
		}
		await catalog.saveOverrides(overrides);
		await audit(user, b.reset ? 'booking_reset' : 'booking_save', null, { doctor });
		return actions.booking();
	},

	/* ---------- Patients ---------- */
	async patientSearch(b) {
		const term = clean(b.search, 60).toLowerCase();
		const params = [];
		let where = '';
		if (term) {
			const digits = term.replace(/\D/g, '');
			params.push('%' + term + '%');
			where = `WHERE lower(p.name) LIKE $1`;
			if (digits.length >= 3) { params.push(digits + '%'); where += ` OR p.phone LIKE $2`; }
		}
		const rows = await q(`SELECT p.id, p.name, p.phone, p.age, p.gender, p.email,
				(SELECT max(a.date) FROM appointments a WHERE a.patient_id = p.id) AS last_visit,
				(SELECT count(*)::int FROM appointments a WHERE a.patient_id = p.id AND a.status = 'completed') AS visits,
				(SELECT count(*)::int FROM appointments a WHERE a.patient_id = p.id) AS bookings
			FROM patients p ${where} ORDER BY last_visit DESC NULLS LAST, p.id DESC LIMIT 100`, params);
		return { patients: rows };
	},

	async patient(b) {
		const id = Number(b.id);
		need(Number.isInteger(id), 'Invalid patient.');
		const p = await one(`SELECT * FROM patients WHERE id = $1`, [id]);
		need(p, 'Patient not found.');
		const visits = await q(`${APPT_SELECT} WHERE a.patient_id = $1 ORDER BY a.date DESC, a.id DESC LIMIT 200`, [id]);
		return { patient: p, visits };
	},

	async savePatient(b, user) {
		const id = Number(b.id);
		need(Number.isInteger(id), 'Invalid patient.');
		const name = clean(b.name, 80);
		need(name.length >= 2, 'Enter the patient name.');
		const phone = clean(b.phone, 10);
		need(/^[6-9]\d{9}$/.test(phone), 'Enter a valid 10-digit mobile number.');
		const age = b.age === '' || b.age == null ? null : Number(b.age);
		need(age === null || (Number.isInteger(age) && age >= 0 && age <= 120), 'Enter a valid age.');
		const gender = clean(b.gender, 10) || null;
		need(!gender || ['Female', 'Male', 'Other'].includes(gender), 'Invalid gender.');
		const email = clean(b.email, 120) || null;
		need(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email or leave it empty.');
		const clash = await one(`SELECT id FROM patients WHERE phone = $1 AND name_key = $2 AND id <> $3`, [phone, name.toLowerCase(), id]);
		need(!clash, 'Another patient with this name and phone number already exists.');
		const r = await q(`UPDATE patients SET name = $2, name_key = $3, phone = $4, age = $5, gender = $6, email = $7, notes = $8 WHERE id = $1 RETURNING id`,
			[id, name, name.toLowerCase(), phone, age, gender, email, clean(b.notes, 1000) || null]);
		need(r.length, 'Patient not found.');
		await audit(user, 'patient_edit', null, { patient: id });
		return actions.patient({ id });
	},

	/* ---------- Reports ---------- */
	async reports(b) {
		const from = dateOf(b.from);
		const to = dateOf(b.to);
		need(from <= to, 'The start date must be before the end date.');
		need(daysBetween(from, to) <= 366, 'Pick a range of one year or less.');
		const rows = await q(`SELECT a.date, a.doctor, a.source, a.status, a.visit_type, a.amount_paise, a.payment_id,
				a.arrived_at, a.started_at, a.completed_at
			FROM appointments a WHERE a.date BETWEEN $1 AND $2`, [from, to]);
		const blank = () => ({ total: 0, online: 0, walkin: 0, completed: 0, cancelled: 0, noShow: 0, newPatients: 0, followUps: 0, paidPaise: 0 });
		const tally = (t, r) => {
			t.total++;
			t[r.source === 'online' ? 'online' : 'walkin']++;
			if (r.status === 'completed') t.completed++;
			if (r.status === 'cancelled') t.cancelled++;
			if (r.status === 'no_show') t.noShow++;
			if (r.visit_type === 'old') t.followUps++; else t.newPatients++;
			if (r.source === 'online' && r.payment_id) t.paidPaise += Number(r.amount_paise) || 0;
		};
		const totals = blank();
		const byDoctor = Object.fromEntries(DOCTORS.map((d) => [d, blank()]));
		const byDay = {};
		const waits = [];
		for (const r of rows) {
			tally(totals, r);
			if (byDoctor[r.doctor]) tally(byDoctor[r.doctor], r);
			tally(byDay[r.date] = byDay[r.date] || blank(), r);
			if (r.arrived_at && r.started_at) {
				const m = (new Date(r.started_at) - new Date(r.arrived_at)) / 60000;
				if (m >= 0 && m < 600) waits.push(m);
			}
		}
		const newRegs = await one(`SELECT count(*)::int AS n FROM patients WHERE (created_at + interval '330 minutes')::date BETWEEN $1::date AND $2::date`, [from, to]);
		return {
			from, to, totals,
			avgWaitMin: waits.length ? Math.round(waits.reduce((s, x) => s + x, 0) / waits.length) : null,
			newRegistrations: newRegs.n,
			byDoctor: DOCTORS.map((d) => ({ doctor: d, ...byDoctor[d] })),
			byDay: Object.keys(byDay).sort().map((d) => ({ date: d, ...byDay[d] }))
		};
	},

	/* ---------- Settings ---------- */
	async saveSettings(b, user) {
		need(user.role === 'admin', 'Only an admin can change settings.');
		const phone = clean(b.hospitalPhone, 30);
		need(phone.replace(/\D/g, '').length >= 10, 'Enter the hospital phone number.');
		const address = clean(b.address, 200);
		need(address.length >= 5, 'Enter the hospital address.');
		const templates = {};
		for (const k of TEMPLATE_KEYS) {
			const t = String((b.templates && b.templates[k]) || '').trim().slice(0, 600);
			need(t.length >= 10, 'Message templates cannot be empty.');
			templates[k] = t;
		}
		await q(`INSERT INTO settings (key, value) VALUES ('panel', $1) ON CONFLICT (key) DO UPDATE SET value = $1`,
			[JSON.stringify({ hospitalPhone: phone, address, templates })]);
		await audit(user, 'settings', null, {});
		return { settings: await panelSettings() };
	},

	async resetSettings(b, user) {
		need(user.role === 'admin', 'Only an admin can change settings.');
		await q(`DELETE FROM settings WHERE key = 'panel'`);
		await audit(user, 'settings_reset', null, {});
		return { settings: await panelSettings() };
	},

	async changePassword(b, user) {
		need(user.u !== 'admin', 'The admin password is set in Vercel (RECEPTION_ADMIN_PASSWORD).');
		const row = await one(`SELECT pass_hash FROM staff WHERE username = $1 AND active`, [user.u]);
		need(row && auth.checkPassword(b.current, row.pass_hash), 'Your current password is wrong.');
		need(String(b.password || '').length >= 8, 'The new password must be at least 8 characters.');
		await q(`UPDATE staff SET pass_hash = $2, token_version = token_version + 1 WHERE username = $1`, [user.u, auth.hashPassword(b.password)]);
		await audit(user, 'password_change', null, {});
		return { ok: true, relogin: true };
	},

	async staff(b, user) {
		need(user.role === 'admin', 'Only an admin can manage staff.');
		return { staff: await q(`SELECT id, username, name, role, active, created_at FROM staff ORDER BY active DESC, name`) };
	},

	async saveStaff(b, user) {
		need(user.role === 'admin', 'Only an admin can manage staff.');
		const username = clean(b.username, 30).toLowerCase();
		need(/^[a-z0-9._-]{3,30}$/.test(username) && username !== 'admin', 'Username: 3-30 letters, numbers, dot, dash or underscore (not "admin").');
		const role = b.role === 'admin' ? 'admin' : 'staff';
		const name = clean(b.name, 60);
		const existing = await one(`SELECT id FROM staff WHERE username = $1`, [username]);
		if (!existing) {
			need(name.length >= 2, 'Enter the staff member\'s name.');
			need(String(b.password || '').length >= 8, 'Password must be at least 8 characters.');
			await q(`INSERT INTO staff (username, name, role, pass_hash) VALUES ($1, $2, $3, $4)`, [username, name, role, auth.hashPassword(b.password)]);
		} else {
			const fields = ['role = $2', 'active = $3', 'name = COALESCE(NULLIF($4, \'\'), name)'];
			const params = [username, role, b.active !== false, name];
			if (b.password) {
				need(String(b.password).length >= 8, 'Password must be at least 8 characters.');
				params.push(auth.hashPassword(b.password));
				fields.push('pass_hash = $' + params.length);
			}
			// Any change signs the person out, so a removed role or password takes effect at once.
			await q(`UPDATE staff SET ${fields.join(', ')}, token_version = token_version + 1 WHERE username = $1`, params);
		}
		await audit(user, existing ? 'staff_update' : 'staff_add', null, { username, role, active: b.active !== false });
		return actions.staff(b, user);
	}
};

module.exports = async (req, res) => {
	res.setHeader('Cache-Control', 'no-store');
	res.setHeader('X-Robots-Tag', 'noindex');
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
	// Only our own page sends this header; browsers block it from other sites.
	if (req.headers['x-nivya'] !== '1') return res.status(403).json({ error: 'Forbidden.' });
	if (!configured()) return res.status(503).json({ error: 'Database is not connected yet. Connect a Neon database in Vercel (Storage tab), then redeploy.', setup: 'database' });

	let b = req.body;
	if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
	b = b && typeof b === 'object' ? b : {};

	try {
		if (b.action === 'login') {
			const r = await auth.login(b.username, b.password);
			if (r.error) return res.status(r.status).json({ error: r.error });
			await auth.startSession(res, r.user);
			return res.status(200).json(await actions.me(b, r.user));
		}
		if (b.action === 'logout') { auth.endSession(res); return res.status(200).json({ ok: true }); }
		const user = await auth.currentUser(req);
		if (!user) return res.status(401).json({ error: 'Please sign in.' });
		const fn = Object.prototype.hasOwnProperty.call(actions, b.action) ? actions[b.action] : null;
		if (!fn) return res.status(400).json({ error: 'Unknown action.' });
		return res.status(200).json(await fn(b, user));
	} catch (err) {
		if (err instanceof Bad) return res.status(err.status).json({ error: err.message });
		console.error('reception failed:', b.action, err.message);
		return res.status(500).json({ error: 'Something went wrong. Please try again.' });
	}
};
