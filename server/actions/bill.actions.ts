'use server';
import { devMockEnabled, mockCycle, mockSaveMeters } from '@/lib/dev/mock';
import { revalidatePath } from 'next/cache';
import { authenticatedClient, databaseError, invalid, uuidPattern } from './shared';
import type { ActionResult } from './types';
import { previousCycle } from '@/lib/billing/calculation';
import { normalizeMeterReadings } from '@/lib/billing/submission';
import type { BillingCycleData, MeterReading, MeterSaveResult } from '@/lib/billing/types';

function billingError(error: { message: string; code?: string }): ActionResult<never> {
  const messages = {
    BILL_LOCKED: 'บิลนี้ออกแล้ว ไม่สามารถแก้ไขเลขมิเตอร์ซ้ำได้',
    STALE_READING: 'ข้อมูลบิลเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดรอบบิลใหม่',
    INVALID_INPUT: 'เลขมิเตอร์หรือข้อมูลรอบบิลไม่ถูกต้อง',
    FORBIDDEN: 'ไม่พบข้อมูลหรือไม่มีสิทธิ์จัดการบิลนี้',
    SUBSCRIPTION_EXPIRED: 'แพ็กเกจหมดอายุ ไม่สามารถออกบิลใหม่ได้',
    SUBSCRIPTION_NOT_FOUND: 'ไม่พบแพ็กเกจของบัญชีนี้',
    BILLING_CYCLE_OUT_OF_RANGE: 'สร้างรอบบิลได้ย้อนหลังไม่เกิน 12 เดือน และล่วงหน้าไม่เกิน 1 เดือน',
    INVALID_REPLACEMENT: 'เลขสุดท้ายมิเตอร์เก่าหรือเลขเริ่มต้นมิเตอร์ใหม่ไม่ถูกต้อง',
    METER_DECREASED: 'เลขมิเตอร์ใหม่ต่ำกว่าเลขเก่า กรุณาตรวจสอบโหมดมิเตอร์',
  } as const;
  for (const code of Object.keys(messages) as (keyof typeof messages)[]) if (error.message.includes(code)) return { ok: false, code, message: messages[code] };
  const fallback = databaseError(error);
  return fallback.ok ? { ok: false, code: 'DATABASE_ERROR', message: 'บันทึกไม่สำเร็จ' } : fallback;
}
export async function getOrCreateBillingCycleAction(propertyId: string, billingCycle: string): Promise<ActionResult<BillingCycleData>> {
  if (!uuidPattern.test(propertyId) || !previousCycle(billingCycle)) return invalid('กรุณาเลือกหอพักและเดือนในรูปแบบ YYYY-MM');
  if (devMockEnabled()) return { ok: true, data: mockCycle(propertyId, billingCycle) };
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return { ok: false, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };
    const { data, error } = await client.rpc('get_or_create_billing_cycle', { p_property_id: propertyId, p_cycle: billingCycle });
    if (error) return billingError(error);
    if (!data || !Array.isArray(data.bills) || !Array.isArray(data.rooms)) return { ok: false, code: 'DATABASE_ERROR', message: 'ข้อมูลรอบบิลไม่สมบูรณ์' };
    return { ok: true, data: data as BillingCycleData };
  } catch { return { ok: false, code: 'CONFIGURATION_ERROR', message: 'เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจการตั้งค่าระบบ' }; }
}
export async function saveMeterReadingAction(reading: MeterReading | MeterReading[]): Promise<MeterSaveResult> {
  const normalized = normalizeMeterReadings(reading);
  if (!normalized) return invalid('ข้อมูลมิเตอร์ไม่ถูกต้อง กรอกเลขดิบของมิเตอร์และเลือกครั้งละ 1–100 ห้อง');
  if (devMockEnabled()) { const result = mockSaveMeters(Array.isArray(reading) ? reading : [reading]); if (result.ok) { revalidatePath('/meters'); revalidatePath('/dashboard'); } return result; }
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return { ok: false, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };
    // RPC calculates charges from locked database rows, not client totals.
    // Warnings return before any UPDATE; confirming submits the same readings again.
    const { data, error } = await client.rpc('save_meter_readings', { p_readings: normalized });
    if (error) return billingError(error);
    if (!data || typeof data.ok !== 'boolean') return { ok: false, code: 'DATABASE_ERROR', message: 'ผลการบันทึกไม่สมบูรณ์' };
    if (data.ok) { revalidatePath('/meters'); revalidatePath('/dashboard'); }
    return data as MeterSaveResult;
  } catch { return { ok: false, code: 'CONFIGURATION_ERROR', message: 'เชื่อมต่อ Supabase ไม่สำเร็จ' }; }
}
