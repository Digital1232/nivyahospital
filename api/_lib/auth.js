// Staff login for the reception panel.
// - The first admin signs in as "admin" with the RECEPTION_ADMIN_PASSWORD Vercel variable,
//   then creates staff accounts inside the panel.
// - Sessions are signed cookies (12 hours), readable only by the server.
const crypto = require('crypto');
const { q, one } = require('./db');

const COOKIE = 'nv_rs';
const SESSION_HOURS = 12;
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
const sign = async (payload) => {
	const body = b64(JSON.stringify(payload));
	const mac = crypto.createHmac('sha256', await secret()).update(body).digest('base64url');
	return body + '.' + mac;
};
const verify = async (token) => {
	const [body, mac] = String(token || '').split('.');
	if (!body || !mac) return null;
	const want = crypto.createHmac('sha256', await secret()).update(body).digest('base64url');
	if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
	let p;
	try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch (e) { return null; }
	return p && p.exp > Date.now() ? p : null;
};

const readCookie = (req) => {
	const raw = String((req.headers && req.headers.cookie) || '');
	const m = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
	return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : '';
};
const setCookie = (res, value, maxAge) => {
	res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
};

// Returns { user } or { error, status }.
const login = async (username, password) => {
	username = String(username || '').trim().toLowerCase();
	password = String(password || '');
	if (!username || !password) return { error: 'Enter username and password.', status: 400 };
	const key = 'u:' + username;
	const fail = await one(`SELECT count, first_at FROM login_fail WHERE key = $1`, [key]);
	const lockedUntil = fail ? new Date(fail.first_at).getTime() + LOCK_MINUTES * 60000 : 0;
	if (fail && fail.count >= MAX_FAILS && Date.now() < lockedUntil) {
		return { error: 'Too many wrong attempts. Try again in ' + LOCK_MINUTES + ' minutes.', status: 429 };
	}
	let user = null;
	if (username === 'admin') {
		if (adminEnv() && sameText(password, adminEnv())) user = { u: 'admin', name: 'Administrator', role: 'admin', v: adminVersion() };
	} else {
		const row = await one(`SELECT * FROM staff WHERE username = $1 AND active`, [username]);
		if (row && checkPassword(password, row.pass_hash)) user = { u: row.username, name: row.name, role: row.role, v: row.token_version };
	}
	if (!user) {
		await q(`INSERT INTO login_fail (key, count, first_at) VALUES ($1, 1, now())
			ON CONFLICT (key) DO UPDATE SET
				count = CASE WHEN login_fail.first_at < now() - interval '${LOCK_MINUTES} minutes' THEN 1 ELSE login_fail.count + 1 END,
				first_at = CASE WHEN login_fail.first_at < now() - interval '${LOCK_MINUTES} minutes' THEN now() ELSE login_fail.first_at END`, [key]);
		if (!adminEnv() && username === 'admin') return { error: 'Admin password is not set up yet (RECEPTION_ADMIN_PASSWORD in Vercel).', status: 401 };
		return { error: 'Wrong username or password.', status: 401 };
	}
	await q(`DELETE FROM login_fail WHERE key = $1`, [key]);
	return { user };
};

const startSession = async (res, user) => {
	const token = await sign({ ...user, exp: Date.now() + SESSION_HOURS * 3600000 });
	setCookie(res, token, SESSION_HOURS * 3600);
};
const endSession = (res) => setCookie(res, '', 0);

// Current user from the cookie, re-checked against the database (disabled staff are signed out).
const currentUser = async (req) => {
	const p = await verify(readCookie(req));
	if (!p) return null;
	if (p.u === 'admin') return adminEnv() && p.v === adminVersion() ? p : null;
	const row = await one(`SELECT username, name, role, token_version FROM staff WHERE username = $1 AND active`, [p.u]);
	return row && row.token_version === p.v ? { u: row.username, name: row.name, role: row.role, v: row.token_version } : null;
};

module.exports = { hashPassword, checkPassword, login, startSession, endSession, currentUser };
