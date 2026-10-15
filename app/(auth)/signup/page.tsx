import SetupAuth from '@/components/setup-auth';
export default function SignupPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><h1 className="sr-only">สมัครทดลองใช้ RentPocket</h1><SetupAuth initialMode="signup" redirectTo="/setup" /></main>;
}
