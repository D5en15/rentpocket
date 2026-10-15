import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from './types';

export async function authenticatedClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return { client, user: error ? null : data.user };
}
export function databaseError(error: { message: string; code?: string }): ActionResult<never> {
  for (const code of ['QUOTA_EXCEEDED', 'SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_NOT_FOUND', 'FORBIDDEN'] as const) {
    if (error.message.includes(code)) return { ok: false, code, message: code === 'QUOTA_EXCEEDED' ? 'จำนวนห้องเกินโควตาแพ็กเกจ' : code === 'FORBIDDEN' ? 'ไม่มีสิทธิ์จัดการหอพักนี้' : 'แพ็กเกจหมดอายุหรือยังไม่พร้อมใช้งาน' };
  }
  if (error.code === '23505') return { ok: false, code: 'DUPLICATE_ROOM', message: 'เลขห้องซ้ำกับห้องที่มีอยู่แล้ว' };
  console.error('Database operation failed', error.code);
  return { ok: false, code: 'DATABASE_ERROR', message: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่' };
}
export function invalid(message: string): ActionResult<never> { return { ok: false, code: 'INVALID_INPUT', message }; }
export { uuidPattern, amount, subscriptionExpired } from './validation';
