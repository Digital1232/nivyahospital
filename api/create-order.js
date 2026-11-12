// POST booking details -> creates a Razorpay order. The fee is looked up here,
// so the browser can never choose its own amount.
const { cors, keys, razorpay, validateBooking, newBookingId } = require('./_lib/razorpay');
const db = require('./_lib/db');
const { checkOnlineSlot } = require('./_lib/schedule');
const { getCatalog } = require('./_lib/catalog');

module.exports = async (req, res) => {
	if (cors(req, res)) return;
	res.setHeader('Cache-Control', 'no-store');
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
	const k = keys();
	if (!k) return res.status(503).json({ error: 'Online payment is not available yet.' });

	// Fees and booking type come from the reception panel's Booking settings (or the catalog file).
	const checked = validateBooking(req.body, await getCatalog(), { scheduled: db.configured() });
	if (checked.error) return res.status(400).json({ error: checked.error });
	const b = checked.value;

	// Reception's doctor schedule: leave, OP hours, slot capacity. Skipped if the database is down,
	// so a database problem never stops patients from booking.
	if (db.configured()) {
		try {
			const slotError = await checkOnlineSlot(b.doctor, b.date, b.time);
			if (slotError) return res.status(400).json({ error: slotError });
		} catch (err) { console.error('schedule check failed:', err.message); }
	}

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
		if (db.configured()) {
			// Kept until payment is verified, then copied into the reception panel's appointments.
			await db.q(`INSERT INTO pending_orders (order_id, booking, amount_paise) VALUES ($1, $2, $3) ON CONFLICT (order_id) DO NOTHING`,
				[order.id, JSON.stringify({ ...b, bookingId: order.receipt }), order.amount]).catch((e) => console.error('save booking failed:', e.message));
		}
		return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: k.id });
	} catch (err) {
		console.error('create-order failed:', err.message);
		return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
	}
};
