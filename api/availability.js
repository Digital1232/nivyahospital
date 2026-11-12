// Public booking info, used by the booking page and the doctor cards. No patient data.
//   ?doctor=Dr. X  -> that doctor's booking settings (info) and what to grey out
//                     (OP days and hours, leave, full slots) for the next 15 days
//   ?all=1         -> every doctor's booking settings and OP schedule
const { cors } = require('./_lib/razorpay');
const { configured } = require('./_lib/db');
const { getCatalog, DOCTORS } = require('./_lib/catalog');
const S = require('./_lib/schedule');

// Only what the public pages need.
const publicInfo = (d) => ({
	speciality: d.speciality,
	avatar: d.avatar,
	bookingMode: d.bookingMode === 'request' ? 'request' : 'online',
	feeStatus: d.feeStatus === 'pending' ? 'pending' : 'set',
	fees: d.fees || { new: null, old: null },
	opHours: d.opHours || '',
	bookingSessions: d.bookingSessions || null,
	calendarMinutes: d.calendarMinutes || null,
	addons: (d.addons || []).map((a) => ({ id: a.id, name: a.name, price: a.price }))
});

module.exports = async (req, res) => {
	if (cors(req, res)) return;
	res.setHeader('Cache-Control', 'no-store');
	if (!configured()) return res.status(200).json({ configured: false });
	const query = req.query || {};
	try {
		const catalog = await getCatalog();
		if (query.all) {
			const doctors = {};
			for (const name of DOCTORS) {
				const s = await S.getSchedule(name);
				doctors[name] = { ...publicInfo(catalog.doctors[name]), schedule: { days: s.days, start_min: s.start_min, end_min: s.end_min, online: s.online } };
			}
			return res.status(200).json({ configured: true, doctors });
		}
		const doctor = String(query.doctor || '');
		if (!DOCTORS.includes(doctor)) return res.status(400).json({ error: 'Unknown doctor.' });
		const from = S.todayIso();
		const to = new Date(Date.parse(from + 'T00:00:00Z') + 15 * 86400000).toISOString().slice(0, 10);
		return res.status(200).json({ configured: true, info: publicInfo(catalog.doctors[doctor]), ...(await S.availability(doctor, from, to)) });
	} catch (err) {
		console.error('availability failed:', err.message);
		return res.status(200).json({ configured: false });
	}
};
