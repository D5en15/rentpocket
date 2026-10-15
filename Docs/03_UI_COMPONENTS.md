# RentPocket — UI & Design Specs

## 1. Ergonomics & Mobile Standard
- **Touch Target:** ปุ่มกดและ Interactive Element ทั้งหมดต้องมีขนาด `min-h-[48px]` (ปุ่ม Action หลักใช้ `h-14` / 56px)
- **Numpad Enforcement:** ช่องกรอกตัวเลขมิเตอร์ทั้งหมดต้องมีคุณสมบัติ:
  `type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" enterkeyhint="next"`
- **Number Alignment:** ตัวเลขเงินและมิเตอร์ต้องใช้คลาส `font-mono tabular-nums tracking-tight` เสมอ

## 2. Color Palette Semantics
- **Brand Primary:** `#1E40AF` (Tailwind: `blue-800` / `indigo-700`)
- **Success (ชำระแล้ว):** `#059669` (Tailwind: `emerald-600`)
- **Warning (รอชำระ / Soft Warning):** `#D97706` (Tailwind: `amber-600`)
- **Destructive (ค้างชำระ / เลยกำหนด):** `#DC2626` (Tailwind: `rose-600`)
- **Backgrounds:** Light: `slate-50`, Dark: `slate-900`, Cards: `white` / `slate-800`

## 3. The 4 Core Screens
1. **Screen 1 (Trojan Horse Tool):** Public Free Tool คำนวณค่าน้ำไฟ 1-2 ห้อง -> เรนเดอร์การ์ดรูปบิลพร้อม QR PromptPay -> แชร์เข้า LINE / บันทึกภาพ -> Sticky CTA แบนเนอร์ทดลองใช้ฟรี 14 วัน
2. **Screen 2 (Property & Room Setup):** ตั้งค่า PromptPay, เรทน้ำไฟ, สร้างห้องแบบชุด (Batch Add) พร้อมแถบ Quota Progress Bar (เช่น 8/10 ห้อง) และ Upgrade Modal
3. **Screen 3 (Fast Meter Entry):** หน้าจดมิเตอร์บนมือถือ เทียบเลขเก่า กรอกเลขใหม่ มีปุ่มลัด [มิเตอร์ชนรอบ] และ [เปลี่ยนมิเตอร์] พร้อม Soft Warning Modal สีส้มเมื่อเลขกระโดดเกิน 3 เท่า
4. **Screen 4 (Traffic-Light Dashboard):** แดชบอร์ดสรุปยอด 3 แท็บสี (🟢 ชำระแล้ว / 🟡 รอชำระ / 🔴 ค้างชำระ) พร้อมกล่องตรวจ EasySlip (โควตา 3 ครั้ง), ปุ่มสำรอง Manual Approve และปุ่ม 1-Click ทวงเงินสุภาพลง Clipboard