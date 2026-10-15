# RentPocket — System Specifications & Business Rules (MVP)

## 1. Product Overview
- **Core Value:** จดมิเตอร์ปุ๊บ ออกบิลส่ง LINE ปั๊บ ตรวจสลิปปลอมอัตโนมัติ จบในมือถือเครื่องเดียวภายใน 15 นาที
- **Target Persona:** เจ้าของห้องเช่ารายย่อย (5–50 ห้อง) อายุ 40–60 ปี เดินถือมือถือจดมิเตอร์หน้าห้อง
- **Subscription Plans:**
  - Free Trial: 14 วัน (สูงสุด 50 ห้อง)
  - Micro Pack: 199 บ./ด. (สูงสุด 10 ห้อง)
  - Standard Pack: 349 บ./ด. (สูงสุด 25 ห้อง)
  - Pro Pack: 599 บ./ด. (สูงสุด 50 ห้อง)
  - Custom Hard Cap: สูงสุดไม่เกิน 100 ห้อง (ตรวจสอบผ่าน `subscription.max_rooms`)

## 2. Calculation Rules
- **Electricity Usage:** `curr_electric - prev_electric`
  - *Rollover Exception (เช่น 9998 -> 0015):* `(10000 - prev_electric) + curr_electric` (เมื่อผู้ใช้เปิดสวิตช์ Rollover)
  - *Replacement Exception:* `(old_final - prev_electric) + (curr_electric - new_initial)`
- **Water Billing Logic:**
  - `PER_UNIT`: `(curr_water - prev_water) * water_rate`
  - `FLAT_RATE`: คิดเหมาจ่ายคงที่ตาม `water_rate` ไม่ต้องกรอกมิเตอร์น้ำ
- **Human Error Trap (Soft Warning):** หากหน่วยไฟเดือนนี้สูงเกิน 3 เท่าของเดือนก่อน หรือเกิน 500 หน่วย ให้แสดง Modal สีส้มเตือนผู้ใช้ก่อนออกบิล

## 3. Fraud Protection & API Cost Guard
- **Slip Duplicate Guard:** ฟิลด์ `trans_ref` ต้องเป็น UNIQUE ระดับ Global Database ห้ามซ้ำข้ามห้อง/ข้ามเดือนเด็ดขาด
- **EasySlip Quota:** จำกัดการตรวจอัตโนมัติ 3 ครั้ง/ห้อง/รอบบิล (`slip_verify_count <= 3`)
- **Manual Approve Fallback:** มีปุ่มให้เจ้าของหอกดยืนยันยอดด้วยตนเองได้เสมอ (เงินสด / สลิปนอกระบบ / API ล่ม)

## 4. State Transitions
- **Bill Status:** `DRAFT` -> `PENDING_PAYMENT` (เหลือง) -> `PAID` (เขียว) หรือ `OVERDUE` (แดง เมื่อเกิน Due Date)
- **Subscription Status:** `TRIAL_ACTIVE` -> `ACTIVE` / `PAST_DUE` / `TRIAL_EXPIRED` (เมื่อหมดอายุเข้าโหมด Read-Only ดูประวัติได้แต่บล็อกการออกบิลใหม่)