import SetupAuth from '@/components/setup-auth';
export default function LoginPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><h1 className="sr-only">เข้าสู่ระบบ RentPocket</h1><div className="w-full max-w-md">{process.env.NODE_ENV === 'development' && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-900">โหมดทดสอบ: กดเข้าสู่ระบบหรือ Enter ได้ทันที ไม่ต้องกรอกอีเมลและรหัสผ่าน</p>}<SetupAuth redirectTo="/dashboard" /></div></main>;
}
