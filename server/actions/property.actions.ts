'use server';
import { devMockEnabled, mockSetup, mockProperty } from '@/lib/dev/mock';
import { revalidatePath } from 'next/cache';
import { authenticatedClient, amount, databaseError, invalid, subscriptionExpired, uuidPattern } from './shared';
import type { ActionResult, Property, SetupData } from './types';

export async function getSetupDataAction(): Promise<ActionResult<SetupData>> {
  if (devMockEnabled()) return { ok: true, data: mockSetup() };
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return { ok: false, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };
    const [properties, subscription, rooms] = await Promise.all([
      client.from('properties').select('id,name,address,promptpay_id,promptpay_name,default_electric_rate,default_water_rate,default_water_type').eq('user_id', user.id).order('created_at'),
      client.from('subscriptions').select('max_rooms,status,trial_ends_at,current_period_end').eq('user_id', user.id).maybeSingle(),
      client.from('rooms').select('id,properties!inner(user_id)', { count: 'exact', head: true }).eq('properties.user_id', user.id),
    ]);
    for (const result of [properties, subscription, rooms]) if (result.error) return databaseError(result.error);
    if (!subscription.data) return { ok: false, code: 'SUBSCRIPTION_NOT_FOUND', message: 'ไม่พบแพ็กเกจของบัญชีนี้' };
    return { ok: true, data: { properties: properties.data as Property[], usedRooms: rooms.count ?? 0, maxRooms: subscription.data.max_rooms, status: subscription.data.status, expired: subscriptionExpired(subscription.data) } };
  } catch {
    return { ok: false, code: 'CONFIGURATION_ERROR', message: 'เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจการตั้งค่าระบบ' };
  }
}

export async function savePropertyAction(form: FormData): Promise<ActionResult<Property>> {
  const id = String(form.get('property_id') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const promptpayName = String(form.get('promptpay_name') ?? '').trim();
  const promptpayId = String(form.get('promptpay_id') ?? '').trim();
  const address = String(form.get('address') ?? '').trim();
  const electric = amount(form.get('default_electric_rate'));
  const water = amount(form.get('default_water_rate'));
  const waterType = form.get('default_water_type');
  if (id && !uuidPattern.test(id)) return invalid('รหัสหอพักไม่ถูกต้อง');
  if (!name || name.length > 255 || !promptpayName || promptpayName.length > 255 || address.length > 2000) return invalid('กรุณากรอกชื่อหอพักและชื่อบัญชีให้ถูกต้อง');
  if (!/^(?:\d{10}|\d{13})$/.test(promptpayId)) return invalid('PromptPay ต้องเป็นตัวเลข 10 หรือ 13 หลัก');
  if (electric === null || water === null || !['PER_UNIT', 'FLAT_RATE'].includes(String(waterType))) return invalid('เรทน้ำไฟต้องเป็นจำนวนเงินไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง');
  if (devMockEnabled()) { const result = mockProperty(id, { name, address: address || null, promptpay_name: promptpayName, promptpay_id: promptpayId, default_electric_rate: electric, default_water_rate: water, default_water_type: waterType as Property['default_water_type'] }); revalidatePath('/setup'); return result; }
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return { ok: false, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };
    const payload = { name, address: address || null, promptpay_name: promptpayName, promptpay_id: promptpayId, default_electric_rate: electric, default_water_rate: water, default_water_type: waterType, updated_at: new Date().toISOString() };
    const query = id ? client.from('properties').update(payload).eq('id', id).eq('user_id', user.id) : client.from('properties').insert({ ...payload, user_id: user.id });
    const { data, error } = await query.select('id,name,address,promptpay_id,promptpay_name,default_electric_rate,default_water_rate,default_water_type').maybeSingle();
    if (error) return databaseError(error);
    if (!data) return { ok: false, code: 'FORBIDDEN', message: 'ไม่พบหอพักหรือไม่มีสิทธิ์แก้ไข' };
    revalidatePath('/setup');
    return { ok: true, data: data as Property };
  } catch {
    return { ok: false, code: 'CONFIGURATION_ERROR', message: 'เชื่อมต่อ Supabase ไม่สำเร็จ' };
  }
}
