// POST the Razorpay checkout result -> verifies the signature with the secret key,
// makes sure the payment is really for this order and amount, captures it if needed,
// and returns the booking number.
const { cors, keys, mode, razorpay, signatureOk } = require('./_lib/razorpay');
const db = require('./_lib/db');
const { toMin } = require('./_lib/schedule');

// Copies the paid booking into the reception panel. Never fails the payment response.
const recordBooking = async (order, paymentId) => {
	if (!db.configured()) return;
	try {
		const p = await db.one(`SELECT booking FROM pending_orders WHERE order_id = $1`, [order.id]);
		if (!p) return console.error('record booking: no pending order', order.id);
		const b = typeof p.booking === 'string' ? JSON.parse(p.booking) : p.booking;
		const patient = await db.one(`INSERT INTO patients (name, name_key, phone, email, age, gender) VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (phone, name_key) DO UPDATE SET email = COALESCE(EXCLUDED.email, patients.email),
				age = COALESCE(EXCLUDED.age, patients.age), gender = COALESCE(EXCLUDED.gender, patients.gender)
			RETURNING id`, [b.name, String(b.name).toLowerCase(), b.phone, b.email || null, b.age, b.gender || null]);
		await db.q(`INSERT INTO appointments (booking_id, source, patient_id, doctor, date, time, time_min, visit_type, reason, services,
				amount_paise, order_id, payment_id, status, created_by)
			VALUES ($1, 'online', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'booked', 'website')
			ON CONFLICT (booking_id) DO NOTHING`,
			[order.receipt, patient.id, b.doctor, b.date, b.time, toMin(b.time), b.type, b.reason || null,
				JSON.stringify((b.addons || []).map((a) => a.name)), order.amount, order.id, paymentId]);
		await db.q(`DELETE FROM pending_orders WHERE order_id = $1`, [order.id]);
	} catch (err) {
		console.error('record booking failed:', order.id, err.message);
	}
};

module.exports = async (req, res) => {
	if (cors(req, res)) return;
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
		await recordBooking(order, paymentId);
		return res.status(200).json({
			bookingId: order.receipt,
			receipt: {
				paymentId,
				amountPaise: payment.amount,
				currency: payment.currency,
				test: mode() === 'test'
			}
		});
	} catch (err) {
		console.error('verify-payment failed:', err.message);
		return res.status(502).json({ error: 'Could not confirm the payment. Please contact the hospital.' });
	}
};
