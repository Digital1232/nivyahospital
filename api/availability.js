// Public: which days/times the booking page should grey out for a doctor
// (OP days and hours, leave, full slots). No patient data is returned.
const { CATALOG, cors } = require('./_lib/razorpay');
const { configured } = require('./_lib/db');
const S = require('./_lib/schedule');

module.exports = async (req, res) => {
	if (cors(req, res)) return;
	res.setHeader('Cache-Control', 'no-store');
	if (!configured()) return res.status(200).json({ configured: false });
	const query = req.query || {};
	const doctor = String(query.doctor || '');
	if (!Object.prototype.hasOwnProperty.call(CATALOG.doctors, doctor)) return res.status(400).json({ error: 'Unknown doctor.' });
	const from = S.todayIso();
	const to = new Date(Date.parse(from + 'T00:00:00Z') + 15 * 86400000).toISOString().slice(0, 10);
	try {
		return res.status(200).json({ configured: true, ...(await S.availability(doctor, from, to)) });
	} catch (err) {
		console.error('availability failed:', err.message);
		return res.status(200).json({ configured: false });
	}
};
