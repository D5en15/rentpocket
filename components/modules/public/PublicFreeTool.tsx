'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator, ShieldCheck, Zap } from 'lucide-react';
import { defaultDueDate } from '@/lib/billing/calculation';
import { freeBill } from '@/lib/public/bill';
import type { FreeRoomInput } from '@/lib/public/bill';
import FreeBillCardPreview from './FreeBillCardPreview';
const numeric = 'font-mono tabular-nums tracking-tight';
function newRoom(index: number): FreeRoomInput {
  return {roomName:String(index),baseRent:'0',previousElectric:'0',currentElectric:'',electricRate:'8',waterType:'PER_UNIT',previousWater:'0',currentWater:'',waterRate:'18',otherFees:'0',isRollover:false};
}
export default function PublicFreeTool({ currentCycle }: { currentCycle: string }) {
  const [count,setCount] = useState<1|2>(1);
  const [rooms,setRooms] = useState([newRoom(1),newRoom(2)]);
  const [details,setDetails] = useState({propertyName:'',cycle:currentCycle,dueDate:defaultDueDate(currentCycle),promptpayId:'',promptpayName:''});
  function updateRoom(index: number,patch: Partial<FreeRoomInput>) { setRooms(items => items.map((item,i) => i === index ? {...item,...patch} : item)); }
  const results = rooms.slice(0,count).map(room => freeBill(room,details));
  return <>
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-5 pb-80 sm:pb-56">
      <header className="flex items-center justify-between gap-3"><Link href="/" className="inline-flex min-h-12 items-center gap-2 text-xl font-extrabold text-brand"><Calculator size={26} aria-hidden />RentPocket</Link><Link href="/login" className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold">เข้าสู่ระบบ</Link></header>
      <section className="space-y-4"><span className="inline-flex rounded-full bg-blue-100 px-3 py-2 text-sm font-bold text-brand">เครื่องมือฟรี · ไม่ต้องลงทะเบียน</span><h1 className="max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">จดมิเตอร์ คำนวณยอด<br />แชร์บิลให้ผู้เช่าได้ทันที</h1><p className="max-w-2xl text-slate-600">คำนวณค่าเช่าและค่าน้ำไฟ 1–2 ห้อง พร้อม QR PromptPay ตามยอดบิล บันทึกรูปแล้วส่งเข้า LINE ได้จากมือถือ</p><p className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck size={18} aria-hidden />คำนวณและสร้างรูปในเครื่องคุณ ไม่ต้องเชื่อมฐานข้อมูล</p></section>
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
        <fieldset className="space-y-3"><legend className="font-bold">จำนวนห้องที่ต้องการออกบิล</legend><div className="grid grid-cols-2 gap-3">{([1,2] as const).map(value => <label key={value} className={`flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 px-4 font-bold ${count === value ? 'border-brand bg-blue-50 text-brand' : 'border-slate-200'}`}><input className="!min-h-0 !w-5 accent-blue-800" type="radio" name="room_count" value={value} checked={count === value} onChange={() => setCount(value)} />{value} ห้อง</label>)}</div></fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="ชื่อหอพัก (ไม่บังคับ)"><input value={details.propertyName} maxLength={255} onChange={e => setDetails({...details,propertyName:e.target.value})} autoComplete="organization" /></Field><Field label="รอบบิล"><input type="month" value={details.cycle} min="1900-01" max="9998-12" required onChange={e => { const cycle = e.target.value; setDetails({...details,cycle,...(/^\d{4}-(0[1-9]|1[0-2])$/.test(cycle) && Number(cycle.slice(0,4)) >= 1900 && Number(cycle.slice(0,4)) <= 9998 ? {dueDate:defaultDueDate(cycle)} : {})}); }} /></Field><Field label="PromptPay — เบอร์โทร 10 หลัก หรือเลขประจำตัว 13 หลัก"><input type="text" inputMode="numeric" pattern="(0[0-9]{9}|[0-9]{13})" maxLength={13} value={details.promptpayId} onChange={e => setDetails({...details,promptpayId:e.target.value})} className={numeric} required autoComplete="off" /></Field><Field label="ชื่อบัญชีรับเงิน (ไม่บังคับ)"><input value={details.promptpayName} maxLength={255} onChange={e => setDetails({...details,promptpayName:e.target.value})} /></Field><Field label="กำหนดชำระ"><input type="date" value={details.dueDate} required onChange={e => setDetails({...details,dueDate:e.target.value})} /></Field></div>
      </section>
      <div className="space-y-8">{rooms.slice(0,count).map((room,index) => {
        const result = results[index];
        return <section key={index} aria-labelledby={`room-title-${index}`} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5"><h2 id={`room-title-${index}`} className="text-xl font-bold">ตั้งค่าบิลห้องที่ {index+1}</h2>
            <Field label="เลขห้อง / ชื่อห้อง"><input value={room.roomName} required maxLength={50} onChange={e => updateRoom(index,{roomName:e.target.value})} /></Field>
            <NumberField label="ค่าเช่า (บาท/เดือน)" value={room.baseRent} onChange={value => updateRoom(index,{baseRent:value})} />
            <fieldset className="space-y-4"><legend className="font-bold">ค่าไฟ</legend><div className="grid grid-cols-2 gap-3"><NumberField label="เลขไฟเก่า" value={room.previousElectric} onChange={value => updateRoom(index,{previousElectric:value})} /><NumberField label="เลขไฟใหม่" value={room.currentElectric} onChange={value => updateRoom(index,{currentElectric:value})} /></div><NumberField label="เรทค่าไฟ (บาท/หน่วย)" value={room.electricRate} onChange={value => updateRoom(index,{electricRate:value})} /><button type="button" aria-pressed={room.isRollover} onClick={() => updateRoom(index,{isRollover:!room.isRollover})} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-3 font-semibold ${room.isRollover ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-300'}`}><Zap size={18} aria-hidden />มิเตอร์ชนรอบ 10000</button></fieldset>
            <fieldset className="space-y-4"><legend className="font-bold">ค่าน้ำ</legend><Field label="วิธีคิดค่าน้ำ"><select value={room.waterType} onChange={e => updateRoom(index,{waterType:e.target.value as FreeRoomInput['waterType']})}><option value="PER_UNIT">คิดตามหน่วยจริง</option><option value="FLAT_RATE">เหมาจ่ายต่อเดือน</option></select></Field>{room.waterType === 'PER_UNIT' && <div className="grid grid-cols-2 gap-3"><NumberField label="เลขน้ำเก่า" value={room.previousWater} onChange={value => updateRoom(index,{previousWater:value})} /><NumberField label="เลขน้ำใหม่" value={room.currentWater} onChange={value => updateRoom(index,{currentWater:value})} /></div>}<NumberField label={room.waterType === 'FLAT_RATE' ? 'ค่าน้ำเหมาจ่าย (บาท/เดือน)' : 'เรทค่าน้ำ (บาท/หน่วย)'} value={room.waterRate} onChange={value => updateRoom(index,{waterRate:value})} /></fieldset>
            <NumberField label="ค่าใช้จ่ายอื่น (บาท)" value={room.otherFees} onChange={value => updateRoom(index,{otherFees:value})} />
          </div>
          <div className="space-y-3"><h2 className="text-lg font-bold">ตัวอย่างบิล · อัปเดตตามตัวเลขที่กรอก</h2>{result.ok ? <><FreeBillCardPreview bill={result.bill} />{result.bill.calculation.softWarning && <p role="alert" className="rounded-xl border border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">หน่วยไฟเกิน 500 หน่วย กรุณาตรวจเลขเก่าและเลขใหม่ก่อนแชร์บิล</p>}</> : <p role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">{result.message}</p>}</div>
        </section>;
      })}</div>
    </main>
    <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-blue-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgb(15_23_42_/_0.08)]" aria-label="ทดลองใช้ RentPocket"><div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">🚀 เบื่อคำนวณทีละห้อง? ไม่อยากตรวจสลิปปลอมวันสิ้นเดือน?</p><p className="mt-1 text-sm text-slate-600">จัดการ 5–50 ห้องครบวงจร · ทดลองใช้ฟรี 14 วัน สูงสุด 50 ห้อง</p></div><Link href="/signup" className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 font-bold text-white">ทดลองใช้ RentPocket ฟรี 14 วัน<ArrowRight size={18} aria-hidden /></Link></div></aside>
  </>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block space-y-2"><span className="text-sm font-semibold">{label}</span>{children}</label>; }
function NumberField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) {
  return <Field label={label}><input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" enterKeyHint="next" autoComplete="off" required className={`${numeric} min-h-14 text-xl font-bold`} value={value} onChange={event => onChange(event.target.value)} /></Field>;
}
