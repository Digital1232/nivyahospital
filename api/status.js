// The booking page asks this once on load: is online payment configured?
// If not, the page keeps the "Call to Confirm Booking" fallback.
const { keys } = require('./_lib/razorpay');

module.exports = (req, res) => {
	res.setHeader('Cache-Control', 'no-store');
	res.status(200).json({ enabled: !!keys() });
};
