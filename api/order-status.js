// GET ?order=order_XXXX -> was this order paid? The booking page asks this when it reopens after
// the payment window closed or redirected the tab before the page could report the payment.
// A paid order is recorded for the reception panel here too. Order ids are long random
// Razorpay ids that only the patient's browser holds; the reply carries no personal details.
const { cors, keys, mode } = require('./_lib/razorpay');
const { settleOrder } = require('./_lib/payments');

module.exports = async (req, res) => {
	if (cors(req, res)) return;
	res.setHeader('Cache-Control', 'no-store');
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
	if (!keys()) return res.status(503).json({ error: 'Online payment is not available yet.' });
	const orderId = String((req.query && req.query.order) || '');
	if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId)) return res.status(400).json({ error: 'Invalid order.' });
	try {
		const out = await settleOrder(orderId, mode() === 'test');
		return res.status(200).json(out ? { paid: true, ...out } : { paid: false });
	} catch (err) {
		console.error('order-status failed:', orderId, err.message);
		return res.status(err.status === 400 || err.status === 404 ? 404 : 502).json({ error: 'Could not check the payment.' });
	}
};
