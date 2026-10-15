import DashboardFilters from '@/components/modules/billing/DashboardFilters';
import { cycleChoices } from '@/lib/dashboard/dates';
import SetupAuth from '@/components/setup-auth';
import TrafficDashboard from '@/components/modules/billing/TrafficDashboard';
import { getSetupDataAction } from '@/server/actions/property.actions';
import { getDashboardBillsAction } from '@/server/actions/dashboard.actions';
import { bangkokDate } from '@/lib/dashboard/model';
import { previousCycle } from '@/lib/billing/calculation';
export const dynamic = 'force-dynamic';
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ cycle?: string | string[]; property?: string | string[] }> }) {
  const params = await searchParams;
  const today = bangkokDate();
  const cycle = typeof params.cycle === 'string' && previousCycle(params.cycle) ? params.cycle : today.slice(0,7);
  const property = typeof params.property === 'string' ? params.property : '';
  const setup = await getSetupDataAction();
  if (!setup.ok) return <main className="mx-auto max-w-2xl space-y-5 px-4 py-6"><h1 className="text-2xl font-bold">แดชบอร์ดรายรับ</h1>{setup.code === 'UNAUTHENTICATED' ? <SetupAuth /> : <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-800">{setup.message}</p>}</main>;
  const result = await getDashboardBillsAction(cycle,property);
  return <main className="mx-auto max-w-7xl space-y-6 px-4 pt-4 pb-28 sm:px-6 sm:pt-6 sm:pb-8">
    <header><p className="text-sm font-semibold text-slate-600">ภาพรวมการเงิน</p><h1 className="mt-2 text-2xl font-extrabold">แดชบอร์ดรายรับ</h1></header>
    <DashboardFilters key="dashboard-filters" cycle={cycle} propertyId={property} cycles={cycleChoices(today.slice(0,7),cycle)} properties={setup.data.properties} />
    {result.ok ? <TrafficDashboard key={`traffic-${cycle}-${property}`} bills={result.data} initialToday={today} /> : <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{result.message}</p>}
  </main>;
}
