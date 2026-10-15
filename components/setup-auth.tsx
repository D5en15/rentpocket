'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
export default function SetupAuth({ initialMode = 'login', redirectTo }: { initialMode?: 'login' | 'signup'; redirectTo?: '/setup' | '/dashboard' } = {}) {
  const devBypass = process.env.NODE_ENV === 'development' && initialMode === 'login';
  const [signup, setSignup] = useState(initialMode === 'signup');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function submit(form: FormData) {
    if (devBypass && !signup) { router.push('/dashboard'); return; }
    startTransition(async () => {
      try {
        const client = createClient();
        const credentials = { email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') };
        const result = signup
          ? await client.auth.signUp({ ...credentials, options: { data: { full_name: String(form.get('full_name') ?? '').trim() } } })
          : await client.auth.signInWithPassword(credentials);
        if (result.error) { setMessage(signup ? 'สมัครไม่สำเร็จ กรุณาตรวจอีเมลและรหัสผ่าน หรือลองเข้าสู่ระบบ' : 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจอีเมล รหัสผ่าน และการยืนยันอีเมล'); return; }
        if (signup && !result.data.session) { setMessage('สมัครแล้ว กรุณายืนยันอีเมลจากข้อความที่ส่งถึงคุณ แล้วกลับมาเข้าสู่ระบบ'); setSignup(false); return; }
        setMessage('เข้าสู่ระบบเรียบร้อย');
        if (redirectTo) router.replace(redirectTo);
        router.refresh();
      } catch { setMessage('เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจการตั้งค่า Supabase'); }
    });
  }
  return <section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
    <Link href="/" aria-label="RentPocket กลับหน้าแรก" className="mx-auto mb-6 flex min-h-13 w-fit items-center gap-3 rounded-xl text-brand"><span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-brand text-white"><Wallet size={28} aria-hidden /></span><span className="text-2xl font-extrabold tracking-tight">RentPocket</span></Link>
    <h2 className="text-center text-2xl font-extrabold">{signup ? 'สมัครทดลองใช้ 14 วัน' : 'เข้าสู่ระบบ'}</h2>
    <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">{signup ? 'จัดการหอพักสูงสุด 50 ห้อง จดมิเตอร์ ออกบิล และตรวจสลิปในที่เดียว' : 'ยินดีต้อนรับกลับมา ดูแลหอพักของคุณได้อย่างสะดวก'}</p>
    <form noValidate={devBypass && !signup} action={submit} className="mt-4 space-y-4"><fieldset disabled={pending} className="space-y-4">
      {signup && <label className="block text-sm font-semibold text-slate-700">ชื่อผู้ใช้<input className="mt-2 h-12 rounded-xl border-slate-200 focus:border-blue-600" name="full_name" autoComplete="name" maxLength={255} required /></label>}
      <label className="block text-sm font-semibold text-slate-700">อีเมล<input className="mt-2 h-12 rounded-xl border-slate-200 focus:border-blue-600" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" required /></label>
      <div><label htmlFor="auth-password" className="block text-sm font-semibold text-slate-700">รหัสผ่าน</label><div className="relative mt-2"><input id="auth-password" className="h-12 rounded-xl border-slate-200 pr-14 focus:border-blue-600" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : 1} required /><button type="button" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={showPassword} aria-controls="auth-password" onClick={() => setShowPassword(value => !value)} className="absolute right-0 top-1/2 flex h-13 w-13 -translate-y-1/2 items-center justify-center rounded-xl text-base font-bold text-slate-500 hover:text-brand">{showPassword ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}</button></div>{signup && <p className="mt-2 text-xs text-slate-500">ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร</p>}</div>
      <button type="submit" className="h-13 w-full rounded-xl bg-brand text-base font-bold text-white hover:bg-blue-900">{pending ? 'กำลังดำเนินการ…' : signup ? 'สมัครทดลองใช้' : 'เข้าสู่ระบบ'}</button>
      {signup && <p className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-center text-xs leading-relaxed text-slate-500"><span>✓ ไม่ต้องผูกบัตรเครดิต</span><span>✓ ใช้งานได้ทันทีใน 1 นาที</span><span>✓ ปลอดภัย 100%</span></p>}
      <button type="button" className="h-13 w-full rounded-xl border border-slate-200 text-base font-bold text-brand hover:bg-blue-50" onClick={() => { setSignup(!signup); setShowPassword(false); setMessage(''); }}>{signup ? 'มีบัญชีแล้ว เข้าสู่ระบบ' : 'ยังไม่มีบัญชี สมัครทดลองใช้'}</button>
    </fieldset></form>
    {message && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-800">{message}</p>}
  </section>;
}
