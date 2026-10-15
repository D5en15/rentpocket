export const MAX_SLIP_BYTES = 4 * 1024 * 1024;
export type SlipCode = 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'ALREADY_PAID' | 'BILL_NOT_ISSUED' | 'DAILY_VERIFY_LIMIT_EXCEEDED' | 'SLIP_QUOTA_EXCEEDED' | 'VERIFICATION_IN_PROGRESS' | 'AMOUNT_MISMATCH' | 'RECEIVER_MISMATCH' | 'RECEIVER_UNVERIFIABLE' | 'DUPLICATE_SLIP' | 'INVALID_SLIP' | 'SLIP_PENDING' | 'API_TIMEOUT' | 'API_UNAVAILABLE' | 'CONFIGURATION_ERROR' | 'DATABASE_ERROR' | 'ATTEMPT_EXPIRED';
export type SlipResult = { ok: true; remaining: number; method: 'EASYSLIP' | 'MANUAL' } | { ok: false; code: SlipCode; message: string; remaining?: number };
export type SlipReservation = { attempt_id: string; bill_id: string; property_id: string; owner_id: string; expected_amount: number; promptpay_id: string; remaining: number };
export type ReceiverAccount = { bankCode: string; bankNumber: string };
export type VerifiedSlip = { transRef: string; amount: string; transferDate: string; senderBank: string | null; receiverAccount: string; rawPayload: Record<string, unknown> };
export class SlipError extends Error {
  code: SlipCode;
  constructor(code: SlipCode, message: string) { super(message); this.code = code; this.name = 'SlipError'; }
}
