const shortMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const longMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export function thaiCycle(cycle: string, short = false): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(cycle)) return 'ไม่ระบุรอบบิล';
  const month = Number(cycle.slice(5))-1, year = Number(cycle.slice(0,4))+543;
  return `${(short ? shortMonths : longMonths)[month]} ${short ? String(year).slice(-2) : year}`;
}
export function thaiDueDate(date: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)) return 'ไม่ระบุวันที่';
  return `${Number(date.slice(8))} ${thaiCycle(date.slice(0,7),true)}`;
}
export function cycleChoices(current: string, selected: string): string[] {
  const year = Number(current.slice(0,4)), month = Number(current.slice(5))-1;
  const values = new Set([selected]);
  for (let offset = 1; offset >= -24; offset--) {
    const date = new Date(Date.UTC(year,month+offset,1));
    values.add(`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`);
  }
  return [...values].sort((a,b) => b.localeCompare(a));
}
