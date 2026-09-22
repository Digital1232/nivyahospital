// POST booking details -> creates a Razorpay order. The fee is looked up here,
// so the browser can never choose its own amount.
const { keys, razorpay, validateBooking, newBookingId } = require('./_lib/razorpay');

module.exports = async (req, res) => {
	res.setHeader('Cache-Control', 'no-store');
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
	const k = keys();
	if (!k) return res.status(503).json({ error: 'Online payment is not available yet.' });

	const checked = validateBooking(req.body);
	if (checked.error) return res.status(400).json({ error: checked.error });
	const b = checked.value;

	try {
		// Booking details ride on the order's notes (max 256 chars each), so the hospital
		// sees every booking in the Razorpay Dashboard next to its payment.
		const order = await razorpay('POST', '/orders', {
			amount: checked.amountPaise,
			currency: 'INR',
			receipt: newBookingId(),
			notes: {
				doctor: b.doctor,
				specialty: b.specialty,
				appointment: b.time + ', ' + b.date,
				consultation: b.type === 'old' ? 'Follow-up (old patient)' : 'New patient',
				services: b.addons.map((a) => a.name).join(', '),
				patient: b.name,
				phone: b.phone,
				email: b.email,
				age_gender: (b.age == null ? 'Not provided' : b.age) + ' / ' + (b.gender || 'Not provided'),
				reason: b.reason
			}
		});
		return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: k.id });
	} catch (err) {
		console.error('create-order failed:', err.message);
		return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
	}
};
