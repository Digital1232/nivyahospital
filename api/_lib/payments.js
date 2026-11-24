// Turns a paid Razorpay order into a reception-panel booking.
// Used by verify-payment (normal path), order-status (the booking page re-checking after the
// payment window closed the tab) and the reception panel (catch-up for anything still pending),
// so a paid booking is recorded even if the patient's browser never reported back.
// If the money was taken but the slot cannot be used, the order goes on the Dashboard's
// "Payments needing action" list for reception; it is never dropped.
const { razorpay, keys } = require('./razorpay');
const db = require('./db');
const { toMin, toTime, slotHasSpace, visitCheck } = require('./schedule');

const notOnLeave = `NOT EXISTS (SELECT 1 FROM doctor_leave WHERE doctor = $1 AND date = $2)`;
const parsed = (booking) => (typeof booking === 'string' ? JSON.parse(booking) : booking);

const recorded = (order, paymentId) => db.one(
	`SELECT id, date, time FROM appointments WHERE booking_id = $1 AND order_id = $2 AND payment_id = $3`,
	[order.receipt, order.id, paymentId]);

// Renew the hold while Razorpay capture is in progress. An expired hold can be renewed too,
// as long as nobody else has taken the slot and the doctor is not on leave.
const claimForPayment = async (order, { doctor, date, time }) => {
	const [rows] = await db.withSlot(doctor, date, time, [
		`UPDATE pending_orders SET hold_until = GREATEST(hold_until, statement_timestamp() + interval '2 minutes')
		 WHERE order_id = $4 AND NOT slot_rejected AND ${notOnLeave} AND ${slotHasSpace} RETURNING order_id`,
		[doctor, date, time, order.id]
	]);
	return rows.length > 0;
};

// Replace the hold with a booking atomically, including the patient's record.
// `reviewed`: reception is placing an order from the "Payments needing action" list.
const recordBooking = async (order, paymentId, b, { reviewed = false, by = 'website' } = {}) => {
	const eligible = reviewed ? `slot_rejected AND resolved_at IS NULL`
		: `NOT slot_rejected AND hold_until > statement_timestamp()`;
	const [rows] = await db.withSlot(b.doctor, b.date, b.time, [
		`WITH patient AS (
			INSERT INTO patients (name, name_key, phone, age, gender)
			SELECT $5, $6, $7, $8, $9 FROM pending_orders WHERE order_id = $4 AND ${eligible}
				AND ${notOnLeave} AND ${slotHasSpace}
			ON CONFLICT (phone, name_key) DO UPDATE SET
				age = COALESCE(EXCLUDED.age, patients.age), gender = COALESCE(EXCLUDED.gender, patients.gender)
			RETURNING id
		), booked AS (
			INSERT INTO appointments (booking_id, source, patient_id, doctor, date, time, time_min, visit_type,
				reason, services, amount_paise, order_id, payment_id, status, created_by)
			SELECT $10, 'online', patient.id, $1, $2, $3, $11, $12, $13, $14, $15, $4, $16, 'booked', $17 FROM patient
			ON CONFLICT (booking_id) DO NOTHING RETURNING id
		)
		DELETE FROM pending_orders WHERE order_id = $4 AND EXISTS (SELECT 1 FROM booked) RETURNING order_id`,
		[b.doctor, b.date, b.time, order.id, b.name, b.name.toLowerCase(), b.phone, b.age, b.gender || null,
			order.receipt, toMin(b.time), b.type, b.reason || null, JSON.stringify((b.addons || []).map((a) => a.name)), order.amount, paymentId, by]
	]);
	return rows.length > 0 || !!(await recorded(order, paymentId));
};

// The slot cannot be used. Money already taken goes to reception. An uncaptured payment is left
// alone, so Razorpay releases it back to the patient, and the order is marked 'released': the patient
// is told they were not charged, so it must never be captured later (for example by the panel's
// catch-up once the slot frees up). Its slot is freed at once.
const notBooked = async (order, payment, booking, released = false) => {
	if (await recorded(order, payment.id)) return 'booked';
	if (payment.status !== 'captured') {
		await db.q(`UPDATE pending_orders SET review_reason = 'released', hold_until = LEAST(hold_until, statement_timestamp())
			WHERE order_id = $1 AND NOT slot_rejected`, [order.id]);
		return 'slot_gone';
	}
	const problem = released ? { code: 'released' } : await visitCheck(booking.doctor, booking.date, toMin(booking.time));
	const rows = await db.q(`UPDATE pending_orders SET slot_rejected = true, payment_id = $2, review_reason = $3
		WHERE order_id = $1 AND NOT slot_rejected RETURNING order_id`, [order.id, payment.id, problem ? problem.code : 'slot_full']);
	if (rows.length) console.error('Captured payment needs review:', order.id, payment.id);
	return 'review';
};

