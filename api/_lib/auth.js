// Staff login for the reception panel.
// - The first admin signs in as "admin" with the RECEPTION_ADMIN_PASSWORD Vercel variable,
//   then creates staff accounts inside the panel.
// - Sessions are signed cookies (12 hours), readable only by the server.
const crypto = require('crypto');
const { q, one } = require('./db');

const COOKIE = 'nv_rs';
const DEVICE_COOKIE = 'nv_dv'; // marks a browser that has signed in before; it does not log anyone in
const SESSION_HOURS = 12;
const DEVICE_DAYS = 90;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const hashPassword = (pw) => {
	const salt = crypto.randomBytes(16);
	const key = crypto.scryptSync(String(pw), salt, 64);
	return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
};
const checkPassword = (pw, stored) => {
	const [kind, salt, key] = String(stored || '').split('$');
	if (kind !== 'scrypt' || !salt || !key) return false;
	const a = crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 64);
	const b = Buffer.from(key, 'hex');
	return a.length === b.length && crypto.timingSafeEqual(a, b);
};
// Checked against when the username does not exist, so a wrong username takes as long to refuse
// as a wrong password and the reply time does not tell which usernames exist. Nobody knows its password.
const NO_USER_HASH = 'scrypt$5ac1c086d9a0c58e80a16f507ab6c10a$4382c429b767d5c03fdeae9c28bc4e4a2cb8ae5bf57ea01e56a1eaa6689483b1bd24356eb2c0d9b5a5c6bbf8f3a12afea1331b97f8ec345dad4edaca5651de60';
const sameText = (a, b) => {
	const x = crypto.createHash('sha256').update(String(a)).digest();
	const y = crypto.createHash('sha256').update(String(b)).digest();
	return crypto.timingSafeEqual(x, y);
};

const adminEnv = () => String(process.env.RECEPTION_ADMIN_PASSWORD || '').trim();
// Changing the env password signs out existing admin sessions.
const adminVersion = () => crypto.createHash('sha256').update('v:' + adminEnv()).digest('hex').slice(0, 12);

const secret = async () => (await one(`SELECT value FROM settings WHERE key = 'session_secret'`)).value;
const b64 = (s) => Buffer.from(s).toString('base64url');
// `purpose` keeps a device token from ever being accepted as a session token, and the reverse.
const sign = async (payload, purpose = '') => {
	const body = b64(JSON.stringify(payload));
	const mac = crypto.createHmac('sha256', await secret()).update(purpose + body).digest('base64url');
	return body + '.' + mac;
};
const verify = async (token, purpose = '') => {
	const [body, mac] = String(token || '').split('.');
	if (!body || !mac) return null;
	const want = crypto.createHmac('sha256', await secret()).update(purpose + body).digest('base64url');
	if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
	let p;
	try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch (e) { return null; }
	return p && p.exp > Date.now() ? p : null;
};

