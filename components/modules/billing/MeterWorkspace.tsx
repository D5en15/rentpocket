'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, CheckCircle2, LoaderCircle, RotateCcw, Save, Zap } from 'lucide-react';
import { getOrCreateBillingCycleAction, saveMeterReadingAction } from '@/server/actions/bill.actions';
import { calculateBill, hundredths, defaultDueDate } from '@/lib/billing/calculation';
import type { MeterInput, CalculationContext } from '@/lib/billing/calculation';
import type { BillingCycleData, MeterBill, MeterReading, MeterWarning } from '@/lib/billing/types';
import type { SetupData } from '@/server/actions/types';
import { cycleChoices, thaiCycle } from '@/lib/dashboard/dates';
import SoftWarningModal from './SoftWarningModal';

const digits = 'font-mono tabular-nums tracking-tight';
const primary = 'flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-3 text-base font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700';
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
type Entry = MeterInput & { dueDate: string; oldFinal: string; newInitial: string };
function freshEntry(bill: MeterBill): Entry {
  const issued = bill.status !== 'DRAFT';
  return { currentElectric: issued ? String(bill.curr_electric_meter) : '', currentWater: issued ? String(bill.curr_water_meter ?? 0) : '',
    isRollover: bill.is_meter_rollover, isReplaced: bill.is_meter_replaced,
    carryUnits: String(bill.replaced_meter_carry_units ?? 0), otherFees: String(bill.other_fees), dueDate: bill.due_date, oldFinal: String(bill.prev_electric_meter), newInitial: '0' };
}
function context(bill: MeterBill): CalculationContext {
  return { previousElectric: bill.prev_electric_meter, previousWater: bill.prev_water_meter ?? 0,
    previousElectricUnits: bill.previous_electric_units, electricRate: bill.electric_rate, waterRate: bill.water_rate,
    waterType: bill.water_billing_type, baseRent: bill.base_rent };
}
export default function MeterWorkspace({ setup, currentCycle, initialData, initialError }: { setup: SetupData; currentCycle: string; initialData?: BillingCycleData; initialError?: string }) {
  const [propertyId, setPropertyId] = useState(setup.properties[0]?.id ?? '');
  const [cycle, setCycle] = useState(currentCycle);
  const [loaded, setLoaded] = useState<{ propertyId: string; cycle: string; data: BillingCycleData } | null>(initialData ? { propertyId: setup.properties[0]?.id ?? '', cycle: currentCycle, data: initialData } : null);
  const [entries, setEntries] = useState<Record<string, Entry>>(Object.fromEntries((initialData?.bills ?? []).map(b => [b.id, freshEntry(b)])));
  const [activeId, setActiveId] = useState(initialData?.rooms.find(r => initialData.bills.some(b => b.room_id === r.id && b.status === 'DRAFT'))?.id ?? initialData?.rooms[0]?.id ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(initialError ? { ok: false, text: initialError } : null);
  const [warningState, setWarningState] = useState<{ warnings: MeterWarning[]; readings: MeterReading[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const data = loaded?.data;
  const rooms = data?.rooms ?? [];
  const bill = data?.bills.find(item => item.room_id === activeId);
  const room = rooms.find(item => item.id === activeId);
  const entry = bill ? entries[bill.id] : undefined;
  const calculated = bill && entry ? calculateBill(context(bill), entry) : null;
  const preview = entry?.isReplaced && bill?.status === 'DRAFT'
    && hundredths(entry.currentElectric) !== null && hundredths(entry.newInitial) !== null
    && hundredths(entry.currentElectric)! < hundredths(entry.newInitial)!
    ? { ok: false as const, message: 'เลขไฟใหม่ต้องไม่น้อยกว่าเลขเริ่มต้นมิเตอร์ใหม่' } : calculated;
  const done = data?.bills.filter(item => item.status !== 'DRAFT').length ?? 0;
  const readonly = pending || Boolean(data?.expired) || !bill || bill.status !== 'DRAFT';
  const electricPreview = bill && entry ? calculateBill({ ...context(bill), waterType: 'FLAT_RATE', waterRate: 0 }, entry) : null;
  const waterPreview = bill && entry ? calculateBill(context(bill), { ...entry, currentElectric: String(bill.prev_electric_meter), isRollover: false, isReplaced: false, carryUnits: '0' }) : null;

  async function fetchCycle(id: string, month: string, nextRoom?: string) {
    const result = await getOrCreateBillingCycleAction(id, month);
    if (!result.ok) { setMessage({ ok: false, text: result.message }); return false; }
    setPropertyId(id); setCycle(month);
    setLoaded({ propertyId: id, cycle: month, data: result.data });
    setEntries(Object.fromEntries(result.data.bills.map(item => [item.id, freshEntry(item)])));
    setActiveId(nextRoom ?? result.data.rooms.find(r => result.data.bills.some(b => b.room_id === r.id && b.status === 'DRAFT'))?.id ?? result.data.rooms[0]?.id ?? '');
    setDirty(false);
    return true;
  }
  function openCycle(id: string, month: string) {
    if (pending || !id) return;
    if (dirty && !window.confirm('มีเลขมิเตอร์ที่ยังไม่บันทึก ต้องการเปลี่ยนรอบและทิ้งตัวเลขที่กรอกไว้หรือไม่?')) return;
    startTransition(async () => {
      try { setMessage(null); setWarningState(null); await fetchCycle(id, month); }
      catch { setMessage({ ok: false, text: 'โหลดรอบบิลไม่สำเร็จ กรุณาลองใหม่' }); }
    });
  }
  function change(patch: Partial<Entry>) {
    if (!bill || !entry) return;
    const next = { ...entry, ...patch };
    if (next.isReplaced && ('oldFinal' in patch || 'newInitial' in patch || 'isReplaced' in patch)) {
      const oldFinal = hundredths(next.oldFinal), newInitial = hundredths(next.newInitial), previous = hundredths(bill.prev_electric_meter);
      next.carryUnits = oldFinal === null || newInitial === null || previous === null || oldFinal < previous
        ? '' : String(Number(oldFinal - previous - newInitial) / 100);
    }
    setEntries(items => ({ ...items, [bill.id]: next }));
    setDirty(true);
    setMessage(null);
  }
  function readingFor(item: MeterBill): MeterReading | null {
    const value = entries[item.id];
    if (!value || item.status !== 'DRAFT' || !calculateBill(context(item), value).ok) return null;
    if (value.isReplaced && Number(value.currentElectric.replace(',', '.')) < Number(value.newInitial.replace(',', '.'))) return null;
    return { currentElectric: value.currentElectric, currentWater: value.currentWater,
      oldFinal: value.oldFinal, newInitial: value.newInitial, otherFees: value.otherFees,
      isRollover: value.isRollover, isReplaced: value.isReplaced, dueDate: value.dueDate,
      billId: item.id, expectedUpdatedAt: item.updated_at, confirmWarning: false };
  }
  function submitReadings(readings: MeterReading[]) {
    if (!loaded || !readings.length) { setMessage({ ok: false, text: 'กรุณากรอกเลขมิเตอร์ให้ครบก่อนบันทึก' }); return; }
    startTransition(async () => {
      try {
        const result = await saveMeterReadingAction(readings);
        if (!result.ok) {
          if (result.code === 'SOFT_WARNING' && 'warnings' in result) setWarningState({ warnings: result.warnings, readings });
          else { setWarningState(null); setMessage({ ok: false, text: result.message }); }
          return;
        }
        setWarningState(null);
        // Keep unsubmitted room entries when saving just one room.
        const preserved = { ...entries };
        const ids = new Set(readings.map(item => item.billId));
        const activeIndex = rooms.findIndex(r => r.id === activeId);
        const orderedRooms = [...rooms.slice(activeIndex+1), ...rooms.slice(0,activeIndex+1)];
        const next = orderedRooms.find(r => data?.bills.some(b => b.room_id === r.id && b.status === 'DRAFT' && !ids.has(b.id)))?.id;
        const refreshed = await getOrCreateBillingCycleAction(loaded.propertyId, loaded.cycle);
        if (refreshed.ok) {
          setLoaded({ ...loaded, data: refreshed.data });
          setEntries(Object.fromEntries(refreshed.data.bills.map(b => [b.id, ids.has(b.id) || !preserved[b.id] ? freshEntry(b) : preserved[b.id]])));
          setActiveId(next ?? activeId);
          setDirty(refreshed.data.bills.some(b => b.status === 'DRAFT' && Boolean(preserved[b.id]?.currentElectric)));
          setMessage({ ok: true, text: `บันทึกและออกบิล ${result.data.saved} ห้องเรียบร้อย` });
        } else {
          // Disable submitted bills immediately even if refreshing the cycle fails.
          setLoaded({ ...loaded, data: { ...loaded.data, bills: loaded.data.bills.map(b => ids.has(b.id) ? { ...b, status: 'PENDING_PAYMENT' } : b) } });
          setMessage({ ok: true, text: 'ออกบิลสำเร็จแล้ว แต่โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณาโหลดรอบบิลใหม่' });
        }
      } catch { setMessage({ ok: false, text: 'การเชื่อมต่อขัดข้อง กรุณาโหลดรอบบิลเพื่อตรวจสถานะก่อนลองบันทึกอีกครั้ง' }); }
    });
  }
  function saveActive() {
    if (!bill) return;
    const reading = readingFor(bill);
    if (reading) submitReadings([reading]);
    else setMessage({ ok: false, text: preview && !preview.ok ? preview.message : 'กรุณากรอกเลขมิเตอร์ให้ครบ' });
  }
  function saveBatch() {
    const touched = data?.bills.filter(b => b.status === 'DRAFT' && entries[b.id]?.currentElectric.trim()) ?? [];
    const readings = touched.map(readingFor);
    if (readings.some(item => item === null)) { setMessage({ ok: false, text: 'มีห้องที่กรอกข้อมูลไม่ครบหรือเลขมิเตอร์ไม่ถูกต้อง กรุณาตรวจทุกห้องที่กรอกไว้' }); return; }
    submitReadings(readings.filter((item): item is MeterReading => item !== null));
  }
  return <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-5" aria-busy={pending}>
    <div className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-2">
      <label className="min-w-0 space-y-1"><span className="text-sm font-medium text-slate-600">หอพัก</span><select className="h-12 truncate px-2 text-base" value={propertyId} disabled={pending} onChange={e => openCycle(e.target.value,cycle)}><option value="" disabled>เลือกหอพัก</option>{setup.properties.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
      <label className="min-w-0 space-y-1"><span className="text-sm font-medium text-slate-600">รอบบิล</span><select className="h-12 px-2 text-base" value={cycle} disabled={pending} onChange={e => openCycle(propertyId,e.target.value)}>{cycleChoices(currentCycle,cycle).map(month => <option key={month} value={month}>{thaiCycle(month)}</option>)}</select></label>
    </div>
    {!setup.properties.length && <p className="text-sm text-amber-800">ยังไม่มีหอพัก <Link className="inline-flex min-h-12 items-center underline" href="/setup">ตั้งค่าหอพักก่อน</Link></p>}
    {!loaded && propertyId && <button type="button" disabled={pending} onClick={() => openCycle(propertyId,cycle)} className="min-h-12 w-full rounded-xl border border-slate-200 text-sm font-semibold text-brand">{pending ? 'กำลังโหลด…' : 'ลองโหลดข้อมูลอีกครั้ง'}</button>}
    {message && <p role={message.ok ? 'status' : 'alert'} className={`rounded-xl p-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{message.text}</p>}
    {loaded && <>
      <section className="space-y-2" aria-label="สลับห้องและความคืบหน้า">
        <div className="flex items-center justify-between gap-2 text-sm text-slate-600"><span>รอบ {thaiCycle(loaded.cycle,true).replace(/\d{2}$/, String(Number(loaded.cycle.slice(0,4))+543))}</span><span className={digits}>จดแล้ว {done}/{rooms.length} ห้อง</span></div>
        <div className="flex w-full flex-nowrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
          <button type="button" aria-label="ห้องก่อนหน้า" disabled={pending || rooms.findIndex(r => r.id === activeId) <= 0} onClick={() => setActiveId(rooms[rooms.findIndex(r => r.id === activeId)-1].id)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-transform hover:bg-slate-100 active:scale-95 disabled:opacity-40"><ChevronLeft size={24} aria-hidden /></button>
          <select aria-label="เลือกห้อง" className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-1 text-center text-base font-bold text-slate-800 shadow-none focus:border-blue-600" value={activeId} disabled={pending || !rooms.length} onChange={e => setActiveId(e.target.value)}>{rooms.map((r,index) => <option key={r.id} value={r.id}>ห้อง {r.room_number} ({index+1}/{rooms.length} ห้อง){data?.bills.find(b => b.room_id === r.id)?.status !== 'DRAFT' ? ' ✓' : ''}</option>)}</select>
          <button type="button" aria-label="ห้องถัดไป" disabled={pending || rooms.findIndex(r => r.id === activeId) >= rooms.length-1 || !rooms.length} onClick={() => setActiveId(rooms[rooms.findIndex(r => r.id === activeId)+1].id)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-transform hover:bg-slate-100 active:scale-95 disabled:opacity-40"><ChevronRight size={24} aria-hidden /></button>
        </div>
        <div role="progressbar" aria-label="ห้องที่จดแล้ว" aria-valuemin={0} aria-valuemax={rooms.length || 1} aria-valuenow={done} className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${rooms.length ? done/rooms.length*100 : 0}%` }} /></div>
      </section>
      {data?.expired && <p role="alert" className="text-sm text-amber-800">แพ็กเกจหมดอายุ ดูบิลเดิมได้ แต่ไม่สามารถออกบิลใหม่</p>}
      {!rooms.length && <p className="text-sm text-slate-600">ไม่มีห้องในหอพักนี้ <Link href="/setup" className="inline-flex min-h-12 items-center text-brand underline">เพิ่มห้องพัก</Link></p>}
      {room && !bill && <p className="text-sm text-amber-800">ยังไม่มีบิลห้อง {room.room_number} ในรอบนี้</p>}
      {bill && entry && room && <form onSubmit={event => { event.preventDefault(); saveActive(); }} className="space-y-4">
        <fieldset disabled={readonly} className="space-y-4">
          <section className="space-y-2" aria-label="มิเตอร์ไฟฟ้า">
            <div className="flex items-center justify-between"><h2 className="text-base font-bold">⚡ มิเตอร์ไฟฟ้า</h2>{bill.status !== 'DRAFT' && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={18} aria-hidden />จดแล้ว</span>}</div>
            <p className="text-sm font-semibold text-slate-500">เลขเดิม: <span className={digits}>{number.format(bill.prev_electric_meter)}</span> หน่วย</p>
            <MeterField label="เลขไฟใหม่" value={entry.currentElectric} onChange={value => change({ currentElectric: value })} />
            <p className="min-h-5 text-sm font-semibold text-blue-700" aria-live="polite">{electricPreview?.ok ? `ใช้ไป ${number.format(electricPreview.data.electricUnits)} หน่วย (${money.format(electricPreview.data.electricAmount)})` : 'กรอกเลขใหม่เพื่อดูหน่วยใช้และค่าไฟ'}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={entry.isRollover} className={`min-h-12 rounded-xl border px-2 text-sm font-semibold ${entry.isRollover ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600'}`} onClick={() => change({ isRollover: !entry.isRollover, isReplaced: false })}><Zap size={16} className="mr-1 inline" aria-hidden />มิเตอร์ชนรอบ</button>
              <button type="button" aria-pressed={entry.isReplaced} className={`min-h-12 rounded-xl border px-2 text-sm font-semibold ${entry.isReplaced ? 'border-blue-600 bg-blue-50 text-brand' : 'border-slate-200 text-slate-600'}`} onClick={() => change({ isReplaced: !entry.isReplaced, isRollover: false })}><RotateCcw size={16} className="mr-1 inline" aria-hidden />เปลี่ยนมิเตอร์</button>
            </div>
            {entry.isRollover && <p className="text-sm text-amber-800">ชนรอบที่ 10000: (10000 − เลขเดิม) + เลขใหม่</p>}
            {entry.isReplaced && bill.status === 'DRAFT' && <div className="space-y-2 rounded-xl bg-blue-50 p-3"><MeterField label="เลขสุดท้ายมิเตอร์เก่า" value={entry.oldFinal} onChange={value => change({ oldFinal: value })} /><MeterField label="เลขเริ่มต้นมิเตอร์ใหม่" value={entry.newInitial} onChange={value => change({ newInitial: value })} /><p className="text-sm text-slate-600">หน่วยปรับ (carry): {entry.carryUnits || 'กรอกเลขให้ครบ'}</p></div>}
            {entry.isReplaced && bill.status !== 'DRAFT' && <p className="text-sm text-slate-600">หน่วยปรับ (carry): {number.format(bill.replaced_meter_carry_units)}</p>}
          </section>
          <section className="space-y-2 border-t border-slate-100 pt-3" aria-label="มิเตอร์น้ำ">
            <h2 className="text-base font-bold">💧 มิเตอร์น้ำ</h2>
            {bill.water_billing_type === 'PER_UNIT' ? <><p className="text-sm font-semibold text-slate-500">เลขเดิม: <span className={digits}>{number.format(bill.prev_water_meter)}</span> หน่วย</p><MeterField label="เลขน้ำใหม่" value={entry.currentWater} onChange={value => change({ currentWater: value })} /><p className="min-h-5 text-sm font-semibold text-blue-700" aria-live="polite">{waterPreview?.ok ? `ใช้ไป ${number.format(waterPreview.data.waterUnits)} หน่วย (${money.format(waterPreview.data.waterAmount)})` : 'กรอกเลขใหม่เพื่อดูหน่วยใช้และค่าน้ำ'}</p></> : <p className="text-sm text-blue-700">เหมาจ่าย {money.format(bill.water_rate)} / เดือน ไม่ต้องกรอกมิเตอร์น้ำ</p>}
          </section>
          <details className="rounded-xl border border-slate-100 px-3"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-slate-600">ค่าใช้จ่ายเพิ่มเติมและกำหนดชำระ</summary><div className="space-y-3 pb-3"><label className="block space-y-1"><span className="text-sm font-medium">ค่าใช้จ่ายอื่น (บาท)</span><input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" enterKeyHint="next" required className={`${digits} text-base`} value={entry.otherFees} onChange={e => change({ otherFees: e.target.value })} /></label><label className="block space-y-1"><span className="text-sm font-medium">กำหนดชำระ</span><input type="date" required className="text-base" value={entry.dueDate || defaultDueDate(loaded.cycle)} onChange={e => change({ dueDate: e.target.value })} /></label></div></details>
        </fieldset>
        <section className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3" aria-label="ยอดเงินสุทธิ"><div><p className="text-sm font-semibold text-slate-600">ยอดเงินสุทธิ</p><p className="mt-1 text-sm text-slate-500">รวมค่าเช่า น้ำ ไฟ และอื่นๆ</p></div>{preview?.ok ? <p className={`${digits} text-2xl font-bold text-slate-900`}>{money.format(preview.data.totalAmount)}</p> : <p className="max-w-[55%] text-sm text-slate-600">{preview && !preview.ok ? preview.message : 'กรอกเลขให้ครบ'}</p>}</section>
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] bg-white pt-2 pb-1 lg:bottom-0"><button type="submit" disabled={readonly} className={primary}>{pending ? <><LoaderCircle size={20} className="animate-spin" aria-hidden />กำลังบันทึก…</> : bill.status !== 'DRAFT' ? 'ออกบิลแล้ว' : <><Save size={20} aria-hidden />บันทึกและไปห้องถัดไป<ArrowRight size={20} aria-hidden /></>}</button></div>
      </form>}
      {rooms.length > 1 && <button type="button" disabled={pending || Boolean(data?.expired) || done === rooms.length} className="min-h-12 w-full rounded-xl text-sm font-semibold text-brand hover:bg-blue-50" onClick={saveBatch}>บันทึกชุดห้องที่กรอกไว้</button>}
    </>}
    <SoftWarningModal warnings={warningState?.warnings ?? []} pending={pending} onReview={() => {
      const first = warningState?.warnings[0];
      if (first) setActiveId(data?.bills.find(b => b.id === first.billId)?.room_id ?? activeId);
      setWarningState(null);
    }} onConfirm={() => {
      if (!warningState) return;
      const ids = new Set(warningState.warnings.map(w => w.billId));
      submitReadings(warningState.readings.map(item => ({ ...item, confirmWarning: ids.has(item.billId) || item.confirmWarning })));
    }} />
  </div>;
}
function MeterField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-1"><span className="text-sm font-medium text-slate-600">{label}</span><input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" enterKeyHint="next" required autoComplete="off" className={`${digits} h-14 rounded-2xl border-2 border-slate-200 text-center text-2xl font-bold focus:border-blue-600`} value={value} onChange={event => onChange(event.target.value)} /></label>;
}
