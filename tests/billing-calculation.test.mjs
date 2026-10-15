import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBill, defaultDueDate, hundredths, previousCycle, signedHundredths, validDate } from '../lib/billing/calculation.ts';

const context = { previousElectric: 100, previousWater: 20, previousElectricUnits: 100, electricRate: 8, waterRate: 18, waterType: 'PER_UNIT', baseRent: 3000 };
const input = { currentElectric: '200', currentWater: '25', isRollover: false, isReplaced: false, carryUnits: '0', otherFees: '50' };
function calculate(c = {}, i = {}) {
  const result = calculateBill({ ...context, ...c }, { ...input, ...i });
  assert.equal(result.ok, true, result.ok ? '' : result.message);
  return result.data;
}
test('normal reading includes rent, electricity, water and other charges', () => {
  const result = calculate();
  assert.equal(result.electricUnits, 100);
  assert.equal(result.waterUnits, 5);
  assert.equal(result.electricAmount, 800);
  assert.equal(result.waterAmount, 90);
  assert.equal(result.totalAmount, 3940);
  assert.equal(result.softWarning, false);
});
test('rollover 9998 -> 0015 uses exactly 17 units', () => {
  assert.equal(calculate({ previousElectric: 9998 }, { currentElectric: '0015', isRollover: true }).electricUnits, 17);
  assert.equal(calculateBill({ ...context, previousElectric: 10000 }, { ...input, isRollover: true }).ok, false);
  assert.equal(calculateBill(context, { ...input, currentElectric: '10000', isRollover: true }).ok, false);
});
test('replacement uses carry + current, including a nonzero new initial reading', () => {
  assert.equal(calculate({}, { isReplaced: true, carryUnits: '10', currentElectric: '5' }).electricUnits, 15);
  // Old final 110 - old previous 100 - new initial 50 = carry -40.
  // New current 55 then contributes 5 units, combined with old 10 = 15.
  assert.equal(calculate({}, { isReplaced: true, carryUnits: '-40', currentElectric: '55' }).electricUnits, 15);
  assert.equal(calculateBill(context, { ...input, isReplaced: true, carryUnits: '-250' }).ok, false);
});
test('flat water rate never requires or bills a water meter difference', () => {
  const result = calculate({ waterType: 'FLAT_RATE', waterRate: 150 }, { currentWater: '' });
  assert.equal(result.waterUnits, 0);
  assert.equal(result.waterAmount, 150);
  assert.equal(result.totalAmount, 4000);
});
test('decreasing meters and contradictory modes are rejected', () => {
  for (const patch of [{ currentElectric: '99' }, { currentWater: '19' }, { isRollover: true, isReplaced: true }]) {
    assert.equal(calculateBill(context, { ...input, ...patch }).ok, false);
  }
});
test('warning threshold is strict: >3x OR >500, including a real zero-usage prior month', () => {
  assert.equal(calculate({}, { currentElectric: '400' }).softWarning, false);
  assert.equal(calculate({}, { currentElectric: '400.01' }).softWarning, true);
  assert.equal(calculate({ previousElectricUnits: 200 }, { currentElectric: '600' }).softWarning, false);
  assert.equal(calculate({ previousElectricUnits: 200 }, { currentElectric: '600.01' }).softWarning, true);
  assert.equal(calculate({ previousElectricUnits: 0 }, { currentElectric: '100' }).softWarning, false);
  assert.equal(calculate({ previousElectricUnits: 0 }, { currentElectric: '100.01' }).softWarning, true);
  assert.equal(calculate({ previousElectricUnits: null }, { currentElectric: '200' }).softWarning, false);
  assert.equal(calculate({ previousElectricUnits: null }, { currentElectric: '601' }).softWarning, true);
});
test('decimal comma and decimal dot produce identical exact half-up charges', () => {
  const result = calculate({ previousElectric: '0', electricRate: '0.10', waterType: 'FLAT_RATE', waterRate: '0', baseRent: '0' }, { currentElectric: '0,05', otherFees: '0' });
  assert.equal(result.electricAmount, 0.01);
  assert.equal(result.totalAmount, 0.01);
  assert.equal(hundredths('0015,25'), BigInt(1525));
  assert.equal(signedHundredths('-40,25'), BigInt(-4025));
});
test('invalid inputs and numeric overflow never produce a payable total', () => {
  for (const value of ['', '1e3', '-1', '1.001', 'NaN', 'Infinity', '1,2.3']) assert.equal(calculateBill(context, { ...input, currentElectric: value }).ok, false);
  assert.equal(calculateBill({ ...context, electricRate: '99999999.99' }, input).ok, false);
  assert.equal(calculateBill(context, { ...input, otherFees: '-5' }).ok, false);
});
test('calendar handles January, December, leap days and malformed months', () => {
  assert.equal(previousCycle('2026-01'), '2025-12');
  assert.equal(previousCycle('2026-10'), '2026-09');
  assert.equal(defaultDueDate('2026-12'), '2027-01-05');
  assert.equal(defaultDueDate('2026-10'), '2026-11-05');
  for (const cycle of ['2026-13', '2026-00', '2026-1', '1899-12']) assert.equal(previousCycle(cycle), null);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2026-10-32'), false);
});
