import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { accountDigits, moneyCents, normalizedPhone, receiverAccountFromConfig, requestEasySlip, validateEasySlipResponse } from '../lib/slip/easyslip.ts';
import { paymentError } from '../lib/slip/errors.ts';
import { slipImageDataUri } from '../lib/slip/image.ts';
import { SlipError } from '../lib/slip/types.ts';

// Synthetic provider fixtures are confined to tests. No production bypass exists.
function fixture() {
  return { success: true, data: { isDuplicate: false, amountInSlip: 1500.25, isAmountMatched: true, matchedAccount: null,
    rawSlip: { transRef: 'test-transaction-001', date: '2026-01-15T14:30:00+07:00', countryCode: 'TH', amount: { amount: 1500.25, local: { currency: 'THB' } },
      sender: { bank: { id: '004' } }, receiver: { bank: { id: '014' }, account: { proxy: { type: 'MSISDN', account: '0812345678' }, bank: { type: 'BANKAC', account: 'xxx-x-x5678-x' } } } } } };
}
function fails(code, fn) { assert.throws(fn,error => error instanceof SlipError && error.code === code); }
test('verified exact amount and unmasked recipient produce a transaction', () => {
  const result = validateEasySlipResponse(fixture(),1500.25,'0812345678');
  assert.equal(result.amount,'1500.25'); assert.equal(result.receiverAccount,'0812345678'); assert.equal(result.senderBank,'004');
});
test('international MSISDN is normalized to the same exact Thai phone', () => {
  for (const phone of ['+66 81 234 5678','0066812345678','081-234-5678']) assert.equal(normalizedPhone(phone),'0812345678');
  assert.equal(normalizedPhone('08xxxx5678'),null);
  const payload = fixture(); payload.data.rawSlip.receiver.account.proxy.account = '+66812345678';
  assert.equal(validateEasySlipResponse(payload,1500.25,'0812345678').receiverAccount,'0812345678');
});
test('a 13-digit NATID must match completely', () => {
  const payload = fixture(); payload.data.rawSlip.receiver.account.proxy = { type: 'NATID',account: '1234567890123' };
  assert.equal(validateEasySlipResponse(payload,1500.25,'1234567890123').receiverAccount,'1234567890123');
  fails('RECEIVER_MISMATCH',() => validateEasySlipResponse(payload,1500.25,'1234567890124'));
});
test('different destination and masked suffixes cannot auto-approve', () => {
  fails('RECEIVER_MISMATCH',() => validateEasySlipResponse(fixture(),1500.25,'0899999999'));
  const payload = fixture(); payload.data.rawSlip.receiver.account.proxy.account = '08xxxxxx78';
  fails('RECEIVER_UNVERIFIABLE',() => validateEasySlipResponse(payload,1500.25,'0812345678'));
  assert.equal(accountDigits('xxx-1234'),null);
});
test('registered receiver mapping is scoped to exact bank code and full account', () => {
  const payload = fixture(); payload.data.rawSlip.receiver.account.proxy.account = '08xxxxxx78';
  payload.data.matchedAccount = { bank: { code: '014' },bankNumber: '123-4-56789-0' };
  const account = { bankCode: '014',bankNumber: '1234567890' };
  assert.equal(validateEasySlipResponse(payload,1500.25,'0812345678',account).receiverAccount,'1234567890');
  fails('RECEIVER_MISMATCH',() => validateEasySlipResponse(payload,1500.25,'0812345678',{ ...account,bankCode: '004' }));
  fails('RECEIVER_MISMATCH',() => validateEasySlipResponse(payload,1500.25,'0812345678',{ ...account,bankNumber: '9994567890' }));
});
test('wrong amount, duplicate and inconsistent provider amounts are rejected', () => {
  fails('AMOUNT_MISMATCH',() => validateEasySlipResponse(fixture(),1500.24,'0812345678'));
  const payload = fixture(); payload.data.isDuplicate = true;
  fails('DUPLICATE_SLIP',() => validateEasySlipResponse(payload,1500.25,'0812345678'));
  payload.data.isDuplicate = false; payload.data.amountInSlip = 1500;
  fails('INVALID_SLIP',() => validateEasySlipResponse(payload,1500.25,'0812345678'));
});
test('missing proof fields, foreign currency, future dates and negative amounts are rejected', () => {
  for (const mutate of [p => { p.data.rawSlip.transRef = ''; }, p => { p.data.rawSlip.date = 'bad'; }, p => { p.data.rawSlip.date = '2999-01-01T00:00:00Z'; }, p => { p.data.rawSlip.amount.local.currency = 'USD'; }, p => { p.data.rawSlip.amount.amount = -1500.25; }]) {
    const payload = fixture(); mutate(payload); fails('INVALID_SLIP',() => validateEasySlipResponse(payload,1500.25,'0812345678'));
  }
  fails('API_UNAVAILABLE',() => validateEasySlipResponse(null,1500.25,'0812345678'));
});
test('provider pending/failure results never become accepted payments', () => {
  fails('SLIP_PENDING',() => validateEasySlipResponse({ success: false,error: { code: 'SLIP_PENDING' } },1,'0812345678'));
  fails('INVALID_SLIP',() => validateEasySlipResponse({ success: false,error: { code: 'SLIP_NOT_FOUND' } },1,'0812345678'));
  fails('API_UNAVAILABLE',() => validateEasySlipResponse({ success: false,error: { code: 'INVALID_API_KEY' } },1,'0812345678'));
});
test('23505 and database quota/race errors map to actionable payment errors', () => {
  assert.deepEqual(paymentError({ code: '23505',message: 'unique violation' }),{ ok: false,code: 'DUPLICATE_SLIP',message: 'สลิปนี้เคยถูกใช้งานไปแล้ว' });
  for (const code of ['SLIP_QUOTA_EXCEEDED','ALREADY_PAID','VERIFICATION_IN_PROGRESS','ATTEMPT_EXPIRED']) assert.equal(paymentError({ message: code }).code,code);
});
test('daily quota rejection tells the owner to use manual approval, without changing bill quota', () => {
  const result = paymentError({ code: 'P0001', message: 'DAILY_VERIFY_LIMIT_EXCEEDED' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DAILY_VERIFY_LIMIT_EXCEEDED');
  assert.match(result.message, /15/);
  assert.match(result.message, /Manual Approve/);
  assert.equal('remaining' in result, false);
  // Per-bill and per-property limits remain distinct errors.
  assert.equal(paymentError({ message: 'SLIP_QUOTA_EXCEEDED' }).code, 'SLIP_QUOTA_EXCEEDED');
});
test('receiver config rejects masked account numbers and does not match other properties', () => {
  const json = JSON.stringify({ 'property-1': { bankCode: '014',bankNumber: '123-4-56789-0' } });
  assert.deepEqual(receiverAccountFromConfig(json,'property-1'),{ bankCode: '014',bankNumber: '1234567890' });
  assert.equal(receiverAccountFromConfig(json,'property-2'),undefined);
  fails('CONFIGURATION_ERROR',() => receiverAccountFromConfig('bad','property-1'));
  fails('CONFIGURATION_ERROR',() => receiverAccountFromConfig(JSON.stringify({ 'property-1': { bankCode: '014',bankNumber: 'xxx-5678' } }),'property-1'));
});
test('image sniffing rejects nonimages, malformed base64 and size overflow', () => {
  const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
  assert.equal(slipImageDataUri(png),`data:image/png;base64,${png.toString('base64')}`);
  assert.equal(slipImageDataUri(png.toString('base64')),slipImageDataUri(png));
  fails('INVALID_INPUT',() => slipImageDataUri('not-a-base64-image'));
  fails('INVALID_INPUT',() => slipImageDataUri(Buffer.from('plain text')));
  fails('INVALID_INPUT',() => slipImageDataUri(Buffer.alloc(4 * 1024 * 1024 + 1)));
});
test('money comparisons use exact cents without float tolerances', () => {
  assert.equal(moneyCents('1500.25'),BigInt(150025));
  for (const value of [-1,NaN,Infinity,'1.001','1e2',null]) assert.equal(moneyCents(value),null);
});
test('transport uses official v2 protocol, bearer auth and no cache',async t => {
  t.mock.method(globalThis,'fetch',async (url,options) => {
    assert.equal(url,'https://api.easyslip.com/v2/verify/bank');
    assert.equal(options.headers.Authorization,'Bearer unit-test-key');
    assert.equal(options.cache,'no-store');
    assert.deepEqual(JSON.parse(options.body),{ base64: 'unit-test-image',matchAmount: 1500.25,matchAccount: true,checkDuplicate: false });
    return new Response(JSON.stringify(fixture()));
  });
  assert.equal((await requestEasySlip('unit-test-image','unit-test-key',1500.25)).success,true);
});
test('transport maps malformed responses and network failures',async t => {
  t.mock.method(globalThis,'fetch',async () => new Response('not JSON'));
  await assert.rejects(requestEasySlip('image','key',1),error => error.code === 'API_UNAVAILABLE');
  t.mock.method(globalThis,'fetch',async () => { throw new Error('network failure'); });
  await assert.rejects(requestEasySlip('image','key',1),error => error.code === 'API_UNAVAILABLE');
});
test('transport applies an eight-second deadline and reports timeout',async t => {
  t.mock.method(AbortSignal,'timeout',ms => { assert.equal(ms,8000); return AbortSignal.abort(); });
  t.mock.method(globalThis,'fetch',async (_url,options) => { throw options.signal.reason; });
  await assert.rejects(requestEasySlip('image','key',1),error => error.code === 'API_TIMEOUT');
});
