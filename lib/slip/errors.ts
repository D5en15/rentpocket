import type { SlipCode, SlipResult } from './types.ts';
const messages: Partial<Record<SlipCode,string>> = {
  FORBIDDEN: 'ไม่พบบิลหรือไม่มีสิทธิ์จัดการบิลนี้', ALREADY_PAID: 'บิลนี้ชำระแล้ว', BILL_NOT_ISSUED: 'บิลนี้ยังไม่ได้ออก',
  DAILY_VERIFY_LIMIT_EXCEEDED: 'หอพักนี้ตรวจสลิปครบ 15 ครั้งสำหรับวันนี้แล้ว กรุณาใช้ปุ่ม ยืนยันยอดด้วยตนเอง (Manual Approve) หรือรอวันถัดไป',
  SLIP_QUOTA_EXCEEDED: 'หมดโควตาตรวจสลิป 3 ครั้ง กรุณายืนยันยอดด้วยตนเอง', VERIFICATION_IN_PROGRESS: 'บิลนี้กำลังตรวจสลิปอยู่ กรุณารอผล',
  AMOUNT_MISMATCH: 'ยอดเงินในสลิปไม่ตรงกับยอดบิล', ATTEMPT_EXPIRED: 'ผลตรวจหมดอายุ กรุณาตรวจสถานะบิลก่อนลองใหม่', INVALID_SLIP: 'ข้อมูลสลิปไม่ถูกต้อง',
};
export function paymentError(error: { message: string; code?: string }): SlipResult {
  if (error.code === '23505') return { ok: false, code: 'DUPLICATE_SLIP', message: 'สลิปนี้เคยถูกใช้งานไปแล้ว' };
  for (const code of Object.keys(messages) as SlipCode[]) if (error.message.includes(code)) return { ok: false, code, message: messages[code]! };
  return { ok: false, code: 'DATABASE_ERROR', message: 'บันทึกผลการชำระไม่สำเร็จ กรุณาตรวจสถานะบิลก่อนลองใหม่' };
}
