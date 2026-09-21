// Shared helpers for the booking/payment endpoints (Vercel serverless, Node runtime).
// Secrets come from Vercel environment variables, never from the browser:
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
const crypto = require('crypto');

// Authoritative fees and services, shared with the booking page (edit that file, not this one).
const CATALOG = require('../../assets/js/booking-catalog.json');

const keys = () => {
	const id = process.env.RAZORPAY_KEY_ID;
	const secret = process.env.RAZORPAY_KEY_SECRET;
	return id && secret ? { id, secret } : null;
};

const razorpay = async (method, path, body) => {
	const k = keys();
	const res = await fetch('https://api.razorpay.com/v1' + path, {
		method,
		headers: {
			Authorization: 'Basic ' + Buffer.from(k.id + ':' + k.secret).toString('base64'),
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err = new Error((data.error && data.error.description) || 'Razorpay request failed');
		err.status = res.status;
		throw err;
	}
	return data;
};

// Hospital time is IST (UTC+5:30), whatever timezone the server runs in.
const istNow = () => new Date(Date.now() + 330 * 60 * 1000);

const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

// Returns { error } or { value, amountPaise }.
const validateBooking = (b) => {
	if (!b || typeof b !== 'object' || !b.patient || typeof b.patient !== 'object') return { error: 'Invalid booking details.' };
	const doc = Object.prototype.hasOwnProperty.call(CATALOG.doctors, b.doctor) ? CATALOG.doctors[b.doctor] : null;
	if (!doc) return { error: 'Unknown doctor.' };

	const p = b.patient;
	const type = p.type === 'old' ? 'old' : 'new';
	const name = clean(p.name, 80);
	const phone = clean(p.phone, 10);
	const email = clean(p.email, 120);
	const age = Number(p.age);
	const gender = clean(p.gender, 10);
	if (name.length < 3) return { error: 'Please enter the patient name.' };
	if (!/^[6-9]\d{9}$/.test(phone)) return { error: 'Enter a valid 10-digit mobile number.' };
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };
	if (!Number.isInteger(age) || age < 0 || age > 120) return { error: 'Enter a valid age.' };
	if (!['Female', 'Male', 'Other'].includes(gender)) return { error: 'Please select a gender.' };

	// Optional paid add-ons: each id must exist for this doctor.
	const ids = Array.isArray(b.services) ? [...new Set(b.services.map((x) => clean(x, 40)))] : [];
	if (ids.length > 10) return { error: 'Too many services selected.' };
	const addons = [];
	for (const id of ids) {
		const a = (doc.addons || []).find((x) => x.id === id);
		if (!a) return { error: 'Unknown service selected.' };
		addons.push(a);
	}

	// OPD is Monday-Saturday 9 AM-7 PM (Sunday: emergency only). Date must be
	// today..today+14 (IST) and, for today, the slot must not have passed.
	const ist = istNow();
	const today = ist.toISOString().slice(0, 10);
	const max = new Date(ist.getTime() + 14 * 86400000).toISOString().slice(0, 10);
	const date = clean(b.date, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > max) return { error: 'Please choose a valid date.' };
	const m = /^(\d{1,2}):([0-5]\d) (AM|PM)$/.exec(clean(b.time, 8));
	if (!m || +m[1] < 1 || +m[1] > 12) return { error: 'Please choose a valid time.' };
	const time = m[1] + ':' + m[2] + ' ' + m[3];
	const slotMin = ((+m[1] % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2];
	if (new Date(date + 'T00:00:00Z').getUTCDay() === 0) return { error: 'OPD is closed on Sundays. Please pick another day.' };
	if (slotMin < 9 * 60 || slotMin >= 19 * 60) return { error: 'Please choose a time between 9 AM and 7 PM.' };
	if (date === today && slotMin <= ist.getUTCHours() * 60 + ist.getUTCMinutes()) {
		return { error: 'That time slot has already passed. Please pick another.' };
	}

	return {
		value: {
			doctor: b.doctor,
			specialty: clean(b.specialty, 60),
			date, time, type, name, phone, email, age, gender,
			reason: clean(p.reason, 200),
			addons
		},
		amountPaise: (doc.fees[type] + addons.reduce((sum, a) => sum + a.price, 0)) * 100
	};
};

const newBookingId = () => {
	const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	return 'NVY-' + Array.from(crypto.randomBytes(8), (x) => A[x % A.length]).join('');
};

const signatureOk = (orderId, paymentId, signature, secret) => {
	const expected = crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex');
	const a = Buffer.from(expected);
	const b = Buffer.from(String(signature || ''));
	return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { CATALOG, keys, razorpay, validateBooking, newBookingId, signatureOk };
