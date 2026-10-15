import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Calculator, Check, CheckCircle2, ChevronDown, ClipboardList, Clock3, FileCheck2, LayoutDashboard, MessageCircle, Smartphone, Sparkles, Wallet, X, Zap } from 'lucide-react';
import { qrMatrix } from '@/lib/public/qr';

export const metadata: Metadata = {
  title: 'RentPocket — เปลี่ยนงานหอพักวันสิ้นเดือนให้จบใน 15 นาที',
  description: 'ระบบจัดการหอพัก 5–50 ห้อง จดมิเตอร์ คำนวณค่าน้ำไฟ ออกบิลส่ง LINE และตรวจสลิป เริ่มทดลองใช้ฟรี 14 วัน ไม่ต้องผูกบัตร',
};
const primary = 'inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-center font-bold text-white shadow-lg shadow-blue-900/10 transition-colors hover:bg-blue-900';
const features = [
  { icon: Smartphone, number: '01', title: 'เดินจดมิเตอร์มือเดียวหน้าห้อง', description: 'เทียบเลขเดือนก่อนอัตโนมัติ กรอกเลขด้วย Numpad ใหญ่ มีระบบเตือนเมื่อเลขกระโดด ลดการย้อนกลับไปเช็กสมุด', detail: 'เลขเก่าอยู่ตรงหน้า เลขใหม่อยู่ปลายนิ้ว' },
  { icon: MessageCircle, number: '02', title: '1-Click ออกบิลส่ง LINE', description: 'สร้างการ์ดบิลอ่านง่าย พร้อม Dynamic PromptPay QR โค้ดตรงยอดเป๊ะ บันทึกรูปหรือเปิดเมนูแชร์เพื่อส่งเข้า LINE', detail: 'ผู้เช่าเห็นยอดครบ สแกนจ่ายได้สะดวก' },
  { icon: FileCheck2, number: '03', title: 'ตรวจสลิปอัตโนมัติผ่าน EasySlip', description: 'ตรวจยอดเงินและบัญชีปลายทางทันที ดักจับสลิปซ้ำระดับฐานข้อมูล พร้อมปุ่มยืนยันยอดด้วยตนเองสำหรับเงินสดหรือกรณี API ล่ม', detail: 'ตรวจข้อมูลก่อนเปลี่ยนสถานะเป็นชำระแล้ว' },
  { icon: LayoutDashboard, number: '04', title: 'แดชบอร์ดไฟจราจร 3 สี & ปุ่มทวงเงินสุภาพ', description: 'เห็นภาพรวมเงินเข้าใน 3 วินาที แยกชำระแล้ว รอชำระ และค้างชำระ พร้อมปุ่มคัดลอกข้อความทวงเงิน 1-Click', detail: 'รู้ว่าห้องไหนจ่ายแล้ว ห้องไหนต้องตามต่อ' },
];
const plans = [
  { name: 'Free Trial', price: '0', period: '/ 14 วัน', rooms: 50, description: 'ลองจัดการวันสิ้นเดือนให้ครบลูป', popular: false, cta: 'ทดลองใช้ฟรี 14 วัน' },
  { name: 'Micro Pack', price: '199', period: '/ เดือน', rooms: 10, description: 'สำหรับหอพักขนาดเล็ก ดูแลง่าย', popular: false, cta: 'ทดลองใช้ Micro ฟรี 14 วัน' },
  { name: 'Standard Pack', price: '349', period: '/ เดือน', rooms: 25, description: 'พอดีกับหอพักที่กำลังเติบโต', popular: true, cta: 'ทดลองใช้ Standard ฟรี 14 วัน' },
  { name: 'Pro Pack', price: '599', period: '/ เดือน', rooms: 50, description: 'จัดการหลายห้องได้ในที่เดียว', popular: false, cta: 'ทดลองใช้ Pro ฟรี 14 วัน' },
];

