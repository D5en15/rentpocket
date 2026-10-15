'use server';
import { devMockEnabled, mockDashboard } from '@/lib/dev/mock';
import { authenticatedClient, databaseError, invalid, uuidPattern } from './shared';
import { previousCycle } from '@/lib/billing/calculation';
import type { ActionResult } from './types';
import type { DashboardBill } from '@/lib/dashboard/model';
export async function getDashboardBillsAction(cycle: string, propertyId = ''): Promise<ActionResult<DashboardBill[]>> {
  if (!previousCycle(cycle) || (propertyId && !uuidPattern.test(propertyId))) return invalid('หอพักหรือรอบบิลไม่ถูกต้อง');
  if (devMockEnabled()) return { ok: true, data: mockDashboard(cycle, propertyId) };
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return { ok: false, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };
    let query = client.from('bills').select('id,billing_cycle,status,due_date,base_rent,electric_units,electric_amount,water_amount,other_fees,total_amount,slip_verify_count,payment_method,paid_at,room:rooms!inner(room_number,tenant_name),property:properties!inner(id,name,user_id,promptpay_id,promptpay_name)').eq('property.user_id',user.id).eq('billing_cycle',cycle).neq('status','DRAFT').order('due_date').order('id');
    if (propertyId) query = query.eq('property_id',propertyId);
    const { data, error } = await query;
    if (error) return databaseError(error);
    const bills = (data ?? []).map(item => ({ ...item, room: Array.isArray(item.room) ? item.room[0] : item.room, property: Array.isArray(item.property) ? item.property[0] : item.property }));
    if (bills.some(item => !item.room || !item.property)) return { ok: false, code: 'DATABASE_ERROR', message: 'ข้อมูลห้องพักหรือบัญชีรับเงินไม่สมบูรณ์' };
    return { ok: true, data: bills as DashboardBill[] };
  } catch { return { ok: false, code: 'CONFIGURATION_ERROR', message: 'เชื่อมต่อ Supabase ไม่สำเร็จ' }; }
}