const readCookie = (req, name = COOKIE) => {
	const raw = String((req && req.headers && req.headers.cookie) || '');
	const m = raw.split(/;\s*/).find((c) => c.startsWith(name + '='));
	if (!m) return '';
	try { return decodeURIComponent(m.slice(name.length + 1)); } catch (e) { return ''; }
};
const cookieLine = (name, value, maxAge) =>
	`${name}=${encodeURIComponent(value)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

const readDevice = async (req) => {
	const p = await verify(readCookie(req, DEVICE_COOKIE), 'device:');
	return p && p.id && Array.isArray(p.users) ? p : null;
};

// Counts one use of `key` in a fixed time window and returns the count so far. The count is taken
// before the work is done, so requests sent at the same moment cannot all slip under a limit.
const hitLimit = async (key, minutes) => (await one(`INSERT INTO login_fail (key, count, first_at) VALUES ($1, 1, now())
	ON CONFLICT (key) DO UPDATE SET
		count = CASE WHEN login_fail.first_at < now() - make_interval(mins => $2::int) THEN 1 ELSE login_fail.count + 1 END,
		first_at = CASE WHEN login_fail.first_at < now() - make_interval(mins => $2::int) THEN now() ELSE login_fail.first_at END
	RETURNING count`, [key, minutes])).count;

// Returns { user, device } or { error, status }.
const login = async (username, password, req) => {
	username = String(username || '').trim().toLowerCase();
	password = String(password || '');
	if (!username || !password) return { error: 'Enter username and password.', status: 400 };
	// A browser that has signed in to this account before has its own counter, so wrong guesses
	// from anywhere else cannot lock the real person out.
	const device = await readDevice(req);
	const known = !!device && device.users.includes(username);
	const key = known ? 'd:' + device.id + ':' + username : 'u:' + username;
	if ((await hitLimit(key, LOCK_MINUTES)) > MAX_FAILS) {
		return { error: 'Too many wrong attempts. Try again in ' + LOCK_MINUTES + ' minutes.', status: 429 };
	}
	let user = null;
	if (username === 'admin') {
		if (adminEnv() && sameText(password, adminEnv())) user = { u: 'admin', name: 'Administrator', role: 'admin', v: adminVersion() };
	} else {
		const row = await one(`SELECT * FROM staff WHERE username = $1 AND active`, [username]);
		const ok = checkPassword(password, row ? row.pass_hash : NO_USER_HASH);
		if (row && ok) user = { u: row.username, name: row.name, role: row.role, v: row.token_version };
	}
	if (!user) {
		if (!adminEnv() && username === 'admin') return { error: 'Admin password is not set up yet (RECEPTION_ADMIN_PASSWORD in Vercel).', status: 401 };
		return { error: 'Wrong username or password.', status: 401 };
	}
	// Give back this attempt. The shared counter is not wiped, so a real sign-in does not hand
	// someone guessing at the same time a fresh set of tries.
	if (known) await q(`DELETE FROM login_fail WHERE key = $1`, [key]);
	else await q(`UPDATE login_fail SET count = GREATEST(count - 1, 0) WHERE key = $1`, [key]);
	const users = [...new Set([username, ...(device ? device.users : [])])].slice(0, 8);
	return { user, device: { id: device ? device.id : crypto.randomBytes(9).toString('base64url'), users } };
};

const startSession = async (res, user, device) => {
	const token = await sign({ ...user, exp: Date.now() + SESSION_HOURS * 3600000 });
	const lines = [cookieLine(COOKIE, token, SESSION_HOURS * 3600)];
	if (device) {
		const deviceToken = await sign({ ...device, exp: Date.now() + DEVICE_DAYS * 86400000 }, 'device:');
		lines.push(cookieLine(DEVICE_COOKIE, deviceToken, DEVICE_DAYS * 86400));
	}
	res.setHeader('Set-Cookie', lines);
};
// Signed-out sessions are kept (as a hash, until they would have expired anyway), so a copy of the
// cookie stops working at sign-out instead of lasting the full 12 hours.
const sessionKey = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const endSession = async (req, res) => {
	const token = readCookie(req);
	const p = token ? await verify(token) : null;
	if (p) {
		await q(`DELETE FROM revoked_sessions WHERE expires_at < now()`);
		await q(`INSERT INTO revoked_sessions (token_key, expires_at) VALUES ($1, to_timestamp($2::double precision / 1000))
			ON CONFLICT (token_key) DO NOTHING`, [sessionKey(token), p.exp]);
	}
	// Cleared only once the sign-out is recorded, so after a failure the person can simply try again.
	res.setHeader('Set-Cookie', cookieLine(COOKIE, '', 0));
};

// Current user from the cookie, re-checked against the database (disabled or signed-out sessions are refused).
const currentUser = async (req) => {
	const token = readCookie(req);
	const p = await verify(token);
	if (!p) return null;
	const key = sessionKey(token);
	if (p.u === 'admin') {
		if (!adminEnv() || p.v !== adminVersion()) return null;
		return (await one(`SELECT 1 AS x FROM revoked_sessions WHERE token_key = $1`, [key])) ? null : p;
	}
	const row = await one(`SELECT username, name, role, token_version FROM staff WHERE username = $1 AND active
		AND NOT EXISTS (SELECT 1 FROM revoked_sessions WHERE token_key = $2)`, [p.u, key]);
	return row && row.token_version === p.v ? { u: row.username, name: row.name, role: row.role, v: row.token_version } : null;
};

module.exports = { hashPassword, checkPassword, login, startSession, endSession, currentUser, hitLimit };
