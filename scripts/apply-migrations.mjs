import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error('SUPABASE_DB_URL is required to apply migrations');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true } });
try {
  await client.connect();
  await client.query('SELECT pg_advisory_lock(20261006)');
  await client.query('CREATE SCHEMA IF NOT EXISTS rentpocket_migrations');
  await client.query('CREATE TABLE IF NOT EXISTS rentpocket_migrations.applied (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const names = ['202610060000_initial_schema.sql', '202610060001_auth_profile_trial.sql', '202610060002_fix_quota_trigger.sql', '202610060003_meter_billing.sql', '202610060004_slip_payments.sql', '202610060005_qa_security_hardening.sql', '202610060006_slip_daily_limit.sql'];
  for (const name of names) {
    const { rows } = await client.query('SELECT name FROM rentpocket_migrations.applied WHERE name=$1', [name]);
    if (rows.length) continue;
    if (name === names[0]) {
      const existing = await client.query("SELECT to_regclass('public.profiles') AS profiles");
      if (existing.rows[0].profiles) throw new Error('Existing schema found without migration history; reconcile initial schema before applying migrations');
    }
    const sql = await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql.replace(/^BEGIN;\s*/i, '').replace(/COMMIT;\s*$/i, ''));
      await client.query('INSERT INTO rentpocket_migrations.applied(name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log('Applied', name);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} finally { await client.end(); }
