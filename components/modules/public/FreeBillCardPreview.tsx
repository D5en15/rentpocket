'use client';
import { useEffect, useMemo, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import type { FreeBill } from '@/lib/public/bill';
import { billFilename, freeBillText } from '@/lib/public/bill';
import { promptPayPayload } from '@/lib/public/promptpay';
import { qrMatrix, qrSvgDataUri } from '@/lib/public/qr';
import { renderBillPng } from '@/lib/public/bill-image';
const numeric = 'font-mono tabular-nums tracking-tight';
const number = new Intl.NumberFormat('th-TH',{maximumFractionDigits:2});
const money = new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'});
export default function FreeBillCardPreview({ bill }: { bill: FreeBill }) {
  const key = JSON.stringify(bill);
  const qr = useMemo(() => {
    try { return { ok: true as const,uri: qrSvgDataUri(qrMatrix(promptPayPayload(bill.promptpayId,bill.calculation.totalAmount))) }; }
    catch (error) { return { ok: false as const,message: error instanceof Error ? error.message : 'สร้าง QR ไม่สำเร็จ' }; }
  },[bill.promptpayId,bill.calculation.totalAmount]);
  const [image,setImage] = useState<{key:string;blob:Blob} | null>(null);
  const [renderError,setRenderError] = useState<{key:string;text:string} | null>(null);
  const [sharing,setSharing] = useState(false);
  const [feedback,setFeedback] = useState('');
  useEffect(() => {
    if (!qr.ok) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const snapshot = JSON.parse(key) as FreeBill;
      renderBillPng(snapshot).then(blob => { if (!cancelled) { setImage({key,blob}); setRenderError(null); } }).catch(error => { if (!cancelled) setRenderError({key,text:error instanceof Error ? error.message : 'สร้างรูปไม่สำเร็จ'}); });
    },150);
    return () => { cancelled = true; clearTimeout(timer); };
  },[key,qr.ok]);
  const ready = image?.key === key && qr.ok;
  function download() {
    if (!ready || !image) return;
    const url = URL.createObjectURL(image.blob),link = document.createElement('a');
    link.href = url; link.download = billFilename(bill); document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url),10000);
    setFeedback('ดาวน์โหลดรูปบิลแล้ว หากรูปเปิดในแท็บใหม่ ให้แตะค้างเพื่อบันทึกรูป');
  }
  async function share() {
    if (!ready || !image || sharing) return;
    const file = new File([image.blob],billFilename(bill),{type:'image/png'}),text = freeBillText(bill);
    try {
      // PNG is prepared beforehand so share() runs during the user's tap.
      if (navigator.share && navigator.canShare?.({files:[file]})) { setSharing(true); await navigator.share({files:[file],title:`บิลห้อง ${bill.roomName}`,text}); }
      else if (navigator.share) { setSharing(true); await navigator.share({title:`บิลห้อง ${bill.roomName}`,text}); setFeedback('เครื่องนี้แชร์ได้เฉพาะข้อความ กดบันทึกรูปเพื่อแนบการ์ดใน LINE'); }
      else { download(); setFeedback('เครื่องนี้ไม่มีเมนูแชร์ บันทึกรูปบิลแล้วเลือกแนบรูปใน LINE ได้'); }
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setFeedback('แชร์ไม่สำเร็จ กดบันทึกรูปบิลแล้วแนบใน LINE ได้'); }
    finally { setSharing(false); }
  }
  return <section aria-label={`ตัวอย่างบิลห้อง ${bill.roomName}`} className="space-y-3">
    <article className="overflow-hidden rounded-2xl border border-slate-200 border-t-4 border-t-brand bg-white p-5 shadow-sm">
      <header className="space-y-1 border-b border-slate-200 pb-4"><p className="text-sm font-bold text-brand">RentPocket · ใบแจ้งยอด</p><h3 className="text-xl font-bold">ห้อง {bill.roomName}</h3>{bill.propertyName && <p className="break-words text-sm text-slate-600">{bill.propertyName}</p>}<p className="text-sm text-slate-500">รอบ {bill.cycle} · กำหนดชำระ {bill.dueDate}</p></header>
      <dl className="space-y-4 py-5"><Item label="ค่าเช่า" amount={bill.calculation.baseRent} />
        <Item label="ค่าไฟ" amount={bill.calculation.electricAmount} detail={`${number.format(bill.previousElectric)} → ${number.format(bill.currentElectric)}${bill.isRollover ? ' (ชนรอบ)' : ''} · ${number.format(bill.calculation.electricUnits)} หน่วย × ${number.format(bill.electricRate)} บาท`} />
        <Item label={bill.waterType === 'FLAT_RATE' ? 'ค่าน้ำเหมาจ่าย' : 'ค่าน้ำ'} amount={bill.calculation.waterAmount} detail={bill.waterType === 'FLAT_RATE' ? `${money.format(bill.waterRate)} / เดือน` : `${number.format(bill.previousWater)} → ${number.format(bill.currentWater)} · ${number.format(bill.calculation.waterUnits)} หน่วย × ${number.format(bill.waterRate)} บาท`} />
        <Item label="ค่าใช้จ่ายอื่น" amount={bill.calculation.otherFees} />
      </dl>
      <div className="rounded-xl bg-blue-50 p-4 text-brand"><p className="text-sm font-semibold">ยอดเงินรวมสุทธิ</p><p className={`${numeric} mt-1 break-words text-2xl font-bold`}>{money.format(bill.calculation.totalAmount)}</p></div>
      <div className="mt-5 text-center">
        {qr.ok ? <>{/* Inline data image contains only locally generated QR modules. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.uri} alt={`QR PromptPay ${bill.promptpayId} ยอด ${money.format(bill.calculation.totalAmount)}`} width={245} height={245} className="mx-auto h-auto w-[245px] max-w-full" />
          <p className="mt-2 text-sm text-slate-600">สแกนชำระตามยอดบิล</p><p className={`${numeric} mt-1 font-bold`}>{bill.promptpayId}</p>{bill.promptpayName && <p className="mt-1 break-words text-sm text-slate-600">ชื่อบัญชี {bill.promptpayName}</p>}
        </> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{qr.message}</p>}
      </div>
    </article>
    <div className="grid grid-cols-2 gap-3"><button type="button" disabled={!ready || sharing} onClick={download} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-brand bg-white px-2 text-sm font-bold text-brand"><Download size={18} aria-hidden />บันทึกรูปบิลลงเครื่อง</button><button type="button" disabled={!ready || sharing} onClick={share} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-2 text-sm font-bold text-white"><Share2 size={18} aria-hidden />{sharing ? 'กำลังแชร์…' : 'แชร์การ์ดเข้า LINE'}</button></div>
    {qr.ok && !ready && renderError?.key !== key && <p role="status" className="text-sm text-slate-500">กำลังเตรียมรูปบิล…</p>}
    {renderError?.key === key && <p role="alert" className="text-sm text-rose-700">{renderError.text}</p>}
    {feedback && <p role="status" className="text-sm text-brand">{feedback}</p>}
  </section>;
}
function Item({label,amount,detail}:{label:string;amount:number;detail?:string}) {
  return <div><div className="flex justify-between gap-3"><dt className="font-semibold">{label}</dt><dd className={numeric}>{money.format(amount)}</dd></div>{detail && <dd className={`${numeric} mt-1 text-xs text-slate-500`}>{detail}</dd>}</div>;
}
