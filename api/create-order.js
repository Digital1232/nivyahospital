// POST booking details -> creates a Razorpay order. The fee is looked up here,
// so the browser can never choose its own amount.
const { cors, keys, razorpay, validateBooking, newBookingId } = require('./_lib/razorpay');
const db = require('./_lib/db');
const { checkOnlineSlot, reserveOnlineSlot, toMin, toTime, SLOT_FULL } = require('./_lib/schedule');
const { getCatalog } = require('./_lib/catalog');

module.exports = async (req, res) => {
	if (cors(req, res)) return;
	res.setHeader('Cache-Control', 'no-store');
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
	const k = keys();
	if (!k || !db.configured()) return res.status(503).json({ error: 'Online booking is temporarily unavailable. Please call the hospital.' });

	// Fees and booking type come from the reception panel's Booking settings (or the catalog file).
	const checked = validateBooking(req.body, await getCatalog(), { scheduled: true });
	if (checked.error) return res.status(400).json({ error: checked.error });
	const b = checked.value;
	b.time = toTime(toMin(b.time));
	const bookingId = newBookingId();
	const holdId = 'hold_' + bookingId;

	try {
		const slotError = await checkOnlineSlot(b.doctor, b.date, b.time);
		if (slotError) return res.status(400).json({ error: slotError });
		const hold = await reserveOnlineSlot({ ...b, bookingId }, holdId, checked.amountPaise);
		if (!hold) return res.status(409).json({ error: SLOT_FULL });
	} catch (err) {
		console.error('reserve slot failed:', err.message);
		return res.status(503).json({ error: 'Could not reserve this time slot. Please try again.' });
	}

	try {
		// Booking details ride on the order's notes (max 256 chars each), so the hospital
		// sees every booking in the Razorpay Dashboard next to its payment.
		const order = await razorpay('POST', '/orders', {
			amount: checked.amountPaise,
			currency: 'INR',
			receipt: bookingId,
			notes: {
				doctor: b.doctor,
				specialty: b.specialty,
				appointment: b.time + ', ' + b.date,
				consultation: b.type === 'old' ? 'Follow-up (old patient)' : 'New patient',
				services: b.addons.map((a) => a.name).join(', '),
				patient: b.name,
				phone: b.phone,
				age_gender: (b.age == null ? 'Not provided' : b.age) + ' / ' + (b.gender || 'Not provided'),
				reason: b.reason
			}
		});
		const bound = await db.one(`UPDATE pending_orders SET order_id = $2
			WHERE order_id = $1 AND hold_until > statement_timestamp() RETURNING hold_until`, [holdId, order.id]);
		if (!bound) return res.status(409).json({ error: 'The slot reservation expired. Please choose a time again.' });
		return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: k.id,
			holdUntil: bound.hold_until });
	} catch (err) {
		await db.q(`DELETE FROM pending_orders WHERE order_id = $1`, [holdId]).catch(() => {});
		console.error('create-order failed:', err.message);
		return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
	}
};
