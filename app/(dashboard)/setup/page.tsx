import { getSetupDataAction } from '@/server/actions/property.actions';
import SetupForms from '@/components/setup-forms';
import SetupAuth from '@/components/setup-auth';
export const dynamic = 'force-dynamic';
export default async function SetupPage() {
  const result = await getSetupDataAction();
  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-8">
    <header><p className="text-sm font-semibold text-slate-500">พื้นที่จัดการของคุณ</p><h1 className="mt-2 text-2xl font-bold">ตั้งค่าหอพักและห้อง</h1><p className="mt-2 text-slate-600">ตั้งค่าบัญชีรับเงิน เรทน้ำไฟ และเพิ่มห้องพัก</p></header>
    {result.ok ? <SetupForms initial={result.data} /> : result.code === 'UNAUTHENTICATED' ? <SetupAuth /> : <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-bold">ยังไม่สามารถโหลดข้อมูลได้</h2><p className="mt-2">{result.message}</p></section>}
  </main>;
}
