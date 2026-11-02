// The booking page asks this once on load: is online payment configured, and in which mode?
// If not, the page keeps the "Call to Confirm Booking" fallback.
const { mode, cors } = require('./_lib/razorpay');

module.exports = (req, res) => {
	if (cors(req, res)) return;
	res.setHeader('Cache-Control', 'no-store');
	const m = mode();
	res.status(200).json({ enabled: !!m, mode: m });
};
