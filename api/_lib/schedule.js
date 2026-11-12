// Doctor OP timings, leave and online-slot capacity, shared by the booking API,
// the public availability endpoint and the reception panel.
const { q, one } = require('./db');

const DEFAULT = { days: [1, 2, 3, 4, 5, 6], start_min: 540, end_min: 1140, capacity: null, online: true, note: '' };

// Hospital time is IST (UTC+5:30), whatever timezone the server runs in.
const istNow = () => new Date(Date.now() + 330 * 60 * 1000);
const todayIso = () => istNow().toISOString().slice(0, 10);
const nowMin = () => { const n = istNow(); return n.getUTCHours() * 60 + n.getUTCMinutes(); };
const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(new Date(s + 'T00:00:00Z'));

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

const getSchedule = async (doctor) => {
	const row = await one(`SELECT * FROM doctor_schedule WHERE doctor = $1`, [doctor]);
	return row ? { ...DEFAULT, ...row, days: (row.days || []).map(Number) } : { ...DEFAULT, doctor };
};

const onLeave = async (doctor, date) =>
	!!(await one(`SELECT 1 AS x FROM doctor_leave WHERE doctor = $1 AND date = $2`, [doctor, date]));

const onlineCount = async (doctor, date, time) => (await one(
	`SELECT count(*)::int AS n FROM appointments
	 WHERE doctor = $1 AND date = $2 AND time = $3 AND source = 'online' AND status NOT IN ('cancelled', 'no_show')`,
	[doctor, date, time])).n;

// Returns an error message, or null when the slot can be booked online.
const checkOnlineSlot = async (doctor, date, time) => {
	const s = await getSchedule(doctor);
	const min = toMin(time);
	if (!s.online) return 'Online booking is paused for this doctor. Please call +91 95664 43300.';
	if (!s.days.includes(weekday(date))) return 'The doctor is not available on this day. Please pick another day.';
	if (await onLeave(doctor, date)) return 'The doctor is on leave that day. Please pick another day.';
	if (min == null || min < s.start_min || min >= s.end_min) {
		return 'Please choose a time between ' + toTime(s.start_min) + ' and ' + toTime(s.end_min) + '.';
	}
	if (s.capacity != null && (await onlineCount(doctor, date, time)) >= s.capacity) {
		return 'That time slot is full. Please pick another time.';
	}
	return null;
};

// For the booking page: what to grey out between two dates.
const availability = async (doctor, from, to) => {
	const s = await getSchedule(doctor);
	const leave = (await q(`SELECT date FROM doctor_leave WHERE doctor = $1 AND date BETWEEN $2 AND $3 ORDER BY date`,
		[doctor, from, to])).map((r) => r.date);
	const full = {};
	if (s.capacity != null) {
		const rows = await q(
			`SELECT date, time, count(*)::int AS n FROM appointments
			 WHERE doctor = $1 AND date BETWEEN $2 AND $3 AND source = 'online' AND status NOT IN ('cancelled', 'no_show')
			 GROUP BY date, time`, [doctor, from, to]);
		rows.filter((r) => r.n >= s.capacity).forEach((r) => { (full[r.date] = full[r.date] || []).push(r.time); });
	}
	return { days: s.days, start_min: s.start_min, end_min: s.end_min, online: s.online, leave, full };
};

module.exports = { DEFAULT, istNow, todayIso, nowMin, weekday, isIso, toMin, toTime, getSchedule, onLeave, checkOnlineSlot, availability };
