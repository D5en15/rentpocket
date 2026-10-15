'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { bangkokDate, dashboardSummary, trafficStatus } from '@/lib/dashboard/model';
import type { DashboardBill, TrafficStatus } from '@/lib/dashboard/model';
import BillCard from './BillCard';
const tabs: { status: TrafficStatus; label: string; color: string; selected: string }[] = [
  { status: 'PAID', label: 'ชำระแล้ว', color: 'text-emerald-800', selected: 'border-emerald-600 bg-emerald-50' },
  { status: 'PENDING_PAYMENT', label: 'รอชำระ', color: 'text-amber-800', selected: 'border-amber-600 bg-amber-50' },
  { status: 'OVERDUE', label: 'ค้างชำระ', color: 'text-rose-800', selected: 'border-rose-600 bg-rose-50' },
];
export default function TrafficDashboard({ bills, initialToday }: { bills: DashboardBill[]; initialToday: string }) {
  const [tab, setTab] = useState<TrafficStatus>('PENDING_PAYMENT');
  const [today,setToday] = useState(initialToday);
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { setToday(bangkokDate()); if (document.visibilityState === 'visible') router.refresh(); },60000);
    return () => clearInterval(timer);
  },[router]);
  const summary = dashboardSummary(bills,today);
  const overdueTotal = dashboardSummary(bills.filter(bill => trafficStatus(bill,today) === 'OVERDUE'),today).total;
  const filtered = bills.filter(bill => trafficStatus(bill,today) === tab);
  const money = new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'});
  const progress = Math.round(summary.total ? summary.collected / summary.total * 100 : 0);
  const mobileMoney = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 });
  return <div className="space-y-5">
    <section className="space-y-2 sm:hidden" aria-label="สรุปรายรับ (บาท)">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium text-slate-600">ยอดเก็บได้แล้ว</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-600">{progress}%</span></div><p className="mt-2 break-words font-mono text-xl font-bold tabular-nums tracking-tight text-emerald-600">{money.format(summary.collected)}</p><div role="progressbar" aria-label="ความคืบหน้ารับเงิน" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><h2 className="text-sm font-medium text-slate-600">ยอดที่ต้องเก็บ (บาท)</h2><p className="mt-2 break-words font-mono text-lg font-bold tabular-nums tracking-tight text-slate-800">{mobileMoney.format(summary.total)}</p></div>
        <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><h2 className="text-sm font-medium text-slate-600">ค้างชำระ (บาท)</h2><p className="mt-2 break-words font-mono text-lg font-bold tabular-nums tracking-tight text-rose-600">{mobileMoney.format(overdueTotal)}</p><p className="mt-1 text-sm font-medium text-slate-600">เลยกำหนด {summary.counts.OVERDUE} ห้อง</p></div>
      </div>
    </section>
    <section className="hidden sm:grid sm:grid-cols-3 sm:gap-4" aria-label="สรุปรายรับ">
      <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="text-sm font-medium text-slate-600">ยอดรวมที่ต้องเก็บ</h2><p className="mt-3 break-words font-mono text-2xl font-extrabold tabular-nums tracking-tight">{money.format(summary.total)}</p><p className="mt-3 text-sm font-medium text-slate-600">เฉพาะบิลที่ออกแล้วในรอบนี้</p></div>
      <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="text-sm font-medium text-slate-600">ยอดที่เก็บได้แล้ว</h2><p className="mt-3 break-words font-mono text-2xl font-extrabold tabular-nums tracking-tight text-emerald-600">{money.format(summary.collected)}</p><div role="progressbar" aria-label="ความคืบหน้ารับเงิน" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(summary.total ? summary.collected / summary.total * 100 : 0)} className="mt-4 h-1.5 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${summary.total ? summary.collected / summary.total * 100 : 0}%` }} /></div><p className="mt-2 text-sm text-emerald-600">เก็บได้ {Math.round(summary.total ? summary.collected / summary.total * 100 : 0)}% ของยอดทั้งหมด</p></div>
      <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="text-sm font-medium text-slate-600">ค้างชำระเลยกำหนด</h2><p className="mt-3 break-words font-mono text-2xl font-extrabold tabular-nums tracking-tight text-rose-600">{money.format(overdueTotal)}</p><p className="mt-3 text-sm font-medium text-slate-600">{summary.counts.OVERDUE} ห้องที่ต้องติดตาม</p></div>
    </section>
    <div role="tablist" aria-label="สถานะการชำระเงิน" className="grid w-full grid-cols-3 gap-2">
      {tabs.map((item,index) => <button role="tab" id={`tab-${item.status}`} aria-selected={tab === item.status} aria-controls="bill-list" tabIndex={tab === item.status ? 0 : -1} key={item.status} onClick={() => setTab(item.status)}
        onKeyDown={event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3; setTab(tabs[next].status); document.getElementById(`tab-${tabs[next].status}`)?.focus(); } }}
        className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border px-1 py-2 text-center text-sm font-semibold sm:gap-2 ${item.color} ${tab === item.status ? item.selected : 'border-slate-200 bg-white'}`}>{item.label}<span className="font-mono tabular-nums tracking-tight">({summary.counts[item.status]})</span></button>)}
    </div>
    <section id="bill-list" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.length ? filtered.map(bill => <BillCard key={bill.id} bill={bill} status={trafficStatus(bill,today)} />) : <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">ไม่มีบิลในสถานะนี้</p>}
    </section>
  </div>;
}
