import test from 'node:test';
import assert from 'node:assert/strict';
import { bangkokDate, billMessage, dashboardSummary, trafficStatus } from '../lib/dashboard/model.ts';
const bill = { id:'test-bill',status:'PENDING_PAYMENT',due_date:'2026-10-06',billing_cycle:'2026-10',total_amount:100.25,base_rent:90,electric_amount:5,water_amount:5,other_fees:0.25,room:{room_number:'101',tenant_name:null},property:{name:'หอพักทดสอบ',promptpay_id:'0812345678',promptpay_name:'บัญชีทดสอบ'} };
test('due dates remain payable for the entire Bangkok due day', () => {
  assert.equal(trafficStatus(bill,'2026-10-06'),'PENDING_PAYMENT');
  assert.equal(trafficStatus(bill,'2026-10-07'),'OVERDUE');
  assert.equal(trafficStatus({...bill,status:'PAID'},'2026-10-07'),'PAID');
  assert.equal(bangkokDate(new Date('2026-10-06T17:00:00Z')),'2026-10-07');
  assert.equal(bangkokDate(new Date('2026-10-06T16:59:59Z')),'2026-10-06');
});
test('summary counts statuses and sums exact cents for only issued bill data', () => {
  const result = dashboardSummary([bill,{...bill,id:'paid',status:'PAID',total_amount:200.10},{...bill,id:'future',due_date:'2026-10-20',total_amount:0.10}],'2026-10-07');
  assert.equal(result.total,300.45); assert.equal(result.collected,200.10); assert.equal(result.outstanding,100.35);
  assert.deepEqual(result.counts,{PAID:1,PENDING_PAYMENT:1,OVERDUE:1});
  assert.equal(dashboardSummary([],'2026-10-07').total,0);
});
test('reminder and share messages include total, due date and exact PromptPay', () => {
  const text = billMessage(bill,true);
  for (const fragment of ['100.25','0812345678','บัญชีทดสอบ','ห้อง 101','06/10/2569','ขออนุญาต','หากชำระแล้ว']) assert.ok(text.includes(fragment));
  assert.ok(billMessage(bill).startsWith('แจ้งยอดค่าเช่า'));
});
