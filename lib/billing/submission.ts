import { hundredths, validDate } from './calculation.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const decimal = (value: unknown): value is string => typeof value === 'string' && hundredths(value) !== null;
const normalizedDecimal = (value: string) => value.trim().replace(',', '.');

// Validate untrusted action inputs and whitelist the exact RPC payload.
// In particular, never forward client-calculated carry or monetary totals.
export function normalizeMeterReadings(value: unknown) {
  const readings: unknown[] = Array.isArray(value) ? value : [value];
  if (readings.length < 1 || readings.length > 100) return null;
  const ids = new Set<string>();
  const normalized = [];
  for (const reading of readings) {
    if (!reading || typeof reading !== 'object' || Array.isArray(reading)) return null;
    const item = reading as Record<string, unknown>;
    if (typeof item.billId !== 'string' || !uuid.test(item.billId) || ids.has(item.billId)
      || typeof item.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(item.expectedUpdatedAt))
      || typeof item.dueDate !== 'string' || !validDate(item.dueDate)
      || typeof item.isRollover !== 'boolean' || typeof item.isReplaced !== 'boolean'
      || typeof item.confirmWarning !== 'boolean' || (item.isRollover && item.isReplaced)
      || !decimal(item.currentElectric) || !decimal(item.otherFees)
      || typeof item.currentWater !== 'string' || (item.currentWater !== '' && !decimal(item.currentWater))) return null;
    if (item.isReplaced && (!decimal(item.oldFinal) || !decimal(item.newInitial)
      || hundredths(item.currentElectric)! < hundredths(item.newInitial)!)) return null;
    ids.add(item.billId);
    normalized.push({
      billId: item.billId, expectedUpdatedAt: item.expectedUpdatedAt, dueDate: item.dueDate,
      isRollover: item.isRollover, isReplaced: item.isReplaced, confirmWarning: item.confirmWarning,
      current: normalizedDecimal(item.currentElectric),
      currentWater: normalizedDecimal(item.currentWater),
      old_final: item.isReplaced ? normalizedDecimal(item.oldFinal as string) : '0',
      new_initial: item.isReplaced ? normalizedDecimal(item.newInitial as string) : '0',
      otherFees: normalizedDecimal(item.otherFees),
    });
  }
  return normalized;
}
