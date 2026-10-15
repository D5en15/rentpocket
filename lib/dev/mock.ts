import 'server-only';
import { randomUUID } from 'node:crypto';
import { calculateBill, defaultDueDate } from '@/lib/billing/calculation';
import type { BillingRoom, MeterBill, MeterReading, MeterSaveResult, MeterWarning } from '@/lib/billing/types';
import type { DashboardBill } from '@/lib/dashboard/model';
import type { Property, SetupData, ActionResult } from '@/server/actions/types';
import type { SlipResult } from '@/lib/slip/types';
export const devMockEnabled = () => process.env.NODE_ENV === 'development';
export const mockUser = { id: '00000000-0000-4000-8000-000000000001', email: 'ceo@rentpocket.local' };
type Store = { properties: Property[]; rooms: (BillingRoom & { property_id: string })[]; bills: MeterBill[]; payments: Record<string, { count: number; method: 'MANUAL' | 'EASYSLIP' | null; paidAt: string | null }> };
const globalStore = globalThis as typeof globalThis & { rentPocketMock?: Store };
function store(): Store {
  if (!devMockEnabled()) throw new Error('Development mock is disabled');
  if (!globalStore.rentPocketMock) {
    const property: Property = { id: '00000000-0000-4000-8000-000000000002', name: 'หอพักสุขใจ (ข้อมูลทดสอบ)', address: 'กรุงเทพมหานคร', promptpay_id: '0000000000', promptpay_name: 'บัญชีจำลอง ห้ามโอนเงินจริง', default_electric_rate: 8, default_water_rate: 18, default_water_type: 'PER_UNIT' };
    globalStore.rentPocketMock = { properties: [property], rooms: Array.from({ length: 4 }, (_, i) => ({ id: randomUUID(), property_id: property.id, room_number: String(101+i), floor: 1, status: 'OCCUPIED', base_rent: 3000, electric_rate: 8, water_rate: 18, water_billing_type: 'PER_UNIT' })), bills: [], payments: {} };
  }
  return globalStore.rentPocketMock;
}
export function mockSetup(): SetupData { const s = store(); return structuredClone({ properties: s.properties, usedRooms: s.rooms.length, maxRooms: 50, status: 'TRIAL', expired: false }); }
export function mockCycle(propertyId: string, cycle: string) {
  const s = store(), rooms = s.rooms.filter(r => r.property_id === propertyId);
  for (const [i, room] of rooms.entries()) if (!s.bills.some(b => b.room_id === room.id && b.billing_cycle === cycle)) {
    const previous = s.bills.filter(b => b.room_id === room.id && b.billing_cycle < cycle && b.status !== 'DRAFT').sort((a, b) => b.billing_cycle.localeCompare(a.billing_cycle))[0];
    const prev = previous?.curr_electric_meter ?? 1200+i*200;
    const bill: MeterBill = { id: randomUUID(), room_id: room.id, property_id: propertyId, billing_cycle: cycle, status: i === 0 ? 'PAID' : i < 3 ? 'PENDING_PAYMENT' : 'DRAFT', prev_electric_meter: prev, curr_electric_meter: prev+100, prev_water_meter: previous?.curr_water_meter ?? 100, curr_water_meter: (previous?.curr_water_meter ?? 100)+5, electric_units: 100, water_units: 5, electric_amount: 800, water_amount: 90, electric_rate: room.electric_rate, water_rate: room.water_rate, water_billing_type: room.water_billing_type, previous_electric_units: 100, base_rent: room.base_rent, other_fees: 0, total_amount: room.base_rent+890, due_date: i === 2 ? '2000-01-01' : defaultDueDate(cycle), is_meter_rollover: false, is_meter_replaced: false, replaced_meter_carry_units: 0, updated_at: new Date().toISOString() };
    s.bills.push(bill); s.payments[bill.id] = { count: 0, method: i===0 ? 'MANUAL' : null, paidAt: i===0 ? new Date().toISOString() : null };
  }
  return structuredClone({ rooms, bills: s.bills.filter(b => b.property_id === propertyId && b.billing_cycle === cycle), expired: false });
}
export function mockDashboard(cycle: string, propertyId: string): DashboardBill[] {
  const s = store(); for (const p of s.properties) mockCycle(p.id, cycle);
  return s.bills.filter(b => b.billing_cycle === cycle && b.status !== 'DRAFT' && (!propertyId || b.property_id === propertyId)).map(b => {
    const p = s.properties.find(p => p.id === b.property_id)!, r = s.rooms.find(r => r.id === b.room_id)!, payment = s.payments[b.id];
    return { ...structuredClone(b), status: b.status as DashboardBill['status'], slip_verify_count: payment.count, payment_method: payment.method, paid_at: payment.paidAt, room: { room_number: r.room_number, tenant_name: 'ผู้เช่าจำลอง' }, property: { id: p.id, name: p.name, promptpay_id: p.promptpay_id, promptpay_name: p.promptpay_name } };
  });
}
export function mockSaveMeters(readings: MeterReading[]): MeterSaveResult {
  const s = store(), updates: { bill: MeterBill; reading: MeterReading; calculation: ReturnType<typeof calculateBill> }[] = [], warnings: MeterWarning[] = [];
  for (const reading of readings) {
    const b = s.bills.find(b => b.id === reading.billId);
    if (!b) return { ok: false, code: 'FORBIDDEN', message: 'ไม่พบบิลจำลอง' };
    if (b.status !== 'DRAFT') return { ok: false, code: 'BILL_LOCKED', message: 'บิลนี้ออกแล้ว' };
    if (b.updated_at !== reading.expectedUpdatedAt) return { ok: false, code: 'STALE_READING', message: 'กรุณาโหลดรอบบิลใหม่' };
    const carry = reading.isReplaced ? Number(reading.oldFinal.replace(',', '.'))-b.prev_electric_meter-Number(reading.newInitial.replace(',', '.')) : 0;
    const calculation = calculateBill({ previousElectric: b.prev_electric_meter, previousWater: b.prev_water_meter, previousElectricUnits: b.previous_electric_units, electricRate: b.electric_rate, waterRate: b.water_rate, waterType: b.water_billing_type, baseRent: b.base_rent }, { ...reading, carryUnits: String(carry) });
    if (!calculation.ok) return { ok: false, code: 'INVALID_INPUT', message: calculation.message };
    if (calculation.data.softWarning && !reading.confirmWarning) warnings.push({ ...calculation.data, billId: b.id, roomNumber: s.rooms.find(r => r.id === b.room_id)!.room_number });
    updates.push({ bill: b, reading, calculation });
  }
  if (warnings.length) return { ok: false, code: 'SOFT_WARNING', message: 'หน่วยไฟสูงผิดปกติ', warnings };
  for (const { bill: b, reading: r, calculation: c } of updates) if (c.ok) Object.assign(b, { curr_electric_meter: Number(r.currentElectric.replace(',', '.')), curr_water_meter: Number(r.currentWater.replace(',', '.')), electric_units: c.data.electricUnits, water_units: c.data.waterUnits, electric_amount: c.data.electricAmount, water_amount: c.data.waterAmount, other_fees: c.data.otherFees, total_amount: c.data.totalAmount, due_date: r.dueDate, is_meter_rollover: r.isRollover, is_meter_replaced: r.isReplaced, status: 'PENDING_PAYMENT', updated_at: new Date().toISOString() });
  return { ok: true, data: { saved: updates.length } };
}
export function mockProperty(id: string, payload: Omit<Property, 'id'>): ActionResult<Property> {
  const s = store(); const existing = s.properties.find(p => p.id === id);
  if (id && !existing) return { ok: false, code: 'FORBIDDEN', message: 'ไม่พบหอพักจำลอง' };
  const property = { ...payload, id: existing?.id ?? randomUUID() };
  if (existing) Object.assign(existing, property); else s.properties.push(property);
  return { ok: true, data: structuredClone(property) };
}
export function mockRooms(propertyId: string, numbers: string[], rent: number, floor: number): ActionResult<{ created: number }> {
  const s = store(), p = s.properties.find(p => p.id === propertyId);
  if (!p) return { ok: false, code: 'FORBIDDEN', message: 'ไม่พบหอพักจำลอง' };
  if (s.rooms.length + numbers.length > 50) return { ok: false, code: 'QUOTA_EXCEEDED', message: 'โควตาทดสอบสูงสุด 50 ห้อง' };
  if (numbers.some(n => s.rooms.some(r => r.property_id === propertyId && r.room_number === n))) return { ok: false, code: 'DUPLICATE_ROOM', message: 'เลขห้องซ้ำ' };
  s.rooms.push(...numbers.map(n => ({ id: randomUUID(), property_id: propertyId, room_number: n, floor, status: 'VACANT', base_rent: rent, electric_rate: p.default_electric_rate, water_rate: p.default_water_rate, water_billing_type: p.default_water_type })));
  return { ok: true, data: { created: numbers.length } };
}
export function mockPay(id: string, verify: boolean): SlipResult {
  const s = store(), b = s.bills.find(b => b.id === id);
  if (!b) return { ok: false, code: 'FORBIDDEN', message: 'ไม่พบบิลจำลอง' };
  const p = s.payments[id];
  if (b.status === 'PAID') return { ok: false, code: 'ALREADY_PAID', message: 'บิลจำลองชำระแล้ว' };
  if (b.status === 'DRAFT') return { ok: false, code: 'BILL_NOT_ISSUED', message: 'กรุณาออกบิลก่อน' };
  if (verify) {
    if (p.count >= 3) return { ok: false, code: 'SLIP_QUOTA_EXCEEDED', message: 'หมดโควตาจำลอง', remaining: 0 };
    p.count++;
    return { ok: false, code: 'API_UNAVAILABLE', message: 'โหมดจำลองไม่ส่งสลิปไป EasySlip ใช้ Manual Approve เพื่อทดสอบรับเงิน', remaining: 3-p.count };
  }
  b.status = 'PAID'; p.method = 'MANUAL'; p.paidAt = new Date().toISOString();
  return { ok: true, method: 'MANUAL', remaining: 3-p.count };
}
