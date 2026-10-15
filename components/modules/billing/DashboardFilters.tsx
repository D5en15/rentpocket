'use client';
import { useTransition } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { thaiCycle } from '@/lib/dashboard/dates';
import type { Property } from '@/server/actions/types';
export default function DashboardFilters({ cycle, propertyId, cycles, properties }: { cycle: string; propertyId: string; cycles: string[]; properties: Property[] }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const [pending, startTransition] = useTransition();
  function apply(nextCycle: string, nextProperty: string) {
    if (pending || (nextCycle === cycle && nextProperty === propertyId)) return;
    const next = new URLSearchParams(params.toString());
    next.set('cycle',nextCycle);
    if (nextProperty) next.set('property',nextProperty); else next.delete('property');
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }
  return <form aria-label="ตัวกรองแดชบอร์ด" aria-busy={pending} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); apply(String(form.get('cycle')),String(form.get('property'))); }} className="relative grid grid-cols-2 items-end gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex sm:gap-3">
    <label className="min-w-0 space-y-1 sm:w-48"><span className="text-sm font-semibold text-slate-600">รอบบิล</span><div className="relative"><select name="cycle" value={cycle} disabled={pending} onChange={event => apply(event.target.value,propertyId)} className="h-12 min-w-0 appearance-none truncate pl-3 pr-8 text-base"><option hidden value="">เลือกรอบบิล</option>{cycles.map(value => <option key={value} value={value}>{thaiCycle(value)}</option>)}</select><ChevronDown size={20} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden /></div></label>
    <label className="min-w-0 space-y-1 sm:w-60"><span className="text-sm font-semibold text-slate-600">หอพัก</span><div className="relative"><select name="property" value={propertyId} disabled={pending} onChange={event => apply(cycle,event.target.value)} className="h-12 min-w-0 appearance-none truncate pl-3 pr-8 text-base"><option value="">ทุกหอพัก</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={20} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden /></div></label>
    <button disabled={pending} type="submit" className="hidden h-12 min-w-32 justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-blue-900 sm:inline-flex sm:items-center">{pending ? <><LoaderCircle size={18} className="animate-spin" aria-hidden />กำลังโหลด…</> : 'แสดงผล'}</button>
    {pending && <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 sm:hidden"><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-brand shadow-sm"><LoaderCircle size={18} className="animate-spin" />กำลังโหลด…</span></div>}
    <span role="status" className="sr-only">{pending ? 'กำลังโหลดข้อมูลรอบบิล' : ''}</span>
  </form>;
}
