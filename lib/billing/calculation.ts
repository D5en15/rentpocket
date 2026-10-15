export type MeterInput = {
  currentElectric: string;
  currentWater: string;
  isRollover: boolean;
  isReplaced: boolean;
  carryUnits: string;
  otherFees: string;
};
export type CalculationContext = {
  previousElectric: number | string;
  previousWater: number | string;
  previousElectricUnits: number | string | null;
  electricRate: number | string;
  waterRate: number | string;
  waterType: 'PER_UNIT' | 'FLAT_RATE';
  baseRent: number | string;
};
export type BillCalculation = {
  electricUnits: number;
  waterUnits: number;
  electricAmount: number;
  waterAmount: number;
  baseRent: number;
  otherFees: number;
  totalAmount: number;
  previousElectricUnits: number | null;
  softWarning: boolean;
};
export type CalculationResult = { ok: true; data: BillCalculation } | { ok: false; message: string };

// Inputs and rates are represented in hundredths. Money is rounded half-up
// per charge, matching PostgreSQL numeric round(..., 2), without float drift.
export function hundredths(value: string | number): bigint | null {
  const text = String(value).trim().replace(',', '.');
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}
export function signedHundredths(value: string): bigint | null {
  const text = value.trim();
  const parsed = hundredths(text.startsWith('-') ? text.slice(1) : text);
  return parsed === null ? null : text.startsWith('-') ? -parsed : parsed;
}
const max = BigInt(9999999999);
const asNumber = (value: bigint) => Number(value) / 100;
export function calculateBill(context: CalculationContext, input: MeterInput): CalculationResult {
  const prevElectric = hundredths(context.previousElectric);
  const prevWater = hundredths(context.previousWater);
  const currentElectric = hundredths(input.currentElectric);
  const electricRate = hundredths(context.electricRate);
  const waterRate = hundredths(context.waterRate);
  const baseRent = hundredths(context.baseRent);
  const otherFees = hundredths(input.otherFees);
  const carry = input.isReplaced ? signedHundredths(input.carryUnits) : BigInt(0);
  if (prevElectric === null || prevWater === null || currentElectric === null || electricRate === null || waterRate === null || baseRent === null || otherFees === null || carry === null) {
    return { ok: false, message: 'กรอกตัวเลขไม่ติดลบและทศนิยมไม่เกิน 2 ตำแหน่งให้ครบ' };
  }
  if (input.isRollover && input.isReplaced) return { ok: false, message: 'เลือกชนรอบหรือเปลี่ยนมิเตอร์ได้อย่างใดอย่างหนึ่ง' };
  const rollover = BigInt(1000000);
  if (input.isRollover && (prevElectric >= rollover || currentElectric >= rollover)) return { ok: false, message: 'มิเตอร์ชนรอบต้องมีเลขเก่าและเลขใหม่ต่ำกว่า 10000' };
  const electricUnits = input.isReplaced ? carry + currentElectric : input.isRollover ? rollover - prevElectric + currentElectric : currentElectric - prevElectric;
  if (electricUnits < BigInt(0)) return { ok: false, message: 'เลขไฟใหม่ต่ำกว่าเลขเก่า กรุณาเลือกชนรอบหรือเปลี่ยนมิเตอร์' };
  let waterUnits = BigInt(0);
  if (context.waterType === 'PER_UNIT') {
    const currentWater = hundredths(input.currentWater);
    if (currentWater === null) return { ok: false, message: 'กรุณากรอกเลขมิเตอร์น้ำ' };
    waterUnits = currentWater - prevWater;
    if (waterUnits < BigInt(0)) return { ok: false, message: 'เลขน้ำใหม่ต้องไม่น้อยกว่าเลขน้ำเก่า' };
  } else if (context.waterType !== 'FLAT_RATE') return { ok: false, message: 'รูปแบบค่าน้ำไม่ถูกต้อง' };
  const electricAmount = (electricUnits * electricRate + BigInt(50)) / BigInt(100);
  const waterAmount = context.waterType === 'FLAT_RATE' ? waterRate : (waterUnits * waterRate + BigInt(50)) / BigInt(100);
  const totalAmount = baseRent + otherFees + electricAmount + waterAmount;
  if ([electricUnits, waterUnits, electricAmount, waterAmount, totalAmount].some(value => value > max)) return { ok: false, message: 'ยอดเงินหรือหน่วยใช้เกินขอบเขตที่ระบบรองรับ' };
  const previousUnits = context.previousElectricUnits === null ? null : hundredths(context.previousElectricUnits);
  if (context.previousElectricUnits !== null && previousUnits === null) return { ok: false, message: 'ข้อมูลหน่วยใช้เดือนก่อนไม่ถูกต้อง' };
  return { ok: true, data: {
    electricUnits: asNumber(electricUnits), waterUnits: asNumber(waterUnits),
    electricAmount: asNumber(electricAmount), waterAmount: asNumber(waterAmount),
    baseRent: asNumber(baseRent), otherFees: asNumber(otherFees), totalAmount: asNumber(totalAmount),
    previousElectricUnits: previousUnits === null ? null : asNumber(previousUnits),
    softWarning: electricUnits > BigInt(50000) || (previousUnits !== null && electricUnits > previousUnits * BigInt(3)),
  } };
}
export function previousCycle(cycle: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(cycle) || Number(cycle.slice(0, 4)) < 1900 || Number(cycle.slice(0, 4)) > 9998) return null;
  const year = Number(cycle.slice(0, 4)), month = Number(cycle.slice(5));
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}
export function defaultDueDate(cycle: string): string {
  if (!previousCycle(cycle)) throw new Error('Invalid billing cycle');
  const year = Number(cycle.slice(0, 4)), month = Number(cycle.slice(5));
  return month === 12 ? `${year + 1}-01-05` : `${year}-${String(month + 1).padStart(2, '0')}-05`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
