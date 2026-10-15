import { calculateBill, previousCycle, validDate } from '../billing/calculation.ts';
import type { BillCalculation } from '../billing/calculation.ts';
export type FreeRoomInput = {
  roomName: string; baseRent: string; previousElectric: string; currentElectric: string; electricRate: string;
  waterType: 'PER_UNIT' | 'FLAT_RATE'; previousWater: string; currentWater: string; waterRate: string; otherFees: string; isRollover: boolean;
};
export type FreeBill = {
  propertyName: string; roomName: string; cycle: string; dueDate: string;
  promptpayId: string; promptpayName: string;
  previousElectric: number; currentElectric: number; electricRate: number; isRollover: boolean;
  waterType: 'PER_UNIT' | 'FLAT_RATE'; previousWater: number; currentWater: number; waterRate: number;
  calculation: BillCalculation;
};
export function freeBill(room: FreeRoomInput, details: { propertyName: string; cycle: string; dueDate: string; promptpayId: string; promptpayName: string }): { ok: true; bill: FreeBill } | { ok: false; message: string } {
  if (!room.roomName.trim() || room.roomName.length > 50 || details.propertyName.length > 255 || details.promptpayName.length > 255) return { ok: false,message: 'กรุณากรอกชื่อห้องให้ถูกต้อง' };
  if (!previousCycle(details.cycle) || !validDate(details.dueDate)) return { ok: false,message: 'กรุณาเลือกเดือนและกำหนดชำระให้ถูกต้อง' };
  const result = calculateBill({ previousElectric: room.previousElectric,previousWater: room.waterType === 'FLAT_RATE' ? '0' : room.previousWater,
    previousElectricUnits: null,electricRate: room.electricRate,waterRate: room.waterRate,waterType: room.waterType,baseRent: room.baseRent },
    { currentElectric: room.currentElectric,currentWater: room.currentWater,isRollover: room.isRollover,isReplaced: false,carryUnits: '0',otherFees: room.otherFees });
  if (!result.ok) return result;
  const decimal = (value: string) => Number(value.trim().replace(',','.'));
  return { ok: true,bill: { ...details,propertyName: details.propertyName.trim(),promptpayId: details.promptpayId.trim(),promptpayName: details.promptpayName.trim(),roomName: room.roomName.trim(),
    previousElectric: decimal(room.previousElectric),currentElectric: decimal(room.currentElectric),electricRate: decimal(room.electricRate),isRollover: room.isRollover,
    waterType: room.waterType,previousWater: room.waterType === 'FLAT_RATE' ? 0 : decimal(room.previousWater),currentWater: room.waterType === 'FLAT_RATE' ? 0 : decimal(room.currentWater),waterRate: decimal(room.waterRate),calculation: result.data } };
}
export function billFilename(bill: Pick<FreeBill,'roomName' | 'cycle'>): string {
  const room = bill.roomName.replace(/[\\/<>:"|?*\u0000-\u001f]/g,'-').trim().slice(0,50) || 'room';
  return `RentPocket-${bill.cycle}-${room}.png`;
}
export function freeBillText(bill: FreeBill): string {
  const format = new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  return `แจ้งยอดห้อง ${bill.roomName}\n${bill.propertyName ? `${bill.propertyName}\n` : ''}รอบ ${bill.cycle}\nค่าเช่า ${format.format(bill.calculation.baseRent)} บาท\nค่าไฟ ${format.format(bill.calculation.electricAmount)} บาท\nค่าน้ำ ${format.format(bill.calculation.waterAmount)} บาท\nค่าใช้จ่ายอื่น ${format.format(bill.calculation.otherFees)} บาท\nยอดรวม ${format.format(bill.calculation.totalAmount)} บาท\nกำหนดชำระ ${bill.dueDate}\nPromptPay ${bill.promptpayId}${bill.promptpayName ? `\nชื่อบัญชี ${bill.promptpayName}` : ''}\nโอนแล้วรบกวนส่งสลิปด้วยนะคะ/ครับ`;
}
