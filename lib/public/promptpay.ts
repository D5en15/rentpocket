import { hundredths } from '../billing/calculation.ts';
function tlv(tag: string, value: string): string {
  if (value.length > 99) throw new Error('PromptPay field is too long');
  return `${tag}${String(value.length).padStart(2,'0')}${value}`;
}
export function crc16Ccitt(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}
export function promptPayPayload(id: string, amount: number | string): string {
  const target = id.trim();
  if (!/^(?:0\d{9}|\d{13})$/.test(target)) throw new Error('PromptPay ต้องเป็นเบอร์โทรเริ่มด้วย 0 จำนวน 10 หลัก หรือเลขประจำตัว 13 หลัก');
  const cents = hundredths(amount);
  if (cents === null || cents <= BigInt(0)) throw new Error('ยอดเงินสำหรับ QR ต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');
  const proxy = target.length === 10 ? tlv('01',`0066${target.slice(1)}`) : tlv('02',target);
  const fixedAmount = `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2,'0')}`;
  const payload = tlv('00','01') + tlv('01','12') + tlv('29',tlv('00','A000000677010111') + proxy)
    + tlv('58','TH') + tlv('53','764') + tlv('54',fixedAmount) + '6304';
  return payload + crc16Ccitt(payload);
}
