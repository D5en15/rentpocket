import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') { const response = NextResponse.next({ request }); response.headers.set('Cache-Control', 'private, no-store'); return response; }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const client = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      for (const { name, value } of values) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of values) response.cookies.set(name, value, options);
    },
  } });
  await client.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/setup/:path*', '/meters/:path*', '/dashboard/:path*'] };
