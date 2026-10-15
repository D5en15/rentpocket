import { moneyCents } from '../slip/easyslip.ts';
export type TrafficStatus = 'PAID' | 'PENDING_PAYMENT' | 'OVERDUE';
export type DashboardBill = {
  id: string; billing_cycle: string; status: TrafficStatus; due_date: string;
  base_rent: number; electric_units: number; electric_amount: number; water_amount: number; other_fees: number; total_amount: number;
  slip_verify_count: number; payment_method: 'EASYSLIP' | 'MANUAL' | null; paid_at: string | null;
  room: { room_number: string; tenant_name: string | null };
  property: { id: string; name: string; promptpay_id: string; promptpay_name: string };
};
export function bangkokDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}
export function trafficStatus(bill: Pick<DashboardBill,'status' | 'due_date'>, today: string): TrafficStatus {
  if (bill.status === 'PAID') return 'PAID';
  return bill.due_date < today ? 'OVERDUE' : 'PENDING_PAYMENT';
}
export function dashboardSummary(bills: DashboardBill[], today: string) {
  let total = BigInt(0), collected = BigInt(0);
  const counts: Record<TrafficStatus,number> = { PAID: 0, PENDING_PAYMENT: 0, OVERDUE: 0 };
  for (const bill of bills) {
    const cents = moneyCents(bill.total_amount);
    if (cents === null) throw new Error('Invalid bill total');
    const status = trafficStatus(bill,today);
    counts[status] += 1; total += cents;
    if (status === 'PAID') collected += cents;
  }
  return { total: Number(total) / 100, collected: Number(collected) / 100, outstanding: Number(total-collected) / 100, counts };
}
export function billMessage(bill: DashboardBill, reminder = false): string {
  const money = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const due = `${bill.due_date.slice(8,10)}/${bill.due_date.slice(5,7)}/${Number(bill.due_date.slice(0,4)) + 543}`;
  const greeting = reminder ? 'สวัสดีค่ะ/ครับ ขออนุญาตแจ้งเตือนยอดค้างชำระ' : 'แจ้งยอดค่าเช่าและค่าน้ำไฟ';
  return `${greeting}\n${bill.property.name} ห้อง ${bill.room.room_number}\nรอบบิล ${bill.billing_cycle}\nค่าเช่า ${money.format(bill.base_rent)} บาท\nค่าไฟ ${money.format(bill.electric_amount)} บาท\nค่าน้ำ ${money.format(bill.water_amount)} บาท\nค่าใช้จ่ายอื่น ${money.format(bill.other_fees)} บาท\nยอดรวม ${money.format(bill.total_amount)} บาท\nกำหนดชำระ ${due}\nPromptPay ${bill.property.promptpay_id}\nชื่อบัญชี ${bill.property.promptpay_name}\n${reminder ? 'หากชำระแล้ว รบกวนส่งสลิปให้ตรวจสอบด้วยนะคะ/ครับ ขอบคุณค่ะ/ครับ' : 'โอนแล้วรบกวนส่งสลิปด้วยนะคะ/ครับ ขอบคุณค่ะ/ครับ'}`;
}
