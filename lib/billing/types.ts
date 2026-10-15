import type { BillCalculation, MeterInput } from './calculation';
export type BillingRoom = {
  id: string; room_number: string; floor: number | null; status: string;
  base_rent: number; electric_rate: number; water_rate: number; water_billing_type: 'PER_UNIT' | 'FLAT_RATE';
};
export type MeterBill = {
  id: string; room_id: string; property_id: string; billing_cycle: string; status: 'DRAFT' | 'PENDING_PAYMENT' | 'PAID' | 'OVERDUE';
  prev_electric_meter: number; curr_electric_meter: number; prev_water_meter: number; curr_water_meter: number;
  electric_units: number; water_units: number; electric_amount: number; water_amount: number;
  electric_rate: number; water_rate: number; water_billing_type: 'PER_UNIT' | 'FLAT_RATE';
  previous_electric_units: number | null; base_rent: number; other_fees: number; total_amount: number;
  due_date: string; is_meter_rollover: boolean; is_meter_replaced: boolean; replaced_meter_carry_units: number;
  updated_at: string;
};
export type BillingCycleData = { rooms: BillingRoom[]; bills: MeterBill[]; expired: boolean };
export type MeterReading = Omit<MeterInput, 'carryUnits'> & { oldFinal: string; newInitial: string } & { billId: string; expectedUpdatedAt: string; dueDate: string; confirmWarning: boolean };
export type MeterWarning = BillCalculation & { billId: string; roomNumber: string };
export type MeterSaveResult =
  | { ok: true; data: { saved: number } }
  | { ok: false; code: 'SOFT_WARNING'; message: string; warnings: MeterWarning[] }
  | { ok: false; code: string; message: string };
