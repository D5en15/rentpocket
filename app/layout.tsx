import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'RentPocket — จัดการหอพักครบวงจร', description: 'คำนวณค่าน้ำไฟ ออกบิล PromptPay และจัดการหอพักในมือถือ' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
