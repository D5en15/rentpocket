'use client';
import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { MeterWarning } from '@/lib/billing/types';
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
export default function SoftWarningModal({ warnings, pending, onReview, onConfirm }: {
  warnings: MeterWarning[]; pending: boolean; onReview: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (warnings.length && !dialog.current?.open) dialog.current?.showModal();
    if (!warnings.length && dialog.current?.open) dialog.current.close();
  }, [warnings]);
  return <dialog ref={dialog} aria-labelledby="soft-warning-title" aria-describedby="soft-warning-description"
    onCancel={event => { event.preventDefault(); if (!pending) onReview(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border-2 border-amber-500 bg-amber-50 p-5 shadow-2xl backdrop:bg-slate-950/60">
    <div className="flex items-center gap-3 text-amber-800"><AlertTriangle aria-hidden="true" className="h-9 w-9 shrink-0" /><h2 id="soft-warning-title" className="text-xl font-extrabold">หน่วยไฟสูงผิดปกติ</h2></div>
    <p id="soft-warning-description" className="mt-3 text-amber-900">หน่วยไฟเกิน 3 เท่าของเดือนก่อน หรือเกิน 500 หน่วย กรุณาตรวจเลขมิเตอร์ก่อนออกบิล</p>
    <div className="my-5 space-y-3">{warnings.map(warning => <section key={warning.billId} className="rounded-xl border border-amber-300 bg-white p-4">
      <h3 className="font-bold">ห้อง {warning.roomNumber}</h3>
      <dl className="mt-3 space-y-2">
        <div className="flex justify-between gap-3"><dt>เดือนก่อน</dt><dd className="font-mono tabular-nums tracking-tight">{warning.previousElectricUnits === null ? 'ไม่มีประวัติ' : `${number.format(warning.previousElectricUnits)} หน่วย`}</dd></div>
        <div className="flex justify-between gap-3"><dt>เดือนนี้</dt><dd className="font-mono text-xl font-extrabold tabular-nums tracking-tight text-amber-700">{number.format(warning.electricUnits)} หน่วย</dd></div>
        <div className="flex justify-between gap-3 border-t border-amber-200 pt-3"><dt>ยอดเงินสุทธิ</dt><dd className="font-mono text-xl font-extrabold tabular-nums tracking-tight">{money.format(warning.totalAmount)}</dd></div>
      </dl>
    </section>)}</div>
    <div className="space-y-3">
      <button type="button" autoFocus disabled={pending} onClick={onReview} className="h-14 w-full rounded-xl border-2 border-amber-500 bg-white px-3 font-bold text-amber-900">ตรวจสอบตัวเลขใหม่</button>
      <button type="button" disabled={pending} onClick={onConfirm} className="h-14 w-full rounded-xl bg-amber-600 px-3 font-bold text-white">{pending ? 'กำลังออกบิล…' : 'ยืนยันว่าถูกต้อง (ออกบิลต่อ)'}</button>
    </div>
  </dialog>;
}
