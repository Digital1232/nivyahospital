// Doctor OP timings, leave and online-slot capacity, shared by the booking API,
// the public availability endpoint and the reception panel.
const { q, one, withSlot } = require('./db');

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
	if (!s.online) return 'Online booking is paused for this doctor. Please call +91 95664 43300.';
	if (!s.days.includes(weekday(date))) return 'The doctor is not available on this day. Please pick another day.';
	if (await onLeave(doctor, date)) return 'The doctor is on leave that day. Please pick another day.';
	if (min == null || min < s.start_min || min >= s.end_min) {
		return 'Please choose a time between ' + toTime(s.start_min) + ' and ' + toTime(s.end_min) + '.';
	}
	return null;
};

const reserveOnlineSlot = async (booking, holdId, amount) => {
	const { doctor, date, time } = booking;
	const [rows] = await withSlot(doctor, date, time, [
		`INSERT INTO pending_orders (order_id, booking, amount_paise, hold_until)
		 SELECT $4, $5, $6, LEAST(statement_timestamp() + interval '15 minutes',
			($2::text::date + make_interval(mins => $7::int)) AT TIME ZONE 'Asia/Kolkata')
		 WHERE ${slotHasSpace}
			AND (($2::text::date + make_interval(mins => $7::int)) AT TIME ZONE 'Asia/Kolkata') > statement_timestamp()
		 RETURNING hold_until`,
		[doctor, date, time, holdId, JSON.stringify(booking), amount, toMin(time)]
	]);
	return rows[0] || null;
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
	return { days: s.days, start_min: s.start_min, end_min: s.end_min, online: s.online, leave, full };
};

module.exports = { DEFAULT, istNow, todayIso, nowMin, weekday, isIso, toMin, toTime, getSchedule, onLeave, checkOnlineSlot, availability, reserveOnlineSlot, slotHasSpace, SLOT_FULL };
