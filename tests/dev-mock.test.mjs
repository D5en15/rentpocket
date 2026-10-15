import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { calculateBill, defaultDueDate } from '../lib/billing/calculation.ts';
function load(mode) {
  const testModule = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL('../lib/dev/mock.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ module: testModule, exports: testModule.exports, process: { env: { NODE_ENV: mode } }, structuredClone, require(name) {
    if (name === 'server-only') return {};
    if (name === 'node:crypto') return { randomUUID };
    if (name === '@/lib/billing/calculation') return { calculateBill, defaultDueDate };
    throw new Error(`Unexpected mock dependency ${name}`);
  } });
  vm.runInContext(compiled, context);
  return testModule.exports;
}
test('mock data is inaccessible in production and test environments', () => {
  for (const mode of ['production', 'test']) { const mock = load(mode); assert.equal(mock.devMockEnabled(), false); assert.throws(() => mock.mockSetup(), /disabled/); }
});
test('development fixture supports meter warnings, issuing and manual collection without Supabase', () => {
  const mock = load('development'), setup = mock.mockSetup(), id = setup.properties[0].id;
  assert.equal(setup.usedRooms, 4);
  const cycle = mock.mockCycle(id, '2026-10');
  assert.equal(cycle.rooms.length, 4);
  const b = cycle.bills.find(b => b.status === 'DRAFT');
  const reading = { billId: b.id, expectedUpdatedAt: b.updated_at, dueDate: b.due_date, currentElectric: String(b.prev_electric_meter+400), currentWater: String(b.prev_water_meter+5), otherFees: '0', oldFinal: '0', newInitial: '0', isRollover: false, isReplaced: false, confirmWarning: false };
  assert.equal(mock.mockSaveMeters([reading]).code, 'SOFT_WARNING');
  assert.equal(mock.mockCycle(id, '2026-10').bills.find(x => x.id === b.id).status, 'DRAFT');
  assert.equal(mock.mockSaveMeters([{ ...reading, confirmWarning: true }]).ok, true);
  assert.equal(mock.mockDashboard('2026-10', id).find(x => x.id === b.id).total_amount, 6290);
  assert.equal(mock.mockPay(b.id, true).code, 'API_UNAVAILABLE');
  assert.equal(mock.mockPay(b.id, false).ok, true);
  assert.equal(mock.mockDashboard('2026-10', id).find(x => x.id === b.id).status, 'PAID');
  assert.equal(mock.mockPay(b.id, false).code, 'ALREADY_PAID');
});
test('development mock enforces duplicate rooms and total quota', () => {
  const mock = load('development'), id = mock.mockSetup().properties[0].id;
  assert.equal(mock.mockRooms(id, ['101'], 3000, 1).code, 'DUPLICATE_ROOM');
  assert.equal(mock.mockRooms(id, Array.from({ length: 47 }, (_, i) => String(i+200)), 3000, 1).code, 'QUOTA_EXCEEDED');
  assert.equal(mock.mockSetup().usedRooms, 4);
});
