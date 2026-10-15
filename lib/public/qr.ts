// QR Model 2, version 6, error correction M. The 106-byte capacity covers
// every supported fixed-amount PromptPay payload. No external QR service.
const size = 41;
const dataWords = 108;
const blockWords = 27;
const errorWords = 16;
function multiply(a: number,b: number): number {
  let product = 0;
  for (let bit = 0; bit < 8; bit++) { if (b & 1) product ^= a; b >>>= 1; a <<= 1; if (a & 0x100) a ^= 0x11d; }
  return product;
}
function parity(data: number[]): number[] {
  let generator = [1], root = 1;
  for (let degree = 0; degree < errorWords; degree++) {
    const next = Array(generator.length+1).fill(0) as number[];
    for (let i = 0; i < generator.length; i++) { next[i] ^= generator[i]; next[i+1] ^= multiply(generator[i],root); }
    generator = next; root = multiply(root,2);
  }
  const work = [...data,...Array(errorWords).fill(0)] as number[];
  for (let i = 0; i < data.length; i++) { const lead = work[i]; for (let j = 0; j < generator.length; j++) work[i+j] ^= multiply(lead,generator[j]); }
  return work.slice(-errorWords);
}
function maskBit(mask: number,x: number,y: number): boolean {
  switch (mask) {
    case 0: return (x+y)%2 === 0;
    case 1: return y%2 === 0;
    case 2: return x%3 === 0;
    case 3: return (x+y)%3 === 0;
    case 4: return (Math.floor(x/3)+Math.floor(y/2))%2 === 0;
    case 5: return (x*y)%2+(x*y)%3 === 0;
    case 6: return ((x*y)%2+(x*y)%3)%2 === 0;
    default: return ((x+y)%2+(x*y)%3)%2 === 0;
  }
}
function penalty(matrix: boolean[][]): number {
  let score = 0, dark = 0;
  for (let axis = 0; axis < 2; axis++) for (let line = 0; line < size; line++) {
    let text = '',run = 0,last = false;
    for (let i = 0; i < size; i++) {
      const value = axis === 0 ? matrix[line][i] : matrix[i][line];
      text += value ? '1' : '0';
      if (i === 0 || value !== last) { run = 1; last = value; } else { run++; if (run === 5) score += 3; else if (run > 5) score++; }
    }
    for (let i = 0; i <= size-11; i++) if (['00001011101','10111010000'].includes(text.slice(i,i+11))) score += 40;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (matrix[y][x]) dark++;
    if (y && x && matrix[y][x] === matrix[y-1][x] && matrix[y][x] === matrix[y][x-1] && matrix[y][x] === matrix[y-1][x-1]) score += 3;
  }
  return score + Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;
}
export function qrMatrix(payload: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(payload)];
  if (!bytes.length || bytes.length > 106) throw new Error('QR payload must contain 1–106 bytes');
  const bits: number[] = [];
  function append(value: number,length: number) { for (let i = length-1; i >= 0; i--) bits.push((value>>>i)&1); }
  append(4,4); append(bytes.length,8); for (const byte of bytes) append(byte,8);
  append(0,Math.min(4,dataWords*8-bits.length)); while (bits.length%8) bits.push(0);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i,i+8).reduce((value,bit) => value*2+bit,0));
  while (words.length < dataWords) words.push((words.length-bits.length/8)%2 === 0 ? 0xec : 0x11);
  const blocks = Array.from({length:4},(_,index) => words.slice(index*blockWords,(index+1)*blockWords));
  const errors = blocks.map(parity), interleaved: number[] = [];
  for (let i = 0; i < blockWords; i++) for (const block of blocks) interleaved.push(block[i]);
  for (let i = 0; i < errorWords; i++) for (const block of errors) interleaved.push(block[i]);
  const base = Array.from({length:size},() => Array(size).fill(false) as boolean[]);
  const reserved = base.map(row => row.map(() => false));
  function set(x: number,y: number,value: boolean) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    base[y][x] = value; reserved[y][x] = true;
  }
  for (let i = 0; i < size; i++) { set(6,i,i%2 === 0); set(i,6,i%2 === 0); }
  for (const [cx,cy] of [[3,3],[size-4,3],[3,size-4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const distance = Math.max(Math.abs(dx),Math.abs(dy)); set(cx+dx,cy+dy,distance !== 2 && distance !== 4);
  }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(34+dx,34+dy,Math.max(Math.abs(dx),Math.abs(dy)) !== 1);
  function format(mask: number,matrix: boolean[][]) {
    let rem = mask;
    for (let i = 0; i < 10; i++) rem = (rem<<1) ^ (((rem>>>9)&1)*0x537);
    const value = ((mask<<10)|rem)^0x5412;
    const put = (x: number,y: number,bit: number) => { matrix[y][x] = Boolean((value>>>bit)&1); reserved[y][x] = true; };
    for (let i = 0; i <= 5; i++) put(8,i,i);
    put(8,7,6); put(8,8,7); put(7,8,8);
    for (let i = 9; i < 15; i++) put(14-i,8,i);
    for (let i = 0; i < 8; i++) put(size-1-i,8,i);
    for (let i = 8; i < 15; i++) put(8,size-15+i,i);
    matrix[size-8][8] = true; reserved[size-8][8] = true;
  }
  format(0,base);
  let best = base, bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const matrix = base.map(row => [...row]); let index = 0;
    for (let right = size-1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((right+1)&2) === 0;
      for (let vertical = 0; vertical < size; vertical++) for (let column = 0; column < 2; column++) {
        const x = right-column,y = upward ? size-1-vertical : vertical;
        if (reserved[y][x]) continue;
        const bit = index < interleaved.length*8 ? Boolean((interleaved[index>>>3]>>>(7-(index&7)))&1) : false;
        matrix[y][x] = bit !== maskBit(mask,x,y); index++;
      }
    }
    format(mask,matrix);
    const score = penalty(matrix); if (score < bestPenalty) { best = matrix; bestPenalty = score; }
  }
  return best;
}
export function qrSvgDataUri(matrix: boolean[][]): string {
  const side = matrix.length+8;
  const path = matrix.flatMap((row,y) => row.flatMap((dark,x) => dark ? [`M${x+4} ${y+4}h1v1h-1z`] : [])).join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="black"/></svg>`)}`;
}
