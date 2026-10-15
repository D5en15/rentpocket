import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { freeBill, billFilename, freeBillText } from '../lib/public/bill.ts';
import { crc16Ccitt, promptPayPayload } from '../lib/public/promptpay.ts';
import { qrMatrix, qrSvgDataUri } from '../lib/public/qr.ts';
const room = {roomName:'101',baseRent:'3000',previousElectric:'100',currentElectric:'200',electricRate:'8',waterType:'PER_UNIT',previousWater:'20',currentWater:'25',waterRate:'18',otherFees:'50',isRollover:false};
const details = {propertyName:'หอพักทดสอบ',cycle:'2026-10',dueDate:'2026-11-05',promptpayId:'0812345678',promptpayName:'บัญชีทดสอบ'};
function fields(payload) {
  const result = {}; let offset = 0;
  while (offset < payload.length) { const id = payload.slice(offset,offset+2),length = Number(payload.slice(offset+2,offset+4)); result[id] = payload.slice(offset+4,offset+4+length); offset += 4+length; }
  assert.equal(offset,payload.length); return result;
}
test('public bills use the existing calculation engine with no database', () => {
  const result = freeBill(room,details); assert.equal(result.ok,true);
  assert.equal(result.bill.calculation.totalAmount,3940); assert.equal(result.bill.calculation.electricUnits,100);
  const flat = freeBill({...room,waterType:'FLAT_RATE',waterRate:'150',previousWater:'',currentWater:''},details);
  assert.equal(flat.ok,true); assert.equal(flat.bill.calculation.waterAmount,150); assert.equal(flat.bill.calculation.totalAmount,4000);
});
test('invalid public readings never produce a payable preview', () => {
  for (const patch of [{currentElectric:''},{currentElectric:'99'},{currentWater:'19'},{baseRent:'-1'},{roomName:''}]) assert.equal(freeBill({...room,...patch},details).ok,false);
  assert.equal(freeBill(room,{...details,dueDate:'2026-02-30'}).ok,false);
  assert.equal(freeBill(room,{...details,cycle:'2026-13'}).ok,false);
});
test('two rooms remain independent and rollover uses 10000', () => {
  assert.equal(freeBill(room,details).bill.calculation.totalAmount,3940);
  const second = freeBill({...room,roomName:'102',previousElectric:'9998',currentElectric:'0015',isRollover:true},details);
  assert.equal(second.bill.calculation.electricUnits,17); assert.equal(second.bill.calculation.totalAmount,3276);
});
test('dynamic PromptPay phone payload includes the exact THB amount and CRC', () => {
  const payload = promptPayPayload('0812345678','3940.25'),parsed = fields(payload);
  assert.equal(parsed['00'],'01'); assert.equal(parsed['01'],'12'); assert.equal(parsed['53'],'764'); assert.equal(parsed['58'],'TH'); assert.equal(parsed['54'],'3940.25');
  assert.deepEqual(fields(parsed['29']),{'00':'A000000677010111','01':'0066812345678'});
  assert.equal(payload.slice(-4),crc16Ccitt(payload.slice(0,-4)));
  assert.equal(crc16Ccitt('123456789'),'29B1');
});
test('national ID uses the correct PromptPay proxy type, including small amounts', () => {
  const parsed = fields(promptPayPayload('1234567890123','0.01'));
  assert.equal(fields(parsed['29'])['02'],'1234567890123'); assert.equal(parsed['54'],'0.01');
  assert.equal(fields(promptPayPayload('0812345678','99999999.99'))['54'],'99999999.99');
});
test('invalid recipients and unsupported amounts cannot generate payment QR', () => {
  for (const id of ['','081234567','08123456789','1112345678','08xxxxxxxx','123456789012x']) assert.throws(() => promptPayPayload(id,100));
  for (const amount of [0,-1,'1.001','100000000','NaN']) assert.throws(() => promptPayPayload('0812345678',amount));
});
test('QR output has a four-module quiet zone and deterministic local SVG', () => {
  const matrix = qrMatrix(promptPayPayload('0812345678',100));
  assert.equal(matrix.length,41); assert.ok(matrix.every(row => row.length === 41));
  const svg = decodeURIComponent(qrSvgDataUri(matrix)); assert.ok(svg.includes('viewBox="0 0 49 49"')); assert.ok(svg.includes('shape-rendering="crispEdges"'));
  assert.deepEqual(matrix,qrMatrix(promptPayPayload('0812345678',100)));
  assert.throws(() => qrMatrix('x'.repeat(107)));
});
test('download filenames and share messages retain actual bill amounts and recipient', () => {
  const bill = freeBill({...room,roomName:'101/a:b'},details).bill;
  assert.equal(billFilename(bill),'RentPocket-2026-10-101-a-b.png');
  const text = freeBillText(bill); for (const part of ['3,940.00','0812345678','บัญชีทดสอบ','2026-11-05']) assert.ok(text.includes(part));
});
function png(matrix) {
  const scale = 8,side = (matrix.length+8)*scale,rows = Buffer.alloc(side*(side+1),255);
  for (let y = 0; y < side; y++) { rows[y*(side+1)] = 0; for (let x = 0; x < side; x++) if (matrix[Math.floor(y/scale)-4]?.[Math.floor(x/scale)-4]) rows[y*(side+1)+x+1] = 0; }
  function chunk(type,data) {
    const name = Buffer.from(type),content = Buffer.concat([name,data]); let crc = 0xffffffff;
    for (const byte of content) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc>>>1)^((crc&1) ? 0xedb88320 : 0); }
    const length = Buffer.alloc(4),sum = Buffer.alloc(4); length.writeUInt32BE(data.length); sum.writeUInt32BE((crc^0xffffffff)>>>0);
    return Buffer.concat([length,content,sum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(side,0); header.writeUInt32BE(side,4); header[8] = 8;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
test('optional native Vision decoder reads the generated payment QR',{skip:process.platform !== 'darwin' || process.env.RENTPOCKET_NATIVE_QR_TEST !== '1' ? 'Requires unrestricted macOS image processing; enable RENTPOCKET_NATIVE_QR_TEST=1' : false},() => {
  const directory = mkdtempSync(join(tmpdir(),'rentpocket-qr-'));
  try {
    for (const [id,amount] of [['0812345678','3940.25'],['1234567890123','0.01'],['0812345678','99999999.99']]) {
      const payload = promptPayPayload(id,amount),path = join(directory,'qr.png'); writeFileSync(path,png(qrMatrix(payload)));
      const result = spawnSync('/usr/bin/swift',['-module-cache-path',join(directory,'swift-cache'),fileURLToPath(new URL('./qr-native-check.swift',import.meta.url)),path],{encoding:'utf8',timeout:55000});
      assert.equal(result.status,0,result.stderr || result.error?.message); assert.equal(result.stdout.trim(),payload);
    }
  } finally { rmSync(directory,{recursive:true,force:true}); }
});

test('QR codewords independently decode with valid format and Reed–Solomon syndromes',() => {
  // Independent readback: geometry constants and format words from QR Model 2,
  // GF logarithm tables and Horner syndrome evaluation, not encoder helpers.
  const formats = [0x5412,0x5125,0x5e7c,0x5b4b,0x45f9,0x40ce,0x4f97,0x4aa0];
  const masks = [(x,y)=>(x+y)%2===0,(_x,y)=>y%2===0,x=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(y/2)+Math.floor(x/3))%2===0,(x,y)=>(x*y)%2+(x*y)%3===0,(x,y)=>((x*y)%2+(x*y)%3)%2===0,(x,y)=>((x+y)%2+(x*y)%3)%2===0];
  const powers = [],logs = Array(256).fill(-1); let power = 1;
  for (let i = 0; i < 255; i++) { powers[i] = power; logs[power] = i; power *= 2; if (power >= 256) power ^= 0x11d; }
  function product(a,b) { return a === 0 || b === 0 ? 0 : powers[(logs[a]+logs[b])%255]; }
  const used = new Set();
  for (const [id,amount] of [['0812345678','3940.25'],['1234567890123','0.01'],['0812345678','99999999.99']]) {
    const payload = promptPayPayload(id,amount),matrix = qrMatrix(payload);
    const formatPositions = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    const format = formatPositions.reduce((word,[x,y],index) => word+(matrix[y][x] ? 2**index : 0),0);
    const mask = formats.indexOf(format); assert.notEqual(mask,-1,'Invalid M-level format word'); used.add(mask);
    const functionCell = (x,y) => (x<=8 && y<=8) || (x>=33 && y<=8) || (x<=8 && y>=33) || x===6 || y===6 || (x>=32 && x<=36 && y>=32 && y<=36);
    const bits = []; let upward = true;
    for (const right of [40,38,36,34,32,30,28,26,24,22,20,18,16,14,12,10,8,5,3,1]) {
      for (let scan = 0; scan < 41; scan++) { const y = upward ? 40-scan : scan; for (const x of [right,right-1]) if (!functionCell(x,y)) bits.push(Number(matrix[y][x] !== masks[mask](x,y))); }
      upward = !upward;
    }
    assert.equal(bits.length,1383); assert.ok(bits.slice(1376).every(bit => bit===0),'Remainder bits must be zero after unmasking');
    const words = Array.from({length:172},(_,i) => parseInt(bits.slice(i*8,i*8+8).join(''),2));
    const blocks = Array.from({length:4},(_,block) => [...Array.from({length:27},(_,i) => words[i*4+block]),...Array.from({length:16},(_,i) => words[108+i*4+block])]);
    for (const block of blocks) for (let root = 0; root < 16; root++) {
      let syndrome = 0; for (const coefficient of block) syndrome = product(syndrome,powers[root])^coefficient;
      assert.equal(syndrome,0,'Reed–Solomon parity is invalid');
    }
    const dataBits = blocks.flatMap(block => block.slice(0,27)).flatMap(byte => byte.toString(2).padStart(8,'0').split(''));
    assert.equal(dataBits.slice(0,4).join(''),'0100');
    const count = parseInt(dataBits.slice(4,12).join(''),2);
    const decoded = new TextDecoder().decode(Uint8Array.from({length:count},(_,i) => parseInt(dataBits.slice(12+i*8,20+i*8).join(''),2)));
    assert.equal(decoded,payload);
  }
  assert.ok(used.size>=1);
});
