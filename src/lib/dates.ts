import type { ISODate } from './types';

export function today(): ISODate {
  return toISO(new Date());
}

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function monthDays(year: number, month: number): ISODate[] {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => toISO(new Date(year, month, i + 1)));
}

export function fmtDate(s?: string) {
  if (!s) return '—';
  const d = s.length > 10 ? new Date(s) : parseISO(s);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function inRange(d: ISODate, start: ISODate, end?: ISODate) {
  return d >= start && (!end || d <= end);
}

export type ExpiryState = 'valid' | 'expiring' | 'expired' | 'none';

export function expiryState(expiry?: ISODate, warnDays = 30): ExpiryState {
  if (!expiry) return 'none';
  const t = today();
  if (expiry < t) return 'expired';
  if (daysBetween(t, expiry) <= warnDays) return 'expiring';
  return 'valid';
}
