// POST the Razorpay checkout result -> verifies the signature with the secret key,
// makes sure the payment is really for this order and amount, captures it if needed,
// and returns the booking number.
const { keys, razorpay, signatureOk } = require('./_lib/razorpay');

module.exports = async (req, res) => {
	res.setHeader('Cache-Control', 'no-store');
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
	const k = keys();
	if (!k) return res.status(503).json({ error: 'Online payment is not available yet.' });

	const body = req.body || {};
	const orderId = String(body.razorpay_order_id || '');
	const paymentId = String(body.razorpay_payment_id || '');
	if (!orderId || !paymentId || !signatureOk(orderId, paymentId, body.razorpay_signature, k.secret)) {
		return res.status(400).json({ error: 'Payment could not be verified.' });
	}

	try {
		const [order, payment] = await Promise.all([
			razorpay('GET', '/orders/' + encodeURIComponent(orderId)),
			razorpay('GET', '/payments/' + encodeURIComponent(paymentId))
		]);
		if (payment.order_id !== order.id || payment.amount !== order.amount) {
			return res.status(400).json({ error: 'Payment does not match the booking.' });
		}
		if (payment.status === 'authorized') {
			await razorpay('POST', '/payments/' + encodeURIComponent(paymentId) + '/capture', {
				amount: payment.amount,
				currency: payment.currency
			});
		} else if (payment.status !== 'captured') {
			return res.status(400).json({ error: 'Payment was not completed.' });
		}
		return res.status(200).json({ bookingId: order.receipt });
	} catch (err) {
		console.error('verify-payment failed:', err.message);
		return res.status(502).json({ error: 'Could not confirm the payment. Please contact the hospital.' });
	}
};
