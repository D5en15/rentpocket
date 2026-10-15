'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChartNoAxesCombined, Zap, Settings2, Wallet, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
const items = [
  { href: '/dashboard', label: 'แดชบอร์ด', icon: ChartNoAxesCombined },
  { href: '/meters', label: 'จดมิเตอร์', icon: Zap },
  { href: '/setup', label: 'จัดการหอพัก', icon: Settings2 },
];
export default function AppNavigation({ userName, mock }: { userName: string; mock: boolean }) {
  const path = usePathname(), router = useRouter();
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  async function logout() {
    setPending(true); setError('');
    try {
      if (!mock) { const { error } = await createClient().auth.signOut(); if (error) throw error; }
      router.replace('/login'); router.refresh();
    } catch { setError('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง'); setPending(false); }
  }
  const links = (mobile: boolean) => items.map(item => {
    const active = path === item.href || path.startsWith(`${item.href}/`);
    return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`${mobile ? 'flex min-h-16 flex-col justify-center gap-1 text-sm' : 'inline-flex min-h-12 gap-2 px-4 text-sm'} items-center rounded-xl font-semibold transition-colors ${active ? 'bg-blue-50 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><item.icon size={mobile ? 24 : 18} aria-hidden /><span>{item.label}</span></Link>;
  });
  return <>
    <header className="border-b border-slate-200 bg-white shadow-sm"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
      <Link href="/dashboard" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white"><Wallet size={22} aria-hidden /></span><span className="text-lg font-extrabold tracking-tight">RentPocket</span></Link>
      <nav aria-label="เมนูระบบ" className="hidden items-center gap-1 lg:flex">{links(false)}</nav>
      <div className="flex min-w-0 items-center gap-2"><span className="hidden max-w-40 truncate text-sm font-medium text-slate-600 sm:block">{userName}</span><button type="button" disabled={pending} onClick={logout} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><LogOut size={18} aria-hidden /><span className="hidden sm:inline">{pending ? 'กำลังออก…' : 'ออกจากระบบ'}</span><span className="sr-only sm:hidden">ออกจากระบบ</span></button></div>
    </div></header>
    {error && <p role="alert" className="bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">{error}</p>}
    <nav aria-label="เมนูระบบบนมือถือ" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/90 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"><div className="mx-auto grid max-w-lg grid-cols-3 gap-2">{links(true)}</div></nav>
  </>;
}
