// Run only against a disposable staging database with two seeded owners/bills.
// Deliberately excluded from the default *.test.mjs unit-test command.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

test('owner isolation and trusted payment RPC privileges', async () => {
  const required = ['QA_DB_URL', 'QA_OWNER_A_ID', 'QA_BILL_A_ID', 'QA_BILL_B_ID'];
  for (const name of required) assert.ok(process.env[name], `Missing ${name}`);
  const db = new pg.Client({
    connectionString: process.env.QA_DB_URL,
    ssl: { rejectUnauthorized: true },
  });
  await db.connect();
  try {
    await db.query('BEGIN');
    // QA_DB_URL must be a staging administrative session, never an app secret.
    const privilege = await db.query(`SELECT
      has_function_privilege('authenticated',
        'public.complete_slip_payment(uuid,uuid,text,numeric,timestamptz,text,text,jsonb)',
        'EXECUTE') AS browser_can_complete,
      has_function_privilege('anon',
        'public.complete_slip_payment(uuid,uuid,text,numeric,timestamptz,text,text,jsonb)',
        'EXECUTE') AS anonymous_can_complete`);
    assert.equal(privilege.rows[0].browser_can_complete, false);
    assert.equal(privilege.rows[0].anonymous_can_complete, false);
    // Confirm both fixtures really exist and belong to different owners.
    const fixtures = await db.query(`SELECT b.id, p.user_id FROM public.bills b
      JOIN public.properties p ON p.id=b.property_id WHERE b.id IN ($1,$2)`,
    [process.env.QA_BILL_A_ID, process.env.QA_BILL_B_ID]);
    assert.equal(fixtures.rowCount, 2);
    const own = fixtures.rows.find(row => row.id === process.env.QA_BILL_A_ID);
    const other = fixtures.rows.find(row => row.id === process.env.QA_BILL_B_ID);
    assert.equal(own.user_id, process.env.QA_OWNER_A_ID);
    assert.notEqual(other.user_id, own.user_id);
    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [own.user_id]);
    await db.query("SELECT set_config('request.jwt.claims',$1,true)",
      [JSON.stringify({ sub: own.user_id, role: 'authenticated' })]);
    const visible = await db.query('SELECT id FROM public.bills WHERE id IN ($1,$2)',
      [own.id, other.id]);
    assert.deepEqual(visible.rows.map(row => row.id), [own.id]);
    await db.query('SAVEPOINT forbidden_payment');
    await assert.rejects(
      db.query('SELECT public.mark_bill_manual_paid($1)', [other.id]),
      error => error.code === 'P0001' && error.message.includes('FORBIDDEN'),
    );
    await db.query('ROLLBACK TO SAVEPOINT forbidden_payment');
    assert.equal((await db.query(`SELECT has_table_privilege(current_user,
      'public.bills','UPDATE') AS can_update`)).rows[0].can_update, false);
  } finally {
    try { await db.query('ROLLBACK'); } finally { await db.end(); }
  }
});
