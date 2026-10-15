import type { ReactNode } from 'react';
import { devMockEnabled } from '@/lib/dev/mock';
import AppNavigation from '@/components/shared/AppNavigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const mock = devMockEnabled();
  let userName = mock ? 'CEO · บัญชีทดสอบ' : 'บัญชีของคุณ';
  if (!mock) {
    try { const { data: { user } } = await (await createClient()).auth.getUser(); userName = user?.user_metadata?.full_name || user?.email || userName; }
    catch { /* Pages display the existing authentication/configuration state. */ }
  }
  return <div className="min-h-screen bg-slate-50 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
    <AppNavigation userName={userName} mock={mock} />
    {children}
  </div>;
}
