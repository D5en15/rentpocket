import { SlipError } from './types.ts';
import type { ReceiverAccount, VerifiedSlip } from './types.ts';
const endpoint = 'https://api.easyslip.com/v2/verify/bank';
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function moneyCents(value: unknown): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2,'0'));
}
export function accountDigits(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[\d\s+()-]+$/.test(value)) return null;
  return value.replace(/\D/g,'');
}
export function normalizedPhone(value: unknown): string | null {
  const digits = accountDigits(value);
  if (!digits) return null;
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^66\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0066\d{9}$/.test(digits)) return `0${digits.slice(4)}`;
  return null;
}
export function receiverAccountFromConfig(json: string | undefined, propertyId: string): ReceiverAccount | undefined {
  if (!json) return undefined;
  let parsed: Record<string, unknown>;
  try { parsed = object(JSON.parse(json)); } catch { throw new SlipError('CONFIGURATION_ERROR','การตั้งค่าบัญชีรับเงินไม่ถูกต้อง'); }
  const account = object(parsed[propertyId]);
  if (!Object.keys(account).length) return undefined;
  const bankNumber = accountDigits(account.bankNumber);
  if (typeof account.bankCode !== 'string' || !/^\d{3}$/.test(account.bankCode) || !bankNumber || bankNumber.length < 6 || bankNumber.length > 20) throw new SlipError('CONFIGURATION_ERROR','การตั้งค่าบัญชีรับเงินของหอพักนี้ไม่ถูกต้อง');
  return { bankCode: account.bankCode, bankNumber };
}
export function validateEasySlipResponse(payload: unknown, expectedAmount: number | string, promptpayId: string, account?: ReceiverAccount): VerifiedSlip {
  const root = object(payload), data = object(root.data);
  if (root.success !== true) {
    const code = object(root.error).code;
    if (code === 'SLIP_PENDING') throw new SlipError('SLIP_PENDING','ธนาคารยังไม่พร้อมตรวจสลิป กรุณารอสักครู่ หรือยืนยันยอดด้วยตนเอง');
    if (code === 'SLIP_NOT_FOUND' || code === 'INVALID_SLIP') throw new SlipError('INVALID_SLIP','ไม่พบรายการโอนจากสลิปนี้ กรุณาตรวจรูปภาพ');
    if (code === 'DUPLICATE_SLIP' || code === 'SLIP_DUPLICATE') throw new SlipError('DUPLICATE_SLIP','สลิปนี้เคยถูกใช้งานไปแล้ว');
    throw new SlipError('API_UNAVAILABLE','บริการตรวจสลิปไม่พร้อมใช้งาน กรุณายืนยันยอดด้วยตนเอง');
  }
  if (data.isDuplicate === true) throw new SlipError('DUPLICATE_SLIP','สลิปนี้เคยถูกใช้งานไปแล้ว');
  const raw = object(data.rawSlip), amount = object(raw.amount), receiver = object(raw.receiver);
  const actual = moneyCents(amount.amount), expected = moneyCents(expectedAmount);
  if (actual === null || expected === null || moneyCents(data.amountInSlip) !== actual) throw new SlipError('INVALID_SLIP','ข้อมูลยอดเงินจากบริการตรวจสลิปไม่สมบูรณ์');
  if (actual !== expected || data.isAmountMatched === false) throw new SlipError('AMOUNT_MISMATCH','ยอดเงินในสลิปไม่ตรงกับยอดบิล');
  const currency = object(amount.local).currency;
  if ((currency !== undefined && currency !== 'THB') || (raw.countryCode !== undefined && raw.countryCode !== 'TH')) throw new SlipError('INVALID_SLIP','รองรับเฉพาะรายการโอนเงินบาทในประเทศไทย');
  const receiverDetails = object(receiver.account), proxy = object(receiverDetails.proxy);
  let matched = false, verifiable = false, receiverAccount = '';
  if (proxy.type === 'MSISDN' && promptpayId.length === 10) {
    const phone = normalizedPhone(proxy.account);
    if (phone) { verifiable = true; matched = phone === promptpayId; if (matched) receiverAccount = phone; }
  } else if (proxy.type === 'NATID' && promptpayId.length === 13) {
    const id = accountDigits(proxy.account);
    if (id && id.length === 13) { verifiable = true; matched = id === promptpayId; if (matched) receiverAccount = id; }
  }
  if (!matched && account) {
    const registered = object(data.matchedAccount), registeredBank = object(registered.bank);
    const registeredNumber = accountDigits(registered.bankNumber);
    const rawBank = object(receiver.bank), bank = object(receiverDetails.bank);
    const rawNumber = accountDigits(bank.account);
    const registerMatches = registeredBank.code === account.bankCode && registeredNumber === account.bankNumber;
    const rawMatches = rawBank.id === account.bankCode && bank.type === 'BANKAC' && rawNumber === account.bankNumber;
    verifiable ||= registeredNumber !== null || rawNumber !== null;
    matched = registerMatches || rawMatches;
    if (matched) receiverAccount = account.bankNumber;
  }
  // Masked suffixes and account names never prove receiver identity.
  if (!matched) throw new SlipError(verifiable ? 'RECEIVER_MISMATCH' : 'RECEIVER_UNVERIFIABLE', verifiable ? 'บัญชีปลายทางไม่ตรงกับบัญชีรับเงินของหอพัก' : 'สลิปปิดบังเลขบัญชี จึงยืนยันปลายทางอัตโนมัติไม่ได้ กรุณาตรวจยอดและยืนยันด้วยตนเอง');
  if (typeof raw.transRef !== 'string' || !raw.transRef.trim() || raw.transRef.length > 100
    || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw.date)
    || !Number.isFinite(Date.parse(raw.date)) || Date.parse(raw.date) > Date.now() + 5 * 60 * 1000) throw new SlipError('INVALID_SLIP','ข้อมูลอ้างอิงรายการโอนไม่สมบูรณ์');
  const senderBank = object(object(raw.sender).bank).id;
  return { transRef: raw.transRef.trim(), amount: `${actual / BigInt(100)}.${String(actual % BigInt(100)).padStart(2,'0')}`,
    transferDate: raw.date, senderBank: typeof senderBank === 'string' && senderBank.length <= 50 ? senderBank : null,
    receiverAccount, rawPayload: root };
}
export async function requestEasySlip(base64: string, apiKey: string, expectedAmount: number): Promise<unknown> {
  const signal = AbortSignal.timeout(8000);
  try {
    const response = await fetch(endpoint, { method: 'POST', redirect: 'error', cache: 'no-store', signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, matchAmount: expectedAmount, matchAccount: true, checkDuplicate: false }),
    });
    const reader = response.body?.getReader();
    if (!reader) throw new SlipError('API_UNAVAILABLE','บริการตรวจสลิปไม่ส่งผลการตรวจกลับมา');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 512 * 1024) { await reader.cancel(); throw new SlipError('API_UNAVAILABLE','ผลการตรวจสลิปมีขนาดผิดปกติ'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let result: unknown;
    try { result = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SlipError('API_UNAVAILABLE','บริการตรวจสลิปส่งข้อมูลไม่ถูกต้อง'); }
    if (!response.ok && object(result).success !== false) throw new SlipError('API_UNAVAILABLE','บริการตรวจสลิปไม่พร้อมใช้งาน');
    return result;
  } catch (error) {
    if (error instanceof SlipError) throw error;
    if (signal.aborted) throw new SlipError('API_TIMEOUT','ตรวจสลิปเกิน 8 วินาที กรุณาลองใหม่หรือยืนยันยอดด้วยตนเอง');
    throw new SlipError('API_UNAVAILABLE','เชื่อมต่อบริการตรวจสลิปไม่สำเร็จ กรุณายืนยันยอดด้วยตนเอง');
  }
}
