import test from 'node:test';
import assert from 'node:assert/strict';
import { thaiCycle, thaiDueDate, cycleChoices } from '../lib/dashboard/dates.ts';
test('billing dates use deterministic Thai month names and Buddhist years', () => {
  assert.equal(thaiCycle('2026-10'), 'ตุลาคม 2569');
  assert.equal(thaiCycle('2026-10',true), 'ต.ค. 69');
  assert.equal(thaiDueDate('2026-11-05'), '5 พ.ย. 69');
  assert.equal(thaiCycle('2026-13'), 'ไม่ระบุรอบบิล');
});
test('cycle choices cross year boundaries and retain a selected historical month', () => {
  const choices = cycleChoices('2026-12','2020-01');
  assert.equal(choices[0], '2027-01');
  assert.ok(choices.includes('2024-12'));
  assert.ok(choices.includes('2020-01'));
  assert.equal(new Set(choices).size, choices.length);
});
