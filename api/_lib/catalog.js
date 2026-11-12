// Booking settings per doctor (fees, booking type, time slots, OP hours text, paid services).
// assets/js/booking-catalog.json holds the defaults; changes saved from the reception panel
// (Booking tab) are stored in the database and win over the file. The booking page, the
// doctor cards and the payment API all read the merged result, so they never disagree.
const STATIC = require('../../assets/js/booking-catalog.json');
const db = require('./db');

const DOCTORS = Object.keys(STATIC.doctors);
const KEY = 'booking_doctors';

const merge = (overrides) => {
	const doctors = {};
	for (const name of DOCTORS) {
		const base = STATIC.doctors[name];
		const o = (overrides && overrides[name]) || null;
		if (!o) { doctors[name] = base; continue; }
		const d = { speciality: base.speciality, avatar: base.avatar };
		if (o.bookingMode === 'request') d.bookingMode = 'request';
		if (o.feeStatus === 'pending') d.feeStatus = 'pending';
		d.fees = { new: o.fees ? o.fees.new : null, old: o.fees ? o.fees.old : null };
		if (o.opHours) d.opHours = o.opHours;
		if (Array.isArray(o.bookingSessions) && o.bookingSessions.length) {
			d.bookingSessions = o.bookingSessions;
			d.calendarMinutes = base.calendarMinutes || 30;
		}
		d.addons = Array.isArray(o.addons) ? o.addons : [];
		doctors[name] = d;
	}
	return { ...STATIC, doctors };
};

// Never throws: if the database is unreachable the file's settings are used.
const getCatalog = async () => {
	if (!db.configured()) return STATIC;
	try {
		const row = await db.one(`SELECT value FROM settings WHERE key = $1`, [KEY]);
		return merge(row && row.value);
	} catch (err) {
		console.error('catalog read failed:', err.message);
		return STATIC;
	}
};

const getOverrides = async () => {
	const row = await db.one(`SELECT value FROM settings WHERE key = $1`, [KEY]);
	return (row && row.value) || {};
};
const saveOverrides = (value) =>
	db.q(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [KEY, JSON.stringify(value)]);

module.exports = { STATIC, DOCTORS, getCatalog, getOverrides, saveOverrides, merge };