// Returns 'booked', 'review' (paid, waiting for reception), 'slot_gone' (not charged) or 'unpaid'.
const settlePayment = async (order, payment) => {
	if (payment.order_id !== order.id || payment.amount !== order.amount) return 'unpaid';
	if (!['authorized', 'captured'].includes(payment.status)) return 'unpaid';
	const pending = await db.one(`SELECT booking, slot_rejected, review_reason FROM pending_orders WHERE order_id = $1`, [order.id]);
	if (!pending || pending.slot_rejected) {
		if (await recorded(order, payment.id)) return 'booked';
		if (payment.status !== 'captured') return 'unpaid';
		if (!pending) console.error('Captured payment has no order record:', order.id, payment.id);
		return 'review';
	}
	const booking = parsed(pending.booking);
	booking.time = toTime(toMin(booking.time));
	// Already told "not charged": never capture or book it now; if Razorpay took the money anyway, reception sees it.
	if (pending.review_reason === 'released') return notBooked(order, payment, booking, true);
	const problem = await visitCheck(booking.doctor, booking.date, toMin(booking.time));
	if (problem || !(await claimForPayment(order, booking))) return notBooked(order, payment, booking);

	if (payment.status === 'authorized') {
		const path = '/payments/' + encodeURIComponent(payment.id);
		try {
			payment = await razorpay('POST', path + '/capture', { amount: order.amount, currency: payment.currency });
		} catch (err) {
			payment = await razorpay('GET', path);
			if (payment.status !== 'captured') throw err;
		}
	}
	if (payment.status !== 'captured') return 'unpaid';
	return (await recordBooking(order, payment.id, booking)) ? 'booked' : notBooked(order, payment, booking);
};

const receiptOf = (order, payment, test) => ({
	bookingId: order.receipt,
	receipt: { paymentId: payment.id, amountPaise: payment.amount, currency: payment.currency, test }
});

// Asks Razorpay whether an order was paid; records it if so.
// Returns receiptOf(...) (with review: true when reception must act) or null.
const settleOrder = async (orderId, test) => {
	const [order, list] = await Promise.all([
		razorpay('GET', '/orders/' + encodeURIComponent(orderId)),
		razorpay('GET', '/orders/' + encodeURIComponent(orderId) + '/payments')
	]);
	const items = (list && list.items) || [];
	const pick = items.find((p) => p.status === 'captured') || items.find((p) => p.status === 'authorized');
	if (!pick) return null;
	const outcome = await settlePayment(order, pick);
	if (outcome === 'review') return { review: true, ...receiptOf(order, pick, test) };
	if (outcome !== 'booked') return null;
	// Reception may have moved the visit, so report the date and time actually booked.
	const row = await recorded(order, pick.id);
	return { ...receiptOf(order, pick, test), appointment: row ? { date: row.date, time: row.time } : null };
};

// Reception places a paid order from the "Payments needing action" list on a date and time.
const bookReviewedPayment = async (row, date, time, by) => {
	const b = parsed(row.booking);
	let { payment_id: paymentId } = row;
	let receipt = b.bookingId;
	if (!paymentId || !receipt) {
		if (!keys()) return { error: 'Online payment is not connected, so this payment cannot be checked.' };
		const id = encodeURIComponent(row.order_id);
		const [order, list] = await Promise.all([razorpay('GET', '/orders/' + id), razorpay('GET', '/orders/' + id + '/payments')]);
		const paid = ((list && list.items) || []).find((p) => p.status === 'captured');
		if (!paid) return { error: 'Razorpay does not show a completed payment for this order.' };
		paymentId = paid.id;
		receipt = order.receipt;
	}
	const order = { id: row.order_id, receipt, amount: row.amount_paise };
	const ok = await recordBooking(order, paymentId, { ...b, date, time }, { reviewed: true, by });
	if (!ok) return { error: 'That time is full or no longer available. Pick another time.' };
	const saved = await recorded(order, paymentId);
	return { ok: true, appointmentId: saved && saved.id, paymentId, bookingId: receipt };
};

// Reception panel catch-up: checks orders still waiting for a payment report, each at most every
// 2 minutes. An order is dropped after 3 days only once Razorpay confirms it was not paid.
const reconcilePending = async () => {
	if (!db.configured() || !keys()) return;
	try {
		const rows = await db.q(`UPDATE pending_orders SET checked_at = now()
			WHERE order_id IN (SELECT order_id FROM pending_orders
				WHERE NOT slot_rejected AND created_at < now() - interval '1 minute'
					AND (checked_at IS NULL OR checked_at < now() - interval '2 minutes')
				ORDER BY checked_at ASC NULLS FIRST, created_at DESC LIMIT 5)
			RETURNING order_id, created_at < now() - interval '3 days' AS stale`);
		await Promise.all(rows.map(async (r) => {
			try {
				const out = await settleOrder(r.order_id, false);
				if (!out && r.stale) await db.q(`DELETE FROM pending_orders WHERE order_id = $1 AND NOT slot_rejected`, [r.order_id]);
			} catch (e) {
				// Unknown to Razorpay (e.g. a test-mode order after switching to live keys): stop asking.
				if (e.status === 400 || e.status === 404) await db.q(`DELETE FROM pending_orders WHERE order_id = $1`, [r.order_id]).catch(() => {});
				else console.error('reconcile failed:', r.order_id, e.message);
			}
		}));
	} catch (err) {
		console.error('reconcile pending failed:', err.message);
	}
};

module.exports = { settlePayment, settleOrder, receiptOf, reconcilePending, bookReviewedPayment };
