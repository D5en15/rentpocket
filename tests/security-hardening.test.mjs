import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMeterReadings } from '../lib/billing/submission.ts';
import { slipUploadFile } from '../lib/slip/image.ts';

const reading = {
  billId: '00000000-0000-4000-8000-000000000001',
  expectedUpdatedAt: '2026-10-07T00:00:00Z', dueDate: '2026-11-05',
  isReplaced: true, isRollover: false, confirmWarning: false,
  currentElectric: '55,25', currentWater: '', oldFinal: '110', newInitial: '50', otherFees: '0',
};
test('replacement submission sends raw readings and strips forged carry and totals', () => {
  const [payload] = normalizeMeterReadings({ ...reading, carryUnits: '9999', totalAmount: 1 });
  assert.equal(payload.current, '55.25');
  assert.equal(payload.old_final, '110');
  assert.equal(payload.new_initial, '50');
  assert.equal('carryUnits' in payload, false);
  assert.equal('totalAmount' in payload, false);
});
test('replacement requires raw readings and rejects current below new initial', () => {
  for (const patch of [{ oldFinal: undefined }, { newInitial: undefined },
    { oldFinal: '-1' }, { newInitial: '1e3' }, { currentElectric: '49' }]) {
    assert.equal(normalizeMeterReadings({ ...reading, ...patch }), null);
  }
});
test('malformed actions and duplicated bill IDs fail without exceptions', () => {
  for (const value of [null, 1, '', [], [reading, reading], { ...reading, dueDate: null },
    { ...reading, isRollover: true }, Array(101).fill(reading)]) {
    assert.equal(normalizeMeterReadings(value), null);
  }
  assert.equal(normalizeMeterReadings({ ...reading, isReplaced: false, oldFinal: undefined, newInitial: undefined })[0].old_final, '0');
});
test('slip ingress accepts a single bounded FormData file and rejects Base64', () => {
  const form = new FormData();
  form.set('image', new File(['image'], 'slip.png', { type: 'image/png' }));
  assert.equal(slipUploadFile(form).size, 5);
  const invalid = error => error.code === 'INVALID_INPUT';
  for (const input of ['data:image/png;base64,aGVsbG8=', null, new FormData()]) {
    assert.throws(() => slipUploadFile(input), invalid);
  }
  form.append('extra', 'unbounded data');
  assert.throws(() => slipUploadFile(form), invalid);
  form.delete('extra');
  form.set('image', new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'slip.png'));
  assert.throws(() => slipUploadFile(form), invalid);
});
