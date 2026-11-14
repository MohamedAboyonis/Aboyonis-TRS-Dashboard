import type { AppData, DayCode, ISODate, LeaveType } from './types';
import { inRange, today } from './dates';

export const DAY_CODES: Record<DayCode, { label: string; color: string; worked: boolean }> = {
  J: { label: 'Job / Rig day', color: '#1d6fd1', worked: true },
  W: { label: 'Workshop day', color: '#7c5cd6', worked: true },
  S: { label: 'Safety day', color: '#0f9d76', worked: true },
  T: { label: 'Training', color: '#12a3b8', worked: true },
  SB: { label: 'Standby', color: '#8a8f98', worked: true },
  OF: { label: 'Office', color: '#5a6b85', worked: true },
  A: { label: 'Absent', color: '#d1343a', worked: false },
  V: { label: 'Vacation', color: '#e08a00', worked: false },
  SL: { label: 'Sick leave', color: '#c2417e', worked: false },
  EL: { label: 'Emergency leave', color: '#b0592a', worked: false },
  UL: { label: 'Unpaid leave', color: '#7a5a40', worked: false },
  O: { label: 'Day off', color: '#9aa3ad', worked: false },
  X: { label: 'Removed / blank', color: 'transparent', worked: false },
};

export const OVERRIDE_CODES: DayCode[] = ['J', 'W', 'S', 'T', 'SB', 'OF', 'A', 'V', 'SL', 'EL', 'UL', 'O', 'X'];

const LEAVE_CODE: Record<LeaveType, DayCode> = {
  Vacation: 'V',
  'Sick Leave': 'SL',
  'Emergency Leave': 'EL',
  'Unpaid Leave': 'UL',
};

export interface DayCell {
  code: DayCode | null;
  source: 'override' | 'leave' | 'job' | 'pending-leave' | null;
  detail?: string;
  overrideId?: string;
}

/**
 * Timesheet is generated automatically:
 *   1. Operations override (safety day, absent, workshop day, removed …) wins
 *   2. Approved leave (vacation / sick …)
 *   3. Job registration (crew assignment on a rig job)
 *   4. Pending leave is shown as a hint only
 */
export function buildIndex(data: AppData) {
  const overrides = new Map<string, (typeof data.overrides)[number]>();
  data.overrides.forEach((o) => overrides.set(`${o.employeeId}|${o.date}`, o));
  const jobsById = new Map(data.jobs.map((j) => [j.id, j]));
  const rigsById = new Map(data.rigs.map((r) => [r.id, r]));
  const t = today();

  return function cell(employeeId: string, date: ISODate): DayCell {
    const o = overrides.get(`${employeeId}|${date}`);
    if (o) return { code: o.code, source: 'override', detail: o.note ? `${DAY_CODES[o.code].label} — ${o.note}` : DAY_CODES[o.code].label, overrideId: o.id };

    const leave = data.leaves.find((l) => l.employeeId === employeeId && l.status !== 'Rejected' && inRange(date, l.startDate, l.endDate));
    if (leave && leave.status === 'Approved') return { code: LEAVE_CODE[leave.type], source: 'leave', detail: leave.type };

    const a = data.assignments.find((x) => {
      if (x.employeeId !== employeeId) return false;
      const job = jobsById.get(x.jobId);
      // Open registrations run until the technician signs off, the job ends, or today (never into the future)
      return inRange(date, x.startDate, x.endDate ?? job?.endDate ?? t);
    });
    if (a) {
      const job = jobsById.get(a.jobId);
      const rig = job?.rigId ? rigsById.get(job.rigId) : undefined;
      return { code: 'J', source: 'job', detail: `Job ${job?.jobNo ?? ''}${rig ? ` · ${rig.name}` : ''}` };
    }
    if (leave) return { code: LEAVE_CODE[leave.type], source: 'pending-leave', detail: `${leave.type} (pending)` };
    return { code: null, source: null };
  };
}

export function summarize(cells: DayCell[]) {
  const counts: Partial<Record<DayCode, number>> = {};
  let worked = 0;
  cells.forEach((c) => {
    if (!c.code || c.source === 'pending-leave' || c.code === 'X') return;
    counts[c.code] = (counts[c.code] ?? 0) + 1;
    if (DAY_CODES[c.code].worked) worked++;
  });
  return { counts, worked };
}
