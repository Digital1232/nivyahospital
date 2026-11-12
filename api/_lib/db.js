// Database access for the reception panel and online bookings.
// Uses Neon Postgres: connect a Neon database to the Vercel project (Storage tab)
// and Vercel adds DATABASE_URL automatically. Tables are created on first use.
const crypto = require('crypto');

let client = null; // async (text, params) => rows
let migrated = null;

const url = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

const getClient = () => {
	if (client) return client;
	if (!url()) return null;
	const { neon } = require('@neondatabase/serverless');
	const sql = neon(url());
	client = (text, params) => sql.query(text, params);
	return client;
};

// Tests swap in another Postgres (same query interface).
const setClient = (fn) => { client = fn; migrated = null; };

const configured = () => !!getClient();

const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value jsonb NOT NULL)`,
	`CREATE TABLE IF NOT EXISTS staff (
		id serial PRIMARY KEY,
		username text UNIQUE NOT NULL,
		name text NOT NULL,
		role text NOT NULL DEFAULT 'staff',
		pass_hash text NOT NULL,
		active boolean NOT NULL DEFAULT true,
		token_version int NOT NULL DEFAULT 1,
		created_at timestamptz NOT NULL DEFAULT now())`,
	`CREATE TABLE IF NOT EXISTS login_fail (key text PRIMARY KEY, count int NOT NULL, first_at timestamptz NOT NULL)`,
	`CREATE TABLE IF NOT EXISTS patients (
		id serial PRIMARY KEY,
		name text NOT NULL,
		name_key text NOT NULL,
		phone text NOT NULL,
		email text,
		age int,
		gender text,
		created_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE (phone, name_key))`,
	`CREATE TABLE IF NOT EXISTS appointments (
		id serial PRIMARY KEY,
		booking_id text UNIQUE NOT NULL,
		source text NOT NULL,
		patient_id int REFERENCES patients(id),
		doctor text NOT NULL,
		date text NOT NULL,
		time text,
		time_min int,
		visit_type text NOT NULL DEFAULT 'new',
		reason text,
		services jsonb NOT NULL DEFAULT '[]',
		amount_paise int NOT NULL DEFAULT 0,
		order_id text,
		payment_id text,
		status text NOT NULL,
		token_no int,
		arrived_at timestamptz,
		started_at timestamptz,
		completed_at timestamptz,
		notes text,
		created_by text,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now())`,
	`CREATE INDEX IF NOT EXISTS appointments_day ON appointments (date, doctor)`,
	`CREATE TABLE IF NOT EXISTS token_counters (date text NOT NULL, doctor text NOT NULL, last int NOT NULL, PRIMARY KEY (date, doctor))`,
	`CREATE TABLE IF NOT EXISTS pending_orders (order_id text PRIMARY KEY, booking jsonb NOT NULL, amount_paise int NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
	`CREATE TABLE IF NOT EXISTS doctor_schedule (
		doctor text PRIMARY KEY,
		days int[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
		start_min int NOT NULL DEFAULT 540,
		end_min int NOT NULL DEFAULT 1140,
		capacity int,
		online boolean NOT NULL DEFAULT true,
		note text)`,
	`CREATE TABLE IF NOT EXISTS doctor_leave (id serial PRIMARY KEY, doctor text NOT NULL, date text NOT NULL, reason text, UNIQUE (doctor, date))`,
	`CREATE TABLE IF NOT EXISTS audit_log (id serial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, appointment_id int, detail jsonb, at timestamptz NOT NULL DEFAULT now())`
];

const migrate = (c) => {
	if (!migrated) {
		migrated = (async () => {
			for (const s of SCHEMA) await c(s, []);
			// Random secret for signing staff login sessions, created once per database.
			await c(`INSERT INTO settings (key, value) VALUES ('session_secret', $1) ON CONFLICT (key) DO NOTHING`,
				[JSON.stringify(crypto.randomBytes(32).toString('hex'))]);
		})().catch((e) => { migrated = null; throw e; });
	}
	return migrated;
};

const q = async (text, params = []) => {
	const c = getClient();
	if (!c) throw new Error('Database is not connected.');
	await migrate(c);
	return c(text, params);
};

const one = async (text, params) => (await q(text, params))[0] || null;

module.exports = { q, one, configured, setClient };
