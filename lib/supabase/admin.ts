import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SlipError } from '@/lib/slip/types';
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new SlipError('CONFIGURATION_ERROR','ระบบตรวจสลิปยังไม่ได้ตั้งค่าการเชื่อมต่อเซิร์ฟเวอร์');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
