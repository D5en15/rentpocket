'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ImagePlus, LoaderCircle, Upload } from 'lucide-react';
import { verifyEasySlipAction, markBillManualPaidAction } from '@/server/actions/slip.actions';
import { MAX_SLIP_BYTES } from '@/lib/slip/types';
import type { SlipResult } from '@/lib/slip/types';
export default function EasySlipUploader({ billId, usedCount, paid, amount, roomNumber }: {
  billId: string; usedCount: number; paid: boolean; amount: number; roomNumber: string;
}) {
  const [reservedCount, setReservedCount] = useState(usedCount);
  const remaining = Math.max(0,3-Math.max(usedCount,reservedCount));
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [locallyPaid, setLocallyPaid] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const isPaid = paid || locallyPaid;
  useEffect(() => {
    if (manualOpen && !dialog.current?.open) dialog.current?.showModal();
    if (!manualOpen && dialog.current?.open) dialog.current?.close();
  }, [manualOpen]);
  function report(result: SlipResult) {
    if (result.remaining !== undefined) setReservedCount(3-result.remaining);
    if (result.ok || result.code === 'ALREADY_PAID') { setLocallyPaid(true); setManualOpen(false); }
    setFeedback({ ok: result.ok, text: result.ok ? 'ยืนยันการชำระเงินเรียบร้อย' : result.message });
    router.refresh();
  }
  function verify(form: FormData) {
    const file = form.get('image');
    if (!(file instanceof File) || !file.size || file.size > MAX_SLIP_BYTES || !['image/jpeg','image/png','image/gif','image/webp'].includes(file.type)) {
      setFeedback({ ok: false, text: 'กรุณาเลือกภาพ JPEG, PNG, GIF หรือ WebP ขนาดไม่เกิน 4 MB' }); return;
    }
    startTransition(async () => {
      setFeedback(null);
      const upload = new FormData();
      upload.set('image', file);
      try { report(await verifyEasySlipAction(billId,upload)); }
      catch { setFeedback({ ok: false, text: 'การเชื่อมต่อขัดข้อง กรุณาโหลดหน้าจอเพื่อตรวจสถานะและโควตาก่อนลองอีกครั้ง' }); router.refresh(); }
    });
  }
  function manual() {
    startTransition(async () => {
      try { report(await markBillManualPaidAction(billId)); }
      catch { setFeedback({ ok: false, text: 'บันทึกไม่สำเร็จ กรุณาตรวจสถานะบิลก่อนลองใหม่' }); router.refresh(); }
    });
  }
  return <section className="space-y-3 rounded-xl border border-slate-100 bg-white p-3" aria-label={`ตรวจสลิปห้อง ${roomNumber}`}>
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">ตรวจสลิปโอนเงิน</h3><span className="rounded-full bg-blue-50 px-2.5 py-1.5 font-mono text-sm font-semibold tabular-nums tracking-tight text-brand">เหลือ {remaining}/3 ครั้ง</span></div>
    {isPaid ? <p className="flex min-h-12 items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={20} aria-hidden />บิลนี้ชำระแล้ว</p> : <>
      <form action={verify} className="space-y-3"><fieldset disabled={pending || remaining === 0} className="space-y-3">
        <input ref={input} type="file" name="image" accept="image/jpeg,image/png,image/gif,image/webp" aria-label="รูปภาพสลิป" onChange={event => setFileName(event.target.files?.[0]?.name ?? '')} className="hidden" />
        <button type="button" onClick={() => input.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault();
          if (pending || remaining === 0 || !input.current) return;
          const file = event.dataTransfer.files[0];
          if (file) { const transfer = new DataTransfer(); transfer.items.add(file); input.current.files = transfer.files; setFileName(file.name); }
        }} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center transition-all hover:border-blue-500 hover:bg-blue-50/50">
          <ImagePlus size={22} className="shrink-0 text-blue-600" aria-hidden />
          <span className="min-w-0 text-sm font-semibold text-slate-700">แตะเพื่อเลือกรูปภาพสลิป</span>
        </button>
        {fileName && <p className="break-all text-sm text-slate-600">{fileName}</p>}
        {fileName && <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 font-bold text-white">{pending ? <><LoaderCircle className="animate-spin" size={20} aria-hidden />กำลังตรวจสอบ…</> : <><Upload size={20} aria-hidden />ตรวจสลิป</>}</button>}
      </fieldset></form>
      {remaining === 0 && <p className="text-sm text-amber-800">หมดโควตาตรวจอัตโนมัติ ใช้การยืนยันยอดด้วยตนเองได้</p>}
      <button type="button" disabled={pending} onClick={() => setManualOpen(true)} className="h-11 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">✍️ ยืนยันยอดด้วยตนเอง</button>
    </>}
    {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={`rounded-xl border p-3 text-sm ${feedback.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>{feedback.text}</p>}
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!pending) setManualOpen(false); }} aria-labelledby={`manual-title-${billId}`} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-amber-500 bg-white p-5 shadow-xl backdrop:bg-slate-950/60">
      <h3 id={`manual-title-${billId}`} className="flex items-center gap-2 text-xl font-bold text-amber-800"><AlertTriangle size={24} aria-hidden />ยืนยันรับเงินด้วยตนเอง</h3>
      <p className="my-4">ห้อง {roomNumber} ยอด <strong className="font-mono tabular-nums tracking-tight">{new Intl.NumberFormat('th-TH',{ style: 'currency',currency: 'THB' }).format(amount)}</strong></p>
      <p className="mb-5 text-slate-600">ยืนยันเมื่อคุณตรวจว่ารับเงินจริงแล้ว เช่น เงินสด หรือยอดโอนเข้าบัญชี ระบบจะบันทึกว่าชำระแล้วด้วยการยืนยันของเจ้าของหอ</p>
      <div className="space-y-3"><button type="button" autoFocus disabled={pending} onClick={() => setManualOpen(false)} className="h-14 w-full rounded-xl border border-slate-300 font-bold">กลับไปตรวจสอบ</button><button type="button" disabled={pending || isPaid} onClick={manual} className="h-14 w-full rounded-xl bg-emerald-600 font-bold text-white">{pending ? 'กำลังบันทึก…' : 'ยืนยันว่ารับเงินแล้ว'}</button></div>
    </dialog>
  </section>;
}
