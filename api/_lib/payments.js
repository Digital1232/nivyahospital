// Turns a paid Razorpay order into a reception-panel booking.
// Used by verify-payment (normal path), order-status (the booking page re-checking after the
// payment window closed the tab) and the reception panel (catch-up for anything still pending),
// so a paid booking is recorded even if the patient's browser never reported back.
const { razorpay, keys } = require('./razorpay');
const db = require('./db');
const { toMin } = require('./schedule');

// Copies the paid booking into appointments. Never throws.
const recordBooking = async (order, paymentId) => {
	if (!db.configured()) return;
	try {
		const p = await db.one(`SELECT booking FROM pending_orders WHERE order_id = $1`, [order.id]);
		if (!p) return; // already recorded (or created before the database was connected)
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

// Captures an authorized payment; returns false if the payment cannot count for this order.
const settlePayment = async (order, payment) => {
	if (payment.order_id !== order.id || payment.amount !== order.amount) return false;
	if (payment.status === 'authorized') {
		await razorpay('POST', '/payments/' + encodeURIComponent(payment.id) + '/capture', {
			amount: payment.amount,
			currency: payment.currency
		});
		payment.status = 'captured';
	}
	if (payment.status !== 'captured') return false;
	await recordBooking(order, payment.id);
	return true;
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
		await db.q(`DELETE FROM pending_orders WHERE created_at < now() - interval '3 days'`);
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

module.exports = { recordBooking, settlePayment, settleOrder, receiptOf, reconcilePending };
