import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';
export async function createClient() {
  const { url, key } = getSupabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, { cookies: {
    getAll: () => store.getAll(),
    setAll(values) {
      try { for (const { name, value, options } of values) store.set(name, value, options); }
      catch { /* Server Components rely on Proxy for cookie refresh. */ }
    },
  } });
}
