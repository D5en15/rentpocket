export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function amount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value)) return null;
  return Number(value);
}
export function subscriptionExpired(s: { status: string; trial_ends_at: string | null; current_period_end: string | null }) {
  const now = Date.now();
  return !['TRIAL_ACTIVE', 'ACTIVE'].includes(s.status)
    || [s.trial_ends_at, s.current_period_end].some(date => date !== null && Date.parse(date) < now)
    || (s.status === 'TRIAL_ACTIVE' && !s.trial_ends_at)
    || (s.status === 'ACTIVE' && !s.current_period_end);
}
