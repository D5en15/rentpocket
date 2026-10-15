import type { FreeBill } from './bill.ts';
import { promptPayPayload } from './promptpay.ts';
import { qrMatrix } from './qr.ts';
const money = new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const number = new Intl.NumberFormat('th-TH',{maximumFractionDigits:2});
export async function renderBillPng(bill: FreeBill): Promise<Blob> {
  await document.fonts.ready;
  const matrix = qrMatrix(promptPayPayload(bill.promptpayId,bill.calculation.totalAmount));
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1640;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('เครื่องนี้ไม่รองรับการสร้างรูปบิล');
  const ctx = context;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#1e40af'; ctx.fillRect(0,0,canvas.width,16);
  const font = 'Arial, sans-serif';
  function text(value: string,x: number,y: number,size = 30,color = '#0f172a',bold = false,align: CanvasTextAlign = 'left',width = 960) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value,x,y,width);
  }
  function line(y: number) { ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60,y); ctx.lineTo(1020,y); ctx.stroke(); }
  text('RentPocket',60,85,32,'#1e40af',true);
  text('ใบแจ้งค่าเช่าและค่าน้ำไฟ',60,155,46,'#0f172a',true);
  text(`ห้อง ${bill.roomName}`,60,215,36,'#0f172a',true);
  if (bill.propertyName) text(bill.propertyName,60,270,30,'#475569');
  text(`รอบบิล ${bill.cycle}  ·  กำหนดชำระ ${bill.dueDate}`,60,325,28,'#475569'); line(360);
  function row(label: string,value: number,y: number) { text(label,60,y,32); text(`${money.format(value)} บาท`,1020,y,32,'#0f172a',true,'right',450); }
  row('ค่าเช่า',bill.calculation.baseRent,420);
  row('ค่าไฟ',bill.calculation.electricAmount,495);
  text(`${number.format(bill.previousElectric)} → ${number.format(bill.currentElectric)}${bill.isRollover ? ' (ชนรอบ 10000)' : ''}`,60,545,26,'#64748b');
  text(`${number.format(bill.calculation.electricUnits)} หน่วย × ${number.format(bill.electricRate)} บาท/หน่วย`,60,585,26,'#64748b');
  row(bill.waterType === 'FLAT_RATE' ? 'ค่าน้ำเหมาจ่าย' : 'ค่าน้ำ',bill.calculation.waterAmount,665);
  text(bill.waterType === 'FLAT_RATE' ? `${money.format(bill.waterRate)} บาท/เดือน` : `${number.format(bill.previousWater)} → ${number.format(bill.currentWater)} · ${number.format(bill.calculation.waterUnits)} หน่วย × ${number.format(bill.waterRate)} บาท`,60,715,26,'#64748b');
  row('ค่าใช้จ่ายอื่น',bill.calculation.otherFees,790); line(830);
  ctx.fillStyle = '#eff6ff'; ctx.fillRect(60,860,960,120);
  text('ยอดเงินรวมสุทธิ',90,905,30,'#1e40af',true);
  text(`${money.format(bill.calculation.totalAmount)} บาท`,990,950,48,'#1e40af',true,'right',860);
  // Integer module size, high contrast and four-module quiet zone preserve scanability.
  const scale = 9,side = (matrix.length+8)*scale,left = Math.floor((canvas.width-side)/2),top = 1030;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(left,top,side,side); ctx.fillStyle = '#000000';
  matrix.forEach((row,y) => row.forEach((dark,x) => { if (dark) ctx.fillRect(left+(x+4)*scale,top+(y+4)*scale,scale,scale); }));
  text('สแกน PromptPay เพื่อชำระตามยอดบิล',540,1505,26,'#475569',false,'center');
  text(bill.promptpayId,540,1548,30,'#0f172a',true,'center');
  if (bill.promptpayName) text(`ชื่อบัญชี ${bill.promptpayName}`,540,1590,26,'#475569',false,'center');
  return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('สร้างรูปบิลไม่สำเร็จ')),'image/png'));
}
