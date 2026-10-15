// Explicit opt-in: requires an administrative connection to disposable staging.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

test('migration 005 enforces date bounds, replacement readings and privileges', async () => {
  assert.ok(process.env.QA_DB_URL, 'Set QA_DB_URL to a migrated staging database');
  const db = new pg.Client({ connectionString: process.env.QA_DB_URL, ssl: { rejectUnauthorized: true } });
  await db.connect();
  try {
    await db.query('BEGIN');
    // UTC session ensures the RPC cannot accidentally rely on session timezone.
    await db.query("SET LOCAL TIME ZONE 'UTC'");
    const owner = randomUUID(), property = randomUUID(), room = randomUUID();
    const { rows: [cycles] } = await db.query(`SELECT
      to_char(m - interval '13 months','YYYY-MM') AS too_old,
      to_char(m - interval '12 months','YYYY-MM') AS oldest,
      to_char(m - interval '1 month','YYYY-MM') AS previous,
      to_char(m,'YYYY-MM') AS current,
      to_char(m + interval '1 month','YYYY-MM') AS newest,
      to_char(m + interval '2 months','YYYY-MM') AS too_new
      FROM (SELECT date_trunc('month',now() AT TIME ZONE 'Asia/Bangkok') AS m) dates`);
    await db.query(`INSERT INTO auth.users(id,email,raw_user_meta_data,created_at)
      VALUES ($1,$2,'{"full_name":"QA fixture"}',now())`, [owner, `qa-${owner}@example.invalid`]);
    await db.query(`INSERT INTO public.properties(id,user_id,name,promptpay_id,promptpay_name)
      VALUES ($1,$2,'QA fixture','0812345678','QA fixture')`, [property, owner]);
    await db.query(`INSERT INTO public.rooms(id,property_id,room_number,base_rent,electric_rate,water_rate,water_billing_type)
      VALUES ($1,$2,'QA-1',3000,8,0,'FLAT_RATE')`, [room, property]);
    await db.query(`INSERT INTO public.bills(property_id,room_id,billing_cycle,
      curr_electric_meter,base_rent,total_amount,due_date,electric_rate,water_rate,water_billing_type,status)
      VALUES ($1,$2,$3,100,3000,3000,current_date,8,0,'FLAT_RATE','PENDING_PAYMENT')`,
    [property, room, cycles.previous]);
    // Historical read must not insert a missing room's draft into this cycle.
    await db.query(`INSERT INTO public.bills(property_id,room_id,billing_cycle,
      base_rent,total_amount,due_date,electric_rate,water_rate,water_billing_type)
      VALUES ($1,$2,$3,3000,3000,current_date,8,0,'FLAT_RATE')`, [property, room, cycles.too_old]);
    await db.query(`INSERT INTO public.rooms(property_id,room_number,base_rent,electric_rate,water_rate,water_billing_type)
      VALUES ($1,'QA-2',3000,8,0,'FLAT_RATE')`, [property]);
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['profiles', 'properties', 'rooms']) {
        const { rows: [privilege] } = await db.query('SELECT has_table_privilege($1,$2,\'DELETE\') AS allowed', [role, `public.${table}`]);
        assert.equal(privilege.allowed, false);
      }
    }
    assert.equal((await db.query(`SELECT has_function_privilege('anon',
      'public.is_property_owner(uuid)','EXECUTE') AS allowed`)).rows[0].allowed, false);
    const helper = await db.query(`SELECT proconfig FROM pg_proc WHERE oid='public.is_property_owner(uuid)'::regprocedure`);
    assert.ok(helper.rows[0].proconfig.includes('search_path=""'));
    await db.query('SET LOCAL ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)",
      [owner, JSON.stringify({ sub: owner, role: 'authenticated' })]);
    const rpcCycle = async cycle => (await db.query('SELECT public.get_or_create_billing_cycle($1,$2) AS data', [property, cycle])).rows[0].data;
    const historical = await rpcCycle(cycles.too_old);
    assert.equal(historical.bills.length, 1);
    assert.equal(historical.rooms.length, 2);
    assert.equal((await rpcCycle(cycles.oldest)).bills.length, 2);
    assert.equal((await rpcCycle(cycles.newest)).bills.length, 2);
    async function rejects(query, params, code) {
      await db.query('SAVEPOINT rejected_input');
      await assert.rejects(db.query(query, params), error => error.code === 'P0001' && error.message.includes(code));
      await db.query('ROLLBACK TO SAVEPOINT rejected_input');
    }
    // Use another property-free historical month: the seeded old cycle is readable.
    await rejects('SELECT public.get_or_create_billing_cycle($1,$2)', [property, cycles.too_new], 'BILLING_CYCLE_OUT_OF_RANGE');
    const older = (await db.query(`SELECT to_char(to_date($1 || '-01','YYYY-MM-DD') - interval '1 month','YYYY-MM') AS cycle`, [cycles.too_old])).rows[0].cycle;
    await rejects('SELECT public.get_or_create_billing_cycle($1,$2)', [property, older], 'BILLING_CYCLE_OUT_OF_RANGE');
    const current = await rpcCycle(cycles.current);
    const bill = current.bills.find(item => item.room_id === room);
    const reading = { billId: bill.id, expectedUpdatedAt: bill.updated_at, dueDate: bill.due_date,
      current: '55', currentWater: '', old_final: '110', new_initial: '50',
      otherFees: '0', isReplaced: true, isRollover: false, confirmWarning: true, carryUnits: '999999' };
    for (const patch of [{ old_final: '99' }, { current: '49' }]) {
      await rejects('SELECT public.save_meter_readings($1::jsonb)', [JSON.stringify([{ ...reading, ...patch }])], 'INVALID_REPLACEMENT');
    }
    const { old_final: removedOld, new_initial: removedInitial, ...legacy } = reading;
    assert.ok(removedOld && removedInitial);
    await rejects('SELECT public.save_meter_readings($1::jsonb)', [JSON.stringify([legacy])], 'INVALID_INPUT');
    const saved = await db.query('SELECT public.save_meter_readings($1::jsonb) AS result', [JSON.stringify([reading])]);
    assert.equal(saved.rows[0].result.ok, true);
    const result = (await db.query('SELECT electric_units,total_amount,replaced_meter_carry_units FROM public.bills WHERE id=$1', [bill.id])).rows[0];
    assert.equal(Number(result.electric_units), 15);
    assert.equal(Number(result.total_amount), 3120);
    assert.equal(Number(result.replaced_meter_carry_units), -40);

    // Seed the daily boundary as admin; failed reservations still consume quota.
    await db.query('RESET ROLE');
    const secondBill = current.bills.find(item => item.room_id !== room);
    await db.query("UPDATE public.bills SET status='PENDING_PAYMENT' WHERE id=$1", [secondBill.id]);
    await db.query(`INSERT INTO public.slip_daily_usage(property_id,verify_day,verify_count)
      VALUES ($1,(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date - 1,15),
             ($1,(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date,14)`, [property]);
    const otherProperty = randomUUID(), otherRoom = randomUUID(), otherBill = randomUUID();
    await db.query(`INSERT INTO public.properties(id,user_id,name,promptpay_id,promptpay_name)
      VALUES ($1,$2,'QA other property','0812345678','QA fixture')`, [otherProperty, owner]);
    await db.query(`INSERT INTO public.rooms(id,property_id,room_number,base_rent,electric_rate,water_rate,water_billing_type)
      VALUES ($1,$2,'QA-other',3000,8,0,'FLAT_RATE')`, [otherRoom, otherProperty]);
    await db.query(`INSERT INTO public.bills(id,property_id,room_id,billing_cycle,
      base_rent,total_amount,due_date,electric_rate,water_rate,water_billing_type,status)
      VALUES ($1,$2,$3,$4,3000,3000,current_date,8,0,'FLAT_RATE','PENDING_PAYMENT')`,
    [otherBill, otherProperty, otherRoom, cycles.current]);
    await db.query('SET LOCAL ROLE authenticated');
    const fifteenth = await db.query('SELECT public.reserve_slip_verification($1) AS data', [bill.id]);
    assert.ok(fifteenth.rows[0].data.attempt_id);
    await db.query('RESET ROLE');
    await db.query('SELECT public.fail_slip_verification($1,$2)', [fifteenth.rows[0].data.attempt_id, owner]);
    await db.query('SET LOCAL ROLE authenticated');
    await rejects('SELECT public.reserve_slip_verification($1)', [secondBill.id], 'DAILY_VERIFY_LIMIT_EXCEEDED');
    // Failed daily reservations must not use the second bill's three-attempt quota.
    assert.equal((await db.query('SELECT slip_verify_count FROM public.bills WHERE id=$1', [secondBill.id])).rows[0].slip_verify_count, 0);
    await db.query('SELECT public.mark_bill_manual_paid($1)', [secondBill.id]);
    assert.equal((await db.query('SELECT status FROM public.bills WHERE id=$1', [secondBill.id])).rows[0].status, 'PAID');
    // Same owner, different property: a full property cannot consume this quota.
    const independent = await db.query('SELECT public.reserve_slip_verification($1) AS data', [otherBill]);
    assert.ok(independent.rows[0].data.attempt_id);
    assert.equal((await db.query(`SELECT has_table_privilege(current_user,
      'public.slip_daily_usage','UPDATE') AS allowed`)).rows[0].allowed, false);
    await db.query('RESET ROLE');
    const daily = await db.query(`SELECT verify_count FROM public.slip_daily_usage
      WHERE property_id=$1 AND verify_day=(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date`, [property]);
    assert.equal(daily.rows[0].verify_count, 15);
  } finally {
    try { await db.query('ROLLBACK'); } finally { await db.end(); }
  }
});
