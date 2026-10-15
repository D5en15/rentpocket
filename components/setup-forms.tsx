'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Wallet, X } from 'lucide-react';
import { savePropertyAction } from '@/server/actions/property.actions';
import { batchCreateRoomsAction, createRoomAction } from '@/server/actions/room.actions';
import type { ActionResult, SetupData } from '@/server/actions/types';

const card = 'space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7';
const button = 'flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-bold text-white';
const numeric = 'font-mono tabular-nums tracking-tight';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-semibold">{label}</span>{children}</label>;
}
export default function SetupForms({ initial }: { initial: SetupData }) {
  const router = useRouter();
  const [selected, setSelected] = useState(initial.properties[0]?.id ?? '');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [upgrade, setUpgrade] = useState(initial.usedRooms >= initial.maxRooms);
  const dialog = useRef<HTMLDialogElement>(null);
  const property = initial.properties.find(item => item.id === selected);
  const full = initial.usedRooms >= initial.maxRooms;
  useEffect(() => {
    if (upgrade && !dialog.current?.open) dialog.current?.showModal();
    if (!upgrade && dialog.current?.open) dialog.current?.close();
  }, [upgrade]);
  useEffect(() => { if (full) dialog.current?.showModal(); }, [full]);

  function report(result: ActionResult<unknown>, success: string) {
    setFeedback({ ok: result.ok, message: result.ok ? success : result.message });
    if (!result.ok && result.code === 'QUOTA_EXCEEDED') setUpgrade(true);
    if (result.ok || (!result.ok && ['QUOTA_EXCEEDED', 'SUBSCRIPTION_EXPIRED'].includes(result.code))) router.refresh();
  }
  function save(form: FormData) {
    startTransition(async () => {
      try {
        const result = await savePropertyAction(form);
        if (result.ok) setSelected(result.data.id);
        report(result, 'บันทึกข้อมูลหอพักเรียบร้อย');
      } catch { setFeedback({ ok: false, message: 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่' }); }
    });
  }
  function add(form: FormData, batch: boolean) {
    startTransition(async () => {
      try {
        const result = await (batch ? batchCreateRoomsAction(form) : createRoomAction(form));
        report(result, result.ok ? `เพิ่ม ${result.data.created} ห้องเรียบร้อย` : '');
      } catch { setFeedback({ ok: false, message: 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่' }); }
    });
  }
  return <div className="grid items-start gap-6 lg:grid-cols-2">
    <section className={`${card} relative overflow-hidden lg:col-span-2`} aria-labelledby="quota-title">
      <div className="flex items-center justify-between"><h2 id="quota-title" className="font-bold">โควตาห้องรวมทุกหอพัก</h2><span className={`${numeric} rounded-full bg-blue-50 px-3 py-2 text-sm font-bold text-brand`}>{initial.usedRooms}/{initial.maxRooms} ห้อง</span></div>
      <div role="progressbar" aria-label="โควตาห้อง" aria-valuemin={0} aria-valuemax={initial.maxRooms} aria-valuenow={initial.usedRooms} className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${full ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-700 to-blue-400'}`} style={{ width: `${Math.min(100, initial.usedRooms / initial.maxRooms * 100)}%` }} /></div>
      <p className="text-sm text-slate-600">เหลือ {Math.max(0, initial.maxRooms - initial.usedRooms)} ห้อง · {initial.status}</p>
      {initial.expired && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-800">แพ็กเกจหมดอายุ ไม่สามารถเพิ่มห้องใหม่ได้</p>}
      <button type="button" className="min-h-12 rounded-xl border border-brand px-4 font-semibold text-brand" onClick={() => setUpgrade(true)}>ดูแพ็กเกจและโควตา</button>
    </section>
    {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={`rounded-xl border p-4 lg:col-span-2 ${feedback.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>{feedback.message}</p>}
    <section className={`${card} lg:row-span-2`}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><Building2 aria-hidden size={22} />หอพักและบัญชีรับเงิน</h2>
      <Field label="เลือกหอพักเพื่อแก้ไข หรือสร้างใหม่"><select value={selected} disabled={pending} onChange={event => setSelected(event.target.value)}><option value="">สร้างหอพักใหม่</option>{initial.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <form key={property ? JSON.stringify(property) : 'new'} action={save} className="space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          <input type="hidden" name="property_id" value={property?.id ?? ''} />
          <Field label="ชื่อหอพัก"><input name="name" required maxLength={255} defaultValue={property?.name ?? ''} autoComplete="organization" /></Field>
          <Field label="ที่อยู่ (ไม่บังคับ)"><textarea name="address" maxLength={2000} defaultValue={property?.address ?? ''} /></Field>
          <Field label="ชื่อบัญชีรับเงิน"><input name="promptpay_name" required maxLength={255} defaultValue={property?.promptpay_name ?? ''} /></Field>
          <Field label="PromptPay — เบอร์โทร 10 หลัก หรือเลขประจำตัว 13 หลัก"><input name="promptpay_id" type="text" inputMode="numeric" pattern="([0-9]{10}|[0-9]{13})" maxLength={13} required className={numeric} defaultValue={property?.promptpay_id ?? ''} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ค่าไฟ (บาท/หน่วย)"><input name="default_electric_rate" type="text" inputMode="decimal" pattern="[0-9]{1,8}(\.[0-9]{1,2})?" required className={numeric} defaultValue={property?.default_electric_rate ?? 8} /></Field>
            <Field label="รูปแบบค่าน้ำ"><select name="default_water_type" defaultValue={property?.default_water_type ?? 'PER_UNIT'}><option value="PER_UNIT">คิดตามหน่วย</option><option value="FLAT_RATE">เหมาจ่ายต่อเดือน</option></select></Field>
          </div>
          <Field label="ค่าน้ำ (บาท/หน่วย หรือบาท/เดือนเมื่อเหมาจ่าย)"><input name="default_water_rate" type="text" inputMode="decimal" pattern="[0-9]{1,8}(\.[0-9]{1,2})?" required className={numeric} defaultValue={property?.default_water_rate ?? 18} /></Field>
          <p className="text-sm text-slate-600">เรทเริ่มต้นใช้กับห้องที่เพิ่มใหม่ ห้องเดิมคงเรทที่บันทึกไว้</p>
          <button className={button} type="submit"><Wallet aria-hidden size={20} />{pending ? 'กำลังบันทึก…' : 'บันทึกหอพักและ PromptPay'}</button>
        </fieldset>
      </form>
    </section>
    <section className={card}>
      <h2 className="text-lg font-bold">เพิ่มห้องพักแบบชุด</h2>
      <p className="text-sm text-slate-600">เพิ่มเลขห้องต่อเนื่อง เช่น 101 ถึง 108 รวม 8 ห้อง</p>
      <RoomForm propertyId={selected} disabled={pending || !property || full || initial.expired} batch onSubmit={form => add(form, true)} />
      {!property && <p className="text-amber-700">บันทึกและเลือกหอพักก่อนเพิ่มห้อง</p>}
    </section>
    <section className={card}>
      <h2 className="text-lg font-bold">เพิ่มห้องเดี่ยว</h2>
      <RoomForm propertyId={selected} disabled={pending || !property || full || initial.expired} batch={false} onSubmit={form => add(form, false)} />
    </section>
    <dialog ref={dialog} onClose={() => setUpgrade(false)} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl bg-white p-6 shadow-xl backdrop:bg-slate-950/60" aria-labelledby="upgrade-title">
      <div className="flex items-center justify-between gap-3"><h2 id="upgrade-title" className="text-xl font-bold">{full ? 'ใช้โควตาห้องครบแล้ว' : 'แพ็กเกจ RentPocket'}</h2><button type="button" aria-label="ปิดหน้าต่างแพ็กเกจ" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" onClick={() => setUpgrade(false)}><X aria-hidden /></button></div>
      <p className="my-4 text-slate-600">ใช้ {initial.usedRooms} จาก {initial.maxRooms} ห้อง เพิ่มห้องได้หลังแพ็กเกจได้รับการปรับโควตา</p>
      <ul className="space-y-3 rounded-xl bg-slate-50 p-4">
        <li>Micro · 199 บาท/เดือน · 10 ห้อง</li><li>Standard · 349 บาท/เดือน · 25 ห้อง</li><li>Pro · 599 บาท/เดือน · 50 ห้อง</li><li>Custom · สูงสุด 100 ห้อง · ราคาโดยตกลง</li>
      </ul>
      <p className="my-4 text-sm text-slate-600">ระบบชำระเงินเพื่ออัปเกรดยังไม่เปิดให้บริการ หน้านี้แสดงรายละเอียดแพ็กเกจเท่านั้น</p>
      <button type="button" className={button} onClick={() => setUpgrade(false)}>รับทราบ</button>
    </dialog>
  </div>;
}
function RoomForm({ propertyId, disabled, batch, onSubmit }: { propertyId: string; disabled: boolean; batch: boolean; onSubmit: (form: FormData) => void }) {
  return <form action={onSubmit} className="space-y-4"><fieldset disabled={disabled} className="space-y-4">
    <input type="hidden" name="property_id" value={propertyId} />
    {batch ? <div className="grid grid-cols-2 gap-3"><Field label="เลขเริ่มต้น"><input name="start_room" type="text" inputMode="numeric" pattern="[0-9]{1,8}" required className={numeric} defaultValue="101" /></Field><Field label="เลขสิ้นสุด"><input name="end_room" type="text" inputMode="numeric" pattern="[0-9]{1,8}" required className={numeric} defaultValue="108" /></Field></div> : <Field label="เลขห้อง"><input name="room_number" required maxLength={50} /></Field>}
    <div className="grid grid-cols-2 gap-3"><Field label="ชั้น"><input name="floor" type="text" inputMode="numeric" pattern="[0-9]{1,3}" required className={numeric} defaultValue="1" /></Field><Field label="ค่าเช่า (บาท/เดือน)"><input name="base_rent" type="text" inputMode="decimal" pattern="[0-9]{1,8}(\.[0-9]{1,2})?" required className={numeric} defaultValue="0" /></Field></div>
    <button type="submit" className={button}><Plus aria-hidden size={20} />{batch ? 'เพิ่มห้องแบบชุด' : 'เพิ่มห้องเดี่ยว'}</button>
  </fieldset></form>;
}
