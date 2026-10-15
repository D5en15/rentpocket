import { Buffer } from 'node:buffer';
import { MAX_SLIP_BYTES, SlipError } from './types.ts';
// One bounded multipart image only. Reject strings and extra file/form fields.
export function slipUploadFile(value: unknown): File {
  if (!(value instanceof FormData)) throw new SlipError('INVALID_INPUT', 'กรุณาส่งรูปสลิปด้วย FormData');
  const entries = Array.from(value.entries());
  const file = value.get('image');
  if (entries.length !== 1 || entries[0][0] !== 'image' || !(file instanceof File)
    || !file.size || file.size > MAX_SLIP_BYTES || file.name.length > 255) {
    throw new SlipError('INVALID_INPUT', 'กรุณาส่งภาพสลิปหนึ่งไฟล์ ขนาดไม่เกิน 4 MB');
  }
  return file;
}
function imageMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 6 && ['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('ascii'))) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(0,4).toString('ascii') === 'RIFF' && bytes.subarray(8,12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
export function slipImageDataUri(value: string | Buffer): string {
  let bytes: Buffer;
  if (typeof value === 'string') {
    if (value.length > Math.ceil(MAX_SLIP_BYTES / 3) * 4 + 100) throw new SlipError('INVALID_INPUT', 'รูปสลิปต้องมีขนาดไม่เกิน 4 MB');
    const base64 = value.replace(/^data:image\/(?:jpeg|png|gif|webp);base64,/i, '');
    if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new SlipError('INVALID_INPUT', 'ข้อมูลภาพ Base64 ไม่ถูกต้อง');
    bytes = Buffer.from(base64, 'base64');
    if (bytes.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) throw new SlipError('INVALID_INPUT', 'ข้อมูลภาพ Base64 ไม่ถูกต้อง');
  } else bytes = value;
  if (!bytes.length || bytes.length > MAX_SLIP_BYTES) throw new SlipError('INVALID_INPUT', 'รูปสลิปต้องมีขนาดไม่เกิน 4 MB');
  const mime = imageMime(bytes);
  if (!mime) throw new SlipError('INVALID_INPUT', 'รองรับเฉพาะภาพ JPEG, PNG, GIF และ WebP');
  return `data:${mime};base64,${bytes.toString('base64')}`;
}
