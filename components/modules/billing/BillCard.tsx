'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Share2 } from 'lucide-react';
import { thaiCycle, thaiDueDate } from '@/lib/dashboard/dates';
import EasySlipUploader from '@/components/modules/slip/EasySlipUploader';
import { billMessage } from '@/lib/dashboard/model';
import type { DashboardBill, TrafficStatus } from '@/lib/dashboard/model';
const appearance = {
  PAID: { border: 'border-emerald-600', badge: 'bg-emerald-50 text-emerald-800', label: '🟢 ชำระแล้ว' },
  PENDING_PAYMENT: { border: 'border-amber-600', badge: 'bg-amber-50 text-amber-800', label: '🟡 รอชำระ' },
  OVERDUE: { border: 'border-rose-600', badge: 'bg-rose-50 text-rose-800', label: '🔴 ค้างชำระ' },
};
export default function BillCard({ bill, status }: { bill: DashboardBill; status: TrafficStatus }) {
  const [feedback, setFeedback] = useState('');
  const [sharing, setSharing] = useState(false);
  const [fallbackText, setFallbackText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colors = appearance[status];
  const money = new Intl.NumberFormat('th-TH',{ style: 'currency',currency: 'THB' });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function notify(text: string) {
    if (timer.current) clearTimeout(timer.current);
    setFeedback(text); timer.current = setTimeout(() => setFeedback(''),3500);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setFallbackText(''); notify('คัดลอกข้อความแล้ว!'); }
    catch { setFallbackText(text); notify('คัดลอกอัตโนมัติไม่ได้ แตะค้างที่ข้อความด้านล่างเพื่อคัดลอก'); }
  }
  async function share() {
    if (sharing) return;
    const text = billMessage(bill);
    if (!navigator.share) { await copy(text); return; }
    setSharing(true);
    try { await navigator.share({ title: `${bill.property.name} · ห้อง ${bill.room.room_number}`, text }); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) { setFallbackText(text); notify('แชร์ไม่สำเร็จ คัดลอกข้อความด้านล่างเพื่อส่งเข้า LINE'); } }
    finally { setSharing(false); }
  }
  return <article className={`space-y-4 rounded-2xl border border-l-[6px] bg-white p-5 shadow-sm ${colors.border}`}>
    <header className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">ห้อง {bill.room.room_number}</h2><p className="mt-1 text-sm font-medium text-slate-600">{bill.property.name}{bill.room.tenant_name ? ` · ${bill.room.tenant_name}` : ''}</p></div><span className={`shrink-0 rounded-full px-3 py-2 text-sm font-bold ${colors.badge}`}>{colors.label}</span></header>
    <div><p className="text-sm font-medium text-slate-600">รอบ {thaiCycle(bill.billing_cycle,true)} · ครบกำหนด {thaiDueDate(bill.due_date)}</p><p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight">{money.format(bill.total_amount)}</p></div>
    {status === 'PAID' && <p className="text-sm text-emerald-700">{bill.payment_method === 'MANUAL' ? 'เจ้าของหอยืนยันรับเงิน' : 'ตรวจสอบผ่าน EasySlip'}{bill.paid_at ? ` · ${new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}).format(new Date(bill.paid_at))}` : ''}</p>}
    <div className="flex gap-2 sm:gap-3">
      <button type="button" disabled={sharing} onClick={share} className="flex h-12 min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2 text-base font-semibold text-white hover:bg-blue-700"><Share2 size={20} className="shrink-0" aria-hidden />ส่งบิล LINE</button>
      {status !== 'PAID' && <button type="button" onClick={() => copy(billMessage(bill,true))} className="flex h-12 min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 text-base font-semibold text-slate-700 hover:bg-slate-50"><MessageCircle size={20} className="shrink-0" aria-hidden />ทวงเงิน</button>}
    </div>
    {feedback && <p role="status" className="text-sm font-semibold text-brand">{feedback}</p>}
    {fallbackText && <label className="block space-y-2"><span className="text-sm">ข้อความสำหรับส่งบิล</span><textarea readOnly rows={7} value={fallbackText} onFocus={e => e.target.select()} className="text-sm" /></label>}
    <EasySlipUploader billId={bill.id} usedCount={bill.slip_verify_count} paid={status === 'PAID'} amount={bill.total_amount} roomNumber={bill.room.room_number} />
  </article>;
}
