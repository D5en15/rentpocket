import { getSetupDataAction } from '@/server/actions/property.actions';
import SetupAuth from '@/components/setup-auth';
import MeterWorkspace from '@/components/modules/billing/MeterWorkspace';
import { getOrCreateBillingCycleAction } from '@/server/actions/bill.actions';
export const dynamic = 'force-dynamic';
export default async function MetersPage() {
  const result = await getSetupDataAction();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const cycle = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`;
  const initial = result.ok && result.data.properties[0] ? await getOrCreateBillingCycleAction(result.data.properties[0].id, cycle) : null;
  return <main className="mx-auto max-w-lg space-y-3 px-4 py-4 sm:py-6 pb-28 sm:pb-8">
    <header className="space-y-1"><div className="flex items-center justify-between"><p className="font-bold text-brand">RentPocket</p></div><h1 className="text-2xl font-extrabold">เดินจดมิเตอร์</h1><p className="text-slate-600">กรอกเลขใหม่ ตรวจยอด แล้วออกบิลได้ทีละห้องหรือทั้งชุด</p></header>
    {result.ok ? <MeterWorkspace setup={result.data} currentCycle={cycle} initialData={initial?.ok ? initial.data : undefined} initialError={initial && !initial.ok ? initial.message : undefined} /> : result.code === 'UNAUTHENTICATED' ? <SetupAuth /> : <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5">{result.message}</section>}
  </main>;
}