export default function LandingPage() {
  return <div className="bg-slate-50 text-slate-900">
    <a href="#main" className="sr-only z-50 rounded-xl bg-white p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">ข้ามไปเนื้อหา</a>
    <header className="border-b border-slate-200 bg-white/95">
      <nav aria-label="เมนูหลัก" className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-1 px-3 sm:gap-2 sm:px-6 lg:gap-4">
        <div className="flex min-w-0 items-center gap-2 lg:gap-3">
          <Link href="/" className="flex min-h-12 shrink-0 items-center gap-1.5 sm:gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white lg:h-10 lg:w-10"><Wallet size={20} aria-hidden /></span><span className="text-sm font-extrabold tracking-tight sm:text-lg lg:text-xl">RentPocket</span></Link>
          <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-2 text-[10px] font-semibold text-slate-500 sm:inline-flex lg:px-3 lg:text-xs">ระบบจัดการหอพักอัตโนมัติ</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2"><Link href="/login" className="inline-flex min-h-12 items-center whitespace-nowrap rounded-xl px-2 text-xs font-semibold hover:bg-slate-100 lg:px-3 lg:text-sm">เข้าสู่ระบบ</Link><Link href="/signup" className="inline-flex min-h-12 items-center whitespace-nowrap rounded-xl bg-brand px-2 text-xs font-bold text-white hover:bg-blue-900 lg:px-3 lg:text-sm">ทดลองใช้ฟรี 14 วัน</Link></div>
      </nav>
    </header>
    <main id="main">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div aria-hidden className="pointer-events-none absolute -right-32 top-12 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-brand"><Sparkles size={16} aria-hidden />ผู้ช่วยวันสิ้นเดือน สำหรับเจ้าของหอพัก</p>
            <h1 className="text-[2rem] font-extrabold leading-[1.3] tracking-tight sm:text-5xl sm:leading-[1.25]">เปลี่ยนงานจดมิเตอร์วันสิ้นเดือน 2–3 ชั่วโมง <span className="text-brand">ให้จบใน 15 นาที</span>ผ่านมือถือเครื่องเดียว</h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">ระบบจัดการหอพัก 5–50 ห้อง คำนวณค่าน้ำ-ไฟอัตโนมัติ ออกบิลส่ง LINE ในคลิกเดียว พร้อมระบบตรวจสลิปปลอมอัตโนมัติ 100%</p>
            <div className="space-y-3"><Link href="/signup" className={`${primary} w-full sm:w-auto`}>🚀 เริ่มทดลองใช้ฟรี 14 วัน (ไม่ต้องผูกบัตร)</Link><Link href="/calculator" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-semibold text-slate-700 hover:border-blue-300 hover:text-brand sm:w-auto">⚡ หรือทดลองคำนวณบิล 1 ห้องแบบเร็ว<ArrowRight className="shrink-0" size={18} aria-hidden /></Link></div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span className="flex items-center gap-1.5"><Check size={16} className="text-emerald-600" aria-hidden />ไม่ต้องผูกบัตร</span><span className="flex items-center gap-1.5"><Check size={16} className="text-emerald-600" aria-hidden />ทดลองได้สูงสุด 50 ห้อง</span><span className="flex items-center gap-1.5"><Clock3 size={16} aria-hidden />ใช้งานผ่านมือถือ</span></div>
          </div>
          <HeroPreview />
        </div>
      </section>
      <section aria-labelledby="pain-title" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-8 max-w-2xl"><p className="text-sm font-bold text-brand">วันสิ้นเดือนไม่ควรเป็นวันที่เหนื่อยที่สุด</p><h2 id="pain-title" className="mt-3 text-2xl font-extrabold leading-snug sm:text-3xl">งานเดิมที่กินเวลา<br className="sm:hidden" /> และทำให้คุณต้องเช็กซ้ำ</h2></div>
        <div className="grid gap-4 md:grid-cols-3">{[
          { icon: Calculator, title: 'สมุดหนึ่งเล่ม เครื่องคิดเลขอีกหนึ่งเครื่อง', text: 'ปวดตากับการจดสมุดและกดเครื่องคิดเลขทีละห้อง เสี่ยงคิดเลขผิด ต้องไล่ตรวจและคำนวณใหม่' },
          { icon: FileCheck2, title: 'สลิปเต็มแชต แต่ยังไม่มั่นใจว่าเงินจริงเข้า', text: 'เสียเวลานั่งเพ่งสลิปโอนเงินวันสิ้นเดือน กลัวสลิปปลอมและสลิปเดิมที่ถูกวนใช้ซ้ำ' },
          { icon: MessageCircle, title: 'รู้ว่าค้างจ่าย แต่ไม่รู้จะเริ่มทวงอย่างไร', text: 'ลำบากใจเวลาต้องพิมพ์ข้อความทวงเงินผู้เช่าที่ค้างชำระ ต้องเลือกคำพูดใหม่ทุกครั้ง' },
        ].map(item => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><span className="rounded-xl bg-slate-100 p-3 text-slate-600"><item.icon size={24} aria-hidden /></span><span className="rounded-full bg-rose-50 p-1.5 text-rose-600"><X size={16} aria-hidden /></span></div><h3 className="text-lg font-bold leading-snug">{item.title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-600">{item.text}</p></article>)}</div>
      </section>
      <section id="features" aria-labelledby="features-title" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20"><div className="mb-9 max-w-2xl"><p className="text-sm font-bold text-brand">ครบลูปในมือถือเครื่องเดียว</p><h2 id="features-title" className="mt-3 text-2xl font-extrabold sm:text-3xl">ตั้งแต่เลขมิเตอร์หน้าห้อง<br />จนถึงเงินที่เข้าบัญชี</h2><p className="mt-4 leading-relaxed text-slate-600">ให้ระบบช่วยคำนวณ ตรวจข้อมูล และเตรียมข้อความ คุณจึงมีเวลาจัดการหอพักมากขึ้น</p></div>
          <div className="grid gap-5 md:grid-cols-2">{features.map(feature => <article key={feature.number} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 sm:p-7"><div className="mb-5 flex items-center justify-between"><span className="rounded-xl bg-blue-100 p-3 text-brand"><feature.icon size={26} aria-hidden /></span><span className="font-mono text-sm font-bold tabular-nums text-slate-400">{feature.number}</span></div><h3 className="text-xl font-bold leading-snug">{feature.title}</h3><p className="mt-3 leading-relaxed text-slate-600">{feature.description}</p><p className="mt-5 flex items-start gap-2 border-t border-slate-200 pt-4 text-sm font-semibold text-brand"><CheckCircle2 size={18} className="shrink-0" aria-hidden />{feature.detail}</p></article>)}</div>
        </div>
      </section>
      <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-10 text-center"><p className="text-sm font-bold text-brand">ราคาโปร่งใส เลือกตามจำนวนห้อง</p><h2 id="pricing-title" className="mt-3 text-2xl font-extrabold sm:text-3xl">เริ่มเล็กได้ ขยายเมื่อพร้อม</h2><p className="mx-auto mt-4 max-w-xl text-slate-600">ทดลองใช้งาน 14 วันก่อนเลือกแพ็กเกจที่พอดีกับหอพักของคุณ</p></div>
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 pt-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">{plans.map(plan => <article key={plan.name} className={`relative flex w-[82vw] shrink-0 snap-center flex-col rounded-2xl border bg-white p-6 shadow-sm sm:w-auto ${plan.popular ? 'border-2 border-brand shadow-xl shadow-blue-900/10' : 'border-slate-200'}`}>
          {plan.popular && <span className="absolute -top-3 left-5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">ยอดนิยม</span>}
          <h3 className="mt-1 text-lg font-bold">{plan.name}</h3><p className="mt-2 min-h-10 text-sm text-slate-500">{plan.description}</p><div className="mt-6"><span className="font-mono text-4xl font-bold tabular-nums tracking-tight">{plan.price}</span><span className="ml-1 text-sm text-slate-500">บาท {plan.period}</span></div><p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold">สูงสุด <span className="font-mono tabular-nums">{plan.rooms}</span> ห้อง</p>
          <ul className="my-6 space-y-3 text-sm text-slate-600">{['จดมิเตอร์และคำนวณน้ำไฟ','ออกบิลและแชร์ให้ผู้เช่า','ตรวจสลิปและดูสถานะรับเงิน'].map(text => <li className="flex items-start gap-2" key={text}><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />{text}</li>)}</ul><Link href="/signup" className={`mt-auto inline-flex min-h-14 items-center justify-center rounded-xl px-3 text-center font-bold ${plan.popular ? 'bg-brand text-white hover:bg-blue-900' : 'border border-slate-300 hover:border-brand hover:text-brand'}`}>{plan.cta}</Link>
        </article>)}</div>
      </section>
      <section aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 pb-14 sm:px-6 sm:pb-20">
        <h2 id="faq-title" className="mb-7 text-center text-2xl font-extrabold leading-snug sm:text-3xl">คำถามที่พบบ่อยสำหรับเจ้าของหอพัก</h2>
        <div className="space-y-3">{[
          { question: 'ต้องดาวน์โหลดหรือติดตั้งแอปลงมือถือไหม?', answer: 'ไม่ต้องดาวน์โหลด ใช้งานผ่านเบราว์เซอร์ (Safari / Chrome) บนมือถือได้ทันที' },
          { question: 'ถ้าผู้เช่าจ่ายเงินสด หรือโอนเงินนอกระบบ จะทำอย่างไร?', answer: 'มีปุ่มกดยืนยันยอดด้วยตนเอง (Manual Approve) ให้ใช้งานได้เสมอ' },
          { question: 'ครบ 14 วันแล้วจะมีการตัดเงินอัตโนมัติไหม?', answer: 'ไม่มีการตัดเงิน ไม่ต้องผูกบัตรเครดิต หากยังไม่พร้อมต่ออายุ ข้อมูลเดิมยังคงปลอดภัยและสามารถดูย้อนหลังได้ตลอด' },
          { question: 'มีหอพักมากกว่า 1 แห่ง สามารถจัดการพร้อมกันได้ไหม?', answer: 'จัดการได้ สามารถรวมทุกอาคารไว้ในบัญชีเดียวและแยกดูรายงานได้' },
        ].map(item => <details key={item.question} className="group rounded-2xl border border-slate-200 bg-white shadow-sm"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-4 text-sm font-bold [&::-webkit-details-marker]:hidden sm:px-5 sm:text-base"><span>{item.question}</span><ChevronDown size={20} className="shrink-0 text-brand transition-transform group-open:rotate-180" aria-hidden /></summary><p className="border-t border-slate-100 px-4 py-4 text-sm leading-relaxed text-slate-600 sm:px-5">{item.answer}</p></details>)}</div>
        <p className="mt-6 text-center text-sm text-slate-600">มีข้อสงสัยเพิ่มเติม? {process.env.NEXT_PUBLIC_LINE_SUPPORT_URL ? <a href={process.env.NEXT_PUBLIC_LINE_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl px-3 font-bold text-brand underline underline-offset-4 hover:bg-blue-50">ทัก LINE สอบถามทีมงาน</a> : <span className="inline-flex min-h-12 items-center px-3">ช่องทาง LINE ทีมงานกำลังเตรียมเปิดให้บริการ</span>}</p>
      </section>
      <section aria-labelledby="final-title" className="px-4 pb-14 sm:px-6 sm:pb-20"><div className="mx-auto max-w-6xl rounded-3xl bg-slate-900 px-5 py-12 text-center text-white sm:px-10 sm:py-16"><p className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200"><Zap size={18} aria-hidden />คืนเวลาให้เจ้าของหอพัก</p><h2 id="final-title" className="mx-auto mt-4 max-w-2xl text-2xl font-extrabold leading-snug sm:text-4xl">พร้อมเปลี่ยนวันสิ้นเดือน<br />ให้สบายขึ้นแล้วหรือยัง?</h2><p className="mt-4 text-slate-300">เริ่มจากห้องแรก แล้วให้ RentPocket ช่วยดูแลทั้งหอพัก</p><Link href="/signup" className={`${primary} mt-7 w-full bg-blue-700 hover:bg-blue-600 sm:w-auto`}>เริ่มทดลองใช้ฟรี 14 วัน<ArrowRight size={18} aria-hidden /></Link><p className="mt-4 text-sm text-slate-400">ไม่ต้องผูกบัตร · ทดลองได้สูงสุด 50 ห้อง</p></div></section>
    </main>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-7 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left"><div><p className="font-extrabold text-brand">RentPocket</p><p className="mt-1 text-sm text-slate-500">งานหอพักที่ง่ายขึ้น ในมือถือเครื่องเดียว</p></div><nav aria-label="ลิงก์ท้ายหน้า" className="flex flex-wrap justify-center gap-2 text-sm text-slate-600"><Link href="/calculator" className="inline-flex min-h-12 items-center rounded-xl px-3 hover:bg-slate-50">คำนวณบิลฟรี</Link><Link href="/login" className="inline-flex min-h-12 items-center rounded-xl px-3 hover:bg-slate-50">เข้าสู่ระบบ</Link><Link href="/signup" className="inline-flex min-h-12 items-center rounded-xl px-3 hover:bg-slate-50">ทดลองใช้ฟรี</Link></nav></div></footer>
  </div>;
}

function HeroPreview() {
  // A non-payment payload keeps the explicitly illustrative QR non-payable.
  const matrix = qrMatrix('RentPocket - illustrative bill preview');
  const path = matrix.flatMap((row,y) => row.flatMap((dark,x) => dark ? [`M${x+4} ${y+4}h1v1h-1z`] : [])).join('');
  return <div className="relative mx-auto w-full max-w-sm space-y-3 sm:max-w-md sm:space-y-4 rounded-3xl border border-blue-100 bg-blue-50/70 p-2.5 sm:p-5" aria-label="ภาพจำลองแดชบอร์ดและบิล RentPocket">
    <p className="flex items-center justify-between px-2 text-xs font-semibold text-slate-500"><span>ภาพตัวอย่างการใช้งาน</span><span className="inline-flex items-center gap-1"><Smartphone size={14} aria-hidden />ดูแลหอพักผ่านมือถือ</span></p>
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/5 sm:p-5"><div className="mb-3 flex items-center justify-between sm:mb-4"><div><p className="text-xs font-semibold text-slate-500">รายรับประจำเดือน · ตัวอย่าง</p><p className="mt-1 font-bold">ภาพรวมที่ดูแล้วเข้าใจทันที</p></div><span className="rounded-xl bg-blue-50 p-2 text-brand"><LayoutDashboard size={20} aria-hidden /></span></div><div className="grid grid-cols-3 gap-2">{[{label:'ชำระแล้ว',count:18,color:'bg-emerald-50 text-emerald-700',dot:'bg-emerald-600'},{label:'รอชำระ',count:5,color:'bg-amber-50 text-amber-700',dot:'bg-amber-600'},{label:'ค้างชำระ',count:2,color:'bg-rose-50 text-rose-700',dot:'bg-rose-600'}].map(item => <div key={item.label} className={`rounded-xl p-2 sm:p-3 ${item.color}`}><span className={`mb-2 block h-2 w-2 rounded-full ${item.dot}`} /><p className="font-mono text-2xl font-bold tabular-nums tracking-tight">{item.count}</p><p className="mt-1 text-xs font-semibold">{item.label}</p></div>)}</div><div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-500">เก็บได้แล้ว</span><span className="font-mono font-bold tabular-nums tracking-tight">฿72,000.00</span></div></div>
    <div className="ml-auto w-full rounded-2xl border border-slate-200 border-t-4 border-t-brand bg-white p-3 shadow-xl shadow-blue-900/10 sm:w-[92%] sm:p-5"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-brand">RentPocket · ใบแจ้งยอดตัวอย่าง</p><p className="mt-2 text-lg font-bold">ห้อง 101</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">รอชำระ</span></div><dl className="my-3 space-y-1.5 text-sm sm:my-4 sm:space-y-2">{[['ค่าเช่า','฿3,000.00'],['ค่าไฟ · 100 หน่วย','฿800.00'],['ค่าน้ำ · 5 หน่วย','฿90.00']].map(([label,value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-mono tabular-nums tracking-tight">{value}</dd></div>)}</dl><div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><div><p className="text-xs text-slate-500">ยอดรวมสุทธิ</p><p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight text-brand">฿3,890.00</p><p className="mt-2 text-xs text-slate-400">QR จำลองสำหรับภาพตัวอย่าง</p></div><svg role="img" aria-label="QR จำลอง ไม่ใช่ QR รับชำระเงิน" width="98" height="98" viewBox="0 0 49 49" className="h-20 w-20 shrink-0 rounded-lg sm:h-[98px] sm:w-[98px]" shapeRendering="crispEdges"><rect width="49" height="49" fill="white" /><path d={path} fill="#0f172a" /></svg></div><p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><ClipboardList size={16} aria-hidden />บิลอ่านง่าย พร้อมส่งต่อให้ผู้เช่า</p></div>
  </div>;
}
