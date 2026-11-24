// Doctor OP timings, leave and online-slot capacity, shared by the booking API,
// the public availability endpoint and the reception panel.
const { q, one, withSlot } = require('./db');

const DEFAULT = { days: [1, 2, 3, 4, 5, 6], start_min: 540, end_min: 1140, capacity: null, online: true, note: '' };

// Hospital time is IST (UTC+5:30), whatever timezone the server runs in.
const istNow = () => new Date(Date.now() + 330 * 60 * 1000);
const todayIso = () => istNow().toISOString().slice(0, 10);
const nowMin = () => { const n = istNow(); return n.getUTCHours() * 60 + n.getUTCMinutes(); };
const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
// A real calendar date: 2027-02-31 is refused, not rolled over to March.
const isIso = (s) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
	const d = new Date(s + 'T00:00:00Z');
	return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};

// Online booking is open for today, tomorrow and the day after only (it rolls forward daily), so a
// sudden doctor leave affects as few paid bookings as possible.
// Keep in step with BOOKING_FIRST_DAY / BOOKING_LAST_DAY in booking-1.html.
const ONLINE_FIRST_DAY = 0, ONLINE_LAST_DAY = 2;
const isoPlus = (n) => new Date(Date.parse(todayIso() + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const firstOnlineDay = () => isoPlus(ONLINE_FIRST_DAY);
const lastOnlineDay = () => isoPlus(ONLINE_LAST_DAY);

// '10:00 AM' <-> minutes after midnight
const toMin = (t) => {
	const m = /^(\d{1,2}):([0-5]\d) (AM|PM)$/.exec(String(t || '').trim());
	if (!m || +m[1] < 1 || +m[1] > 12) return null;
	return ((+m[1] % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2];
};
const toTime = (min) => {
	const h = Math.floor(min / 60), mm = String(min % 60).padStart(2, '0');
	return ((h % 12) || 12) + ':' + mm + ' ' + (h < 12 ? 'AM' : 'PM');
};

// Until reception saves timings for a doctor, use the OP hours the website shows for them
// ("opRange" in booking-catalog.json), so the Doctor Schedule form opens with the same hours.
const CATALOG = require('../../assets/js/booking-catalog.json');
const defaultFor = (doctor) => {
	const r = (CATALOG.doctors[doctor] || {}).opRange;
	const start = r && toMin(r.start), end = r && toMin(r.end);
	return start != null && end != null && start < end ? { ...DEFAULT, start_min: start, end_min: end } : DEFAULT;
};

const getSchedule = async (doctor) => {
	const row = await one(`SELECT * FROM doctor_schedule WHERE doctor = $1`, [doctor]);
	return row ? { ...defaultFor(doctor), ...row, days: (row.days || []).map(Number) } : { ...defaultFor(doctor), doctor };
};

const onLeave = async (doctor, date) =>
	!!(await one(`SELECT 1 AS x FROM doctor_leave WHERE doctor = $1 AND date = $2`, [doctor, date]));

// One-day timing changes between two dates: { 'YYYY-MM-DD': { start_min, end_min } }.
const dayHours = async (doctor, from, to) => {
	const rows = await q(`SELECT date, start_min, end_min FROM doctor_day_hours WHERE doctor = $1 AND date BETWEEN $2 AND $3`, [doctor, from, to]);
	return rows.reduce((o, r) => (o[r.date] = { start_min: Number(r.start_min), end_min: Number(r.end_min) }, o), {});
};

// What a doctor's OP looks like on one date: weekly timing, unless that day has its own timing or leave.
const dayPlan = (s, date, hours, leaveDates) => {
	const custom = hours[date] || null;
	const leave = leaveDates.includes(date);
	const open = !leave && (custom ? true : s.days.includes(weekday(date)));
	return { date, open, leave, custom: !!custom, start_min: custom ? custom.start_min : s.start_min, end_min: custom ? custom.end_min : s.end_min };
};

// The online-booking window (today, tomorrow, the day after) for one doctor.
const onlineDays = async (doctor) => {
	const s = await getSchedule(doctor);
	const from = firstOnlineDay(), to = lastOnlineDay();
	const hours = await dayHours(doctor, from, to);
	const leave = (await q(`SELECT date FROM doctor_leave WHERE doctor = $1 AND date BETWEEN $2 AND $3`, [doctor, from, to])).map((r) => r.date);
	const out = [];
	for (let i = ONLINE_FIRST_DAY; i <= ONLINE_LAST_DAY; i++) out.push(dayPlan(s, isoPlus(i), hours, leave));
	return out;
};

// Also count older checkout orders during the rollout, and normalize times such as 09:00 AM.
const activeHolds = `NOT slot_rejected AND COALESCE(hold_until, created_at + interval '15 minutes') > statement_timestamp()`;
const slotUsage = `SELECT count(*) FROM (
	SELECT 1 FROM appointments WHERE doctor = $1 AND date = $2 AND ltrim(time, '0') = $3
		AND source = 'online' AND status NOT IN ('cancelled', 'no_show')
	UNION ALL
	SELECT 1 FROM pending_orders WHERE booking->>'doctor' = $1 AND booking->>'date' = $2
		AND ltrim(booking->>'time', '0') = $3 AND ${activeHolds} AND order_id <> $4
) AS usage`;
const slotHasSpace = `(${slotUsage}) < COALESCE((SELECT capacity FROM doctor_schedule WHERE doctor = $1), 1)`;
const SLOT_FULL = 'That time slot is full. Please pick another time.';

// Returns an error message, or null when the slot can be booked online.
const checkOnlineSlot = async (doctor, date, time) => {
	const s = await getSchedule(doctor);
	const min = toMin(time);
	if (!isIso(date)) return 'Please choose a valid date.';
	if (!s.online) return 'Online booking is paused for this doctor. Please call +91 95664 43300.';
	if (date < firstOnlineDay() || date > lastOnlineDay()) return 'Online booking is open for today, tomorrow and the day after only. For later dates, please call +91 95664 43300.';
	if (await onLeave(doctor, date)) return 'The doctor is on leave that day. Please pick another day.';
	const day = dayPlan(s, date, await dayHours(doctor, date, date), []);
	if (!day.open) return 'The doctor is not available on this day. Please pick another day.';
	if (min == null || min < day.start_min || min >= day.end_min) {
		return 'Please choose a time between ' + toTime(day.start_min) + ' and ' + toTime(day.end_min) + (day.custom ? ' on that day (special timing).' : '.');
	}
	return null;
};

// Why a patient cannot be seen at this date and time ({ code, message }), or null when they can.
const visitCheck = async (doctor, date, min) => {
	const today = todayIso();
	if (date < today || (date === today && min <= nowMin())) return { code: 'time_passed', message: 'That time has already passed. Pick a later time.' };
	if (await onLeave(doctor, date)) return { code: 'doctor_leave', message: 'The doctor is on leave that day.' };
	const day = dayPlan(await getSchedule(doctor), date, await dayHours(doctor, date, date), []);
	if (!day.open) return { code: 'timing_changed', message: 'The doctor has no OP that day. If the doctor agreed to come, set a special timing for it in Doctor Schedule first.' };
	if (min < day.start_min || min >= day.end_min) {
		return { code: 'timing_changed', message: 'Pick a time between ' + toTime(day.start_min) + ' and ' + toTime(day.end_min) + ' (OP hours that day).' };
	}
	return null;
};

// One connection can keep only a few unpaid slots at a time, so a script cannot block a whole day.
const MAX_OPEN_HOLDS = 3, MAX_HOLD_ATTEMPTS = 8;
const TOO_MANY_HOLDS = 'Too many unfinished bookings from this connection. Please finish the payment already open, wait a few minutes, or call +91 95664 43300.';
const recentHolds = (client) => `(SELECT count(*) FROM pending_orders WHERE client_key = ${client}
	AND created_at > statement_timestamp() - interval '15 minutes') < ${MAX_HOLD_ATTEMPTS}`;
const openHolds = (client) => `(SELECT count(*) FROM pending_orders WHERE client_key = ${client} AND NOT slot_rejected
	AND COALESCE(hold_until, created_at + interval '15 minutes') > statement_timestamp()) < ${MAX_OPEN_HOLDS}`;

const reserveOnlineSlot = async (booking, holdId, amount, client = 'unknown') => {
	const { doctor, date, time, phone } = booking;
	const slotAt = `($2::text::date + make_interval(mins => $7::int)) AT TIME ZONE 'Asia/Kolkata'`;
	const [, , rows] = await withSlot(doctor, date, time,
		[`SELECT pg_advisory_xact_lock(hashtextextended($1, 1))`, [client]],
		// The same patient trying again after closing the payment window: free their earlier hold.
		// The row stays, so a payment on the earlier order is still found and handled.
		[`UPDATE pending_orders SET hold_until = statement_timestamp()
		  WHERE client_key = $1 AND booking->>'phone' = $2 AND booking->>'doctor' = $3 AND booking->>'date' = $4
			AND ltrim(booking->>'time', '0') = $5 AND NOT slot_rejected AND hold_until > statement_timestamp()
			AND ${recentHolds('$1')}`, [client, phone, doctor, date, time]],
		[`INSERT INTO pending_orders (order_id, booking, amount_paise, hold_until, client_key)
		  SELECT $4, $5, $6, LEAST(statement_timestamp() + interval '15 minutes', ${slotAt}), $8
		  WHERE ${slotHasSpace} AND ${slotAt} > statement_timestamp()
			AND ${openHolds('$8')} AND ${recentHolds('$8')}
		  RETURNING hold_until`,
		[doctor, date, time, holdId, JSON.stringify(booking), amount, toMin(time), client]]);
	if (rows[0]) return rows[0];
	const ok = await one(`SELECT (${openHolds('$1')}) AND (${recentHolds('$1')}) AS ok`, [client]);
	return ok && ok.ok ? null : { limited: true };
};

// For the booking page: what to grey out between two dates.
const availability = async (doctor, from, to) => {
	const s = await getSchedule(doctor);
	const leave = (await q(`SELECT date FROM doctor_leave WHERE doctor = $1 AND date BETWEEN $2 AND $3 ORDER BY date`,
		[doctor, from, to])).map((r) => r.date);
	const full = {};
	const rows = await q(`SELECT date, ltrim(time, '0') AS time, count(*)::int AS n FROM (
		SELECT date, time FROM appointments WHERE doctor = $1 AND date BETWEEN $2 AND $3
			AND source = 'online' AND status NOT IN ('cancelled', 'no_show')
		UNION ALL
		SELECT booking->>'date', booking->>'time' FROM pending_orders
			WHERE booking->>'doctor' = $1 AND booking->>'date' BETWEEN $2 AND $3 AND ${activeHolds}
	) AS slots GROUP BY date, ltrim(time, '0')`, [doctor, from, to]);
	rows.filter((r) => r.n >= (s.capacity ?? 1)).forEach((r) => { (full[r.date] = full[r.date] || []).push(r.time); });
	// hours: dates with their own timing (they are open even on a normally closed weekday).
	return { days: s.days, start_min: s.start_min, end_min: s.end_min, online: s.online, leave, full, hours: await dayHours(doctor, from, to) };
};

module.exports = { DEFAULT, ONLINE_FIRST_DAY, ONLINE_LAST_DAY, firstOnlineDay, lastOnlineDay, isoPlus, istNow, todayIso, nowMin, weekday, isIso, toMin, toTime, getSchedule, onLeave, dayHours, dayPlan, onlineDays, checkOnlineSlot, visitCheck, availability, reserveOnlineSlot, slotHasSpace, SLOT_FULL, TOO_MANY_HOLDS };
