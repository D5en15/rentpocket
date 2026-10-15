'use server';
import { devMockEnabled, mockPay } from '@/lib/dev/mock';
import { Buffer } from 'node:buffer';
import { revalidatePath } from 'next/cache';
import { authenticatedClient, uuidPattern } from './shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { slipImageDataUri, slipUploadFile } from '@/lib/slip/image';
import { requestEasySlip, receiverAccountFromConfig, validateEasySlipResponse } from '@/lib/slip/easyslip';
import { SlipError } from '@/lib/slip/types';
import type { SlipReservation, SlipResult } from '@/lib/slip/types';
import { paymentError } from '@/lib/slip/errors';
export async function verifyEasySlipAction(billId: string, image: FormData): Promise<SlipResult> {
  if (!uuidPattern.test(billId)) return { ok: false, code: 'INVALID_INPUT', message: 'รหัสบิลไม่ถูกต้อง' };
  if (devMockEnabled()) {
    try { slipUploadFile(image); }
    catch { return { ok: false, code: 'INVALID_INPUT', message: 'กรุณาเลือกรูปสลิปที่ถูกต้อง' }; }
    const result = mockPay(billId, true); revalidatePath('/dashboard'); return result;
  }
  let reservation: SlipReservation | undefined;
  let admin: ReturnType<typeof createAdminClient> | undefined;
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return { ok: false, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };
    const key = process.env.EASYSLIP_API_KEY;
    if (!key) throw new SlipError('CONFIGURATION_ERROR','ระบบตรวจสลิปยังไม่ได้ตั้งค่า EasySlip API key กรุณายืนยันยอดด้วยตนเอง');
    admin = createAdminClient();
    const file = slipUploadFile(image);
    // Base64 is generated only on the trusted server-to-provider path.
    const base64 = slipImageDataUri(Buffer.from(await file.arrayBuffer()));
    // Read through owner RLS and check property-specific config before quota use.
    const lookup = await client.from('bills').select('property_id').eq('id',billId).maybeSingle();
    if (lookup.error) return paymentError(lookup.error);
    if (!lookup.data) throw new SlipError('FORBIDDEN','ไม่พบบิลหรือไม่มีสิทธิ์จัดการบิลนี้');
    receiverAccountFromConfig(process.env.EASYSLIP_RECEIVER_ACCOUNTS, lookup.data.property_id);
    // RPC atomically reserves both the bill quota and 15/property/Bangkok-day
    // quota. Any rejection (including the daily cap) returns before EasySlip.
    const { data, error } = await client.rpc('reserve_slip_verification', { p_bill_id: billId });
    if (error) return paymentError(error);
    reservation = data as SlipReservation;
    if (!reservation || reservation.owner_id !== user.id || reservation.bill_id !== billId || !uuidPattern.test(reservation.attempt_id)) throw new SlipError('DATABASE_ERROR','ข้อมูลโควตาตรวจสลิปไม่สมบูรณ์');
    revalidatePath('/dashboard');
    const account = receiverAccountFromConfig(process.env.EASYSLIP_RECEIVER_ACCOUNTS, reservation.property_id);
    const payload = await requestEasySlip(base64, key, Number(reservation.expected_amount));
    const slip = validateEasySlipResponse(payload, reservation.expected_amount, reservation.promptpay_id, account);
    const completed = await admin.rpc('complete_slip_payment', {
      p_attempt_id: reservation.attempt_id, p_owner_id: user.id, p_trans_ref: slip.transRef,
      p_amount: slip.amount, p_transfer_date: slip.transferDate, p_sender_bank: slip.senderBank,
      p_receiver_account: slip.receiverAccount, p_raw_payload: slip.rawPayload,
    });
    if (completed.error) {
      await admin.rpc('fail_slip_verification', { p_attempt_id: reservation.attempt_id, p_owner_id: user.id });
      return { ...paymentError(completed.error), remaining: reservation.remaining };
    }
    revalidatePath('/dashboard'); revalidatePath('/meters');
    return { ok: true, method: 'EASYSLIP', remaining: reservation.remaining };
  } catch (error) {
    if (reservation && admin) {
      try { await admin.rpc('fail_slip_verification', { p_attempt_id: reservation.attempt_id, p_owner_id: reservation.owner_id }); }
      catch { console.error('Could not release slip verification attempt'); }
      revalidatePath('/dashboard');
    }
    return { ok: false, code: error instanceof SlipError ? error.code : 'CONFIGURATION_ERROR',
      message: error instanceof SlipError ? error.message : 'เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสถานะบิล หรือยืนยันยอดด้วยตนเอง',
      ...(reservation ? { remaining: reservation.remaining } : {}) };
  }
}
export async function markBillManualPaidAction(billId: string): Promise<SlipResult> {
  if (!uuidPattern.test(billId)) return { ok: false, code: 'INVALID_INPUT', message: 'รหัสบิลไม่ถูกต้อง' };
  if (devMockEnabled()) { const result = mockPay(billId, false); revalidatePath('/dashboard'); revalidatePath('/meters'); return result; }
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return { ok: false, code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' };
    const { data, error } = await client.rpc('mark_bill_manual_paid', { p_bill_id: billId });
    if (error) return paymentError(error);
    revalidatePath('/dashboard'); revalidatePath('/meters');
    return { ok: true, method: 'MANUAL', remaining: Number(data.remaining) };
  } catch { return { ok: false, code: 'CONFIGURATION_ERROR', message: 'เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจสถานะบิลก่อนลองใหม่' }; }
}
