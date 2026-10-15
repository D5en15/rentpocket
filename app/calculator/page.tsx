import type { Metadata } from 'next';
import PublicFreeTool from '@/components/modules/public/PublicFreeTool';
import { bangkokDate } from '@/lib/dashboard/model';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title:'RentPocket — คำนวณค่าน้ำไฟและออกบิลฟรี',description:'ออกบิลค่าเช่าและค่าน้ำไฟ 1–2 ห้องฟรี พร้อม QR PromptPay บันทึกรูปและแชร์เข้า LINE ไม่ต้องลงทะเบียน' };
export default function CalculatorPage() { return <PublicFreeTool currentCycle={bangkokDate().slice(0,7)} />; }
