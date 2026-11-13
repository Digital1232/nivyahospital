// Turns a paid Razorpay order into a reception-panel booking.
// Used by verify-payment (normal path), order-status (the booking page re-checking after the
// payment window closed the tab) and the reception panel (catch-up for anything still pending),
// so a paid booking is recorded even if the patient's browser never reported back.
const { razorpay, keys } = require('./razorpay');
const db = require('./db');
const { toMin, toTime, slotHasSpace } = require('./schedule');

const recorded = (order, paymentId) => db.one(
	`SELECT id FROM appointments WHERE booking_id = $1 AND order_id = $2 AND payment_id = $3`,
	[order.receipt, order.id, paymentId]);

// Renew the hold while Razorpay capture is in progress. Older orders also have to fit.
const claimForPayment = async (order, { doctor, date, time }) => {
	const [rows] = await db.withSlot(doctor, date, time, [
		`UPDATE pending_orders SET hold_until = GREATEST(hold_until, statement_timestamp() + interval '2 minutes')
		 WHERE order_id = $4 AND NOT slot_rejected
		   AND COALESCE(hold_until, created_at + interval '15 minutes') > statement_timestamp()
		   AND ${slotHasSpace} RETURNING order_id`, [doctor, date, time, order.id]
	]);
	return rows.length > 0;
};

// Replace the hold with a booking atomically, including the patient's record.
const recordBooking = async (order, paymentId, b) => {
	const [rows] = await db.withSlot(b.doctor, b.date, b.time, [
		`WITH patient AS (
			INSERT INTO patients (name, name_key, phone, age, gender)
			SELECT $5, $6, $7, $8, $9 FROM pending_orders WHERE order_id = $4 AND NOT slot_rejected
				AND hold_until > statement_timestamp() AND ${slotHasSpace}
			ON CONFLICT (phone, name_key) DO UPDATE SET
				age = COALESCE(EXCLUDED.age, patients.age), gender = COALESCE(EXCLUDED.gender, patients.gender)
			RETURNING id
		), booked AS (
			INSERT INTO appointments (booking_id, source, patient_id, doctor, date, time, time_min, visit_type,
				reason, services, amount_paise, order_id, payment_id, status, created_by)
			SELECT $10, 'online', patient.id, $1, $2, $3, $11, $12, $13, $14, $15, $4, $16, 'booked', 'website' FROM patient
			ON CONFLICT (booking_id) DO NOTHING RETURNING id
		)
		DELETE FROM pending_orders WHERE order_id = $4 AND EXISTS (SELECT 1 FROM booked) RETURNING order_id`,
		[b.doctor, b.date, b.time, order.id, b.name, b.name.toLowerCase(), b.phone, b.age, b.gender || null,
			order.receipt, toMin(b.time), b.type, b.reason || null, JSON.stringify((b.addons || []).map((a) => a.name)), order.amount, paymentId]
	]);
	return rows.length > 0 || !!(await recorded(order, paymentId));
};

const rejectLatePayment = async (order, payment) => {
	if (await recorded(order, payment.id)) return true;
	if (payment.status === 'captured') {
		const rows = await db.q(`UPDATE pending_orders SET slot_rejected = true
			WHERE order_id = $1 AND NOT slot_rejected RETURNING order_id`, [order.id]);
		if (rows.length) console.error('Captured payment needs review for expired or full slot:', order.id, payment.id);
	}
	return false;
};

const settlePayment = async (order, payment) => {
	if (payment.order_id !== order.id || payment.amount !== order.amount) return false;
	if (!['authorized', 'captured'].includes(payment.status)) return false;
	const pending = await db.one(`SELECT booking FROM pending_orders WHERE order_id = $1`, [order.id]);
	if (!pending) return payment.status === 'captured' && !!(await recorded(order, payment.id));
	const booking = typeof pending.booking === 'string' ? JSON.parse(pending.booking) : pending.booking;
	booking.time = toTime(toMin(booking.time));
	if (!(await claimForPayment(order, booking))) return rejectLatePayment(order, payment);

	if (payment.status === 'authorized') {
		const path = '/payments/' + encodeURIComponent(payment.id);
		try {
			payment = await razorpay('POST', path + '/capture', { amount: order.amount, currency: payment.currency });
		} catch (err) {
			payment = await razorpay('GET', path);
			if (payment.status !== 'captured') throw err;
		}
	}
	if (payment.status !== 'captured') return false;
	return await recordBooking(order, payment.id, booking) || rejectLatePayment(order, payment);
};

const receiptOf = (order, payment, test) => ({
	bookingId: order.receipt,
	receipt: { paymentId: payment.id, amountPaise: payment.amount, currency: payment.currency, test }
});

// Asks Razorpay whether an order was paid; records it if so. Returns receiptOf(...) or null.
const settleOrder = async (orderId, test) => {
	const [order, list] = await Promise.all([
		razorpay('GET', '/orders/' + encodeURIComponent(orderId)),
		razorpay('GET', '/orders/' + encodeURIComponent(orderId) + '/payments')
	]);
	const items = (list && list.items) || [];
	const pick = items.find((p) => p.status === 'captured') || items.find((p) => p.status === 'authorized');
	if (!pick || !(await settlePayment(order, pick))) return null;
	return receiptOf(order, pick, test);
};

// Reception panel catch-up: checks orders still waiting for a payment report.
// Each order is asked about at most every 2 minutes, for up to 3 days; then it is dropped.
const reconcilePending = async () => {
	if (!db.configured() || !keys()) return;
	try {
		await db.q(`DELETE FROM pending_orders WHERE NOT slot_rejected AND created_at < now() - interval '3 days'`);
		const rows = await db.q(`UPDATE pending_orders SET checked_at = now()
			WHERE order_id IN (SELECT order_id FROM pending_orders
				WHERE created_at < now() - interval '1 minute' AND (checked_at IS NULL OR checked_at < now() - interval '2 minutes')
				ORDER BY created_at DESC LIMIT 5)
			RETURNING order_id`);
		await Promise.all(rows.map((r) => settleOrder(r.order_id, false).catch(async (e) => {
			// Unknown to Razorpay (e.g. a test-mode order after switching to live keys): stop asking.
			if (e.status === 400 || e.status === 404) await db.q(`DELETE FROM pending_orders WHERE order_id = $1`, [r.order_id]).catch(() => {});
			else console.error('reconcile failed:', r.order_id, e.message);
		})));
	} catch (err) {
		console.error('reconcile pending failed:', err.message);
	}
};

module.exports = { settlePayment, settleOrder, receiptOf, reconcilePending };
