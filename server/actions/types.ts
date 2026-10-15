export type ErrorCode = 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'QUOTA_EXCEEDED' | 'SUBSCRIPTION_EXPIRED' | 'SUBSCRIPTION_NOT_FOUND' | 'DUPLICATE_ROOM' | 'DATABASE_ERROR' | 'CONFIGURATION_ERROR' | 'BILL_LOCKED' | 'STALE_READING' | 'METER_DECREASED' | 'INVALID_REPLACEMENT' | 'BILLING_CYCLE_OUT_OF_RANGE';
export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; message: string };
export type Property = {
  id: string; name: string; address: string | null; promptpay_id: string; promptpay_name: string;
  default_electric_rate: number; default_water_rate: number; default_water_type: 'PER_UNIT' | 'FLAT_RATE';
};
export type SetupData = {
  properties: Property[]; usedRooms: number; maxRooms: number; status: string; expired: boolean;
};
