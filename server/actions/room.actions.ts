'use server';
import { devMockEnabled, mockRooms } from '@/lib/dev/mock';
import { revalidatePath } from 'next/cache';
import { authenticatedClient, amount, databaseError, invalid, subscriptionExpired, uuidPattern } from './shared';
import type { ActionResult } from './types';

type CreatedRooms = { created: number };
async function insertRooms(form: FormData, numbers: string[]): Promise<ActionResult<CreatedRooms>> {
  const propertyId = String(form.get('property_id') ?? '');
  const rent = amount(form.get('base_rent'));
  const floorText = String(form.get('floor') ?? '1');
  if (!uuidPattern.test(propertyId) || rent === null || !/^\d{1,3}$/.test(floorText)) return invalid('กรุณาเลือกหอพักและกรอกค่าเช่ากับชั้นให้ถูกต้อง');
  if (devMockEnabled()) { const result = mockRooms(propertyId, numbers, rent, Number(floorText)); revalidatePath('/setup'); return result; }
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return { ok: false, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };
    const { data: property, error: propertyError } = await client.from('properties').select('id,default_electric_rate,default_water_rate,default_water_type').eq('id', propertyId).eq('user_id', user.id).maybeSingle();
    if (propertyError) return databaseError(propertyError);
    if (!property) return { ok: false, code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์จัดการหอพักนี้' };
    const [subscription, rooms] = await Promise.all([
      client.from('subscriptions').select('max_rooms,status,trial_ends_at,current_period_end').eq('user_id', user.id).maybeSingle(),
      client.from('rooms').select('id,properties!inner(user_id)', { count: 'exact', head: true }).eq('properties.user_id', user.id),
    ]);
    if (subscription.error) return databaseError(subscription.error);
    if (rooms.error) return databaseError(rooms.error);
    if (!subscription.data) return { ok: false, code: 'SUBSCRIPTION_NOT_FOUND', message: 'ไม่พบแพ็กเกจ' };
    if (subscriptionExpired(subscription.data)) return { ok: false, code: 'SUBSCRIPTION_EXPIRED', message: 'แพ็กเกจหมดอายุ กรุณาต่ออายุเพื่อเพิ่มห้อง' };
    if ((rooms.count ?? 0) + numbers.length > subscription.data.max_rooms) return { ok: false, code: 'QUOTA_EXCEEDED', message: `เพิ่มได้อีก ${Math.max(0, subscription.data.max_rooms - (rooms.count ?? 0))} ห้อง` };
    // One INSERT statement is atomic; the trigger rechecks under a row lock.
    const { error } = await client.from('rooms').insert(numbers.map(room_number => ({ property_id: propertyId, room_number, floor: Number(floorText), base_rent: rent, electric_rate: property.default_electric_rate, water_rate: property.default_water_rate, water_billing_type: property.default_water_type, status: 'VACANT' })));
    if (error) return databaseError(error);
    revalidatePath('/setup');
    return { ok: true, data: { created: numbers.length } };
  } catch {
    return { ok: false, code: 'CONFIGURATION_ERROR', message: 'เชื่อมต่อ Supabase ไม่สำเร็จ' };
  }
}
export async function createRoomAction(form: FormData): Promise<ActionResult<CreatedRooms>> {
  const number = String(form.get('room_number') ?? '').trim();
  if (!number || number.length > 50) return invalid('เลขห้องต้องมี 1–50 ตัวอักษร');
  return insertRooms(form, [number]);
}
export async function batchCreateRoomsAction(form: FormData): Promise<ActionResult<CreatedRooms>> {
  const startText = String(form.get('start_room') ?? '');
  const endText = String(form.get('end_room') ?? '');
  if (!/^\d{1,8}$/.test(startText) || !/^\d{1,8}$/.test(endText)) return invalid('เลขห้องเริ่มต้นและสิ้นสุดต้องเป็นจำนวนเต็ม');
  const start = Number(startText), end = Number(endText);
  if (start < 1 || end < start || end - start + 1 > 100) return invalid('เพิ่มครั้งละ 1–100 ห้อง โดยเลขสิ้นสุดต้องไม่น้อยกว่าเลขเริ่มต้น');
  const width = startText.startsWith('0') ? startText.length : 0;
  return insertRooms(form, Array.from({ length: end - start + 1 }, (_, index) => String(start + index).padStart(width, '0')));
}
