import { useMemo, useState } from 'react';
import { nowIso, remove, uid, upsert, useSession, useStore } from '../lib/store';
import type { CrewAssignment, Leave, LeaveType } from '../lib/types';
import { fmtDate, monthDays, parseISO, today } from '../lib/dates';
import { DAY_CODES, buildIndex, summarize } from '../lib/timesheet';
import { Badge, Card, Empty, ExpiryBadge, Field, FileAttach, FileLink, Page, Select, Tabs } from '../components/ui';
import { JobStatusBadge } from './Jobs';

export function LeaveBadge({ s }: { s: Leave['status'] }) {
  return <Badge tone={s === 'Approved' ? 'good' : s === 'Rejected' ? 'bad' : 'warn'}>{s}</Badge>;
}

export function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="month" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Month" />;
}

export function MonthCalendar({ employeeId, month }: { employeeId: string; month: string }) {
  const data = useStore();
  const cell = useMemo(() => buildIndex(data), [data]);
  const [y, m] = month.split('-').map(Number);
  const days = monthDays(y, m - 1);
  const cells = days.map((d) => cell(employeeId, d));
  const sum = summarize(cells);
  const lead = (parseISO(days[0]).getDay() + 6) % 7; // Monday first
  return (
    <>
      <div className="cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-h">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
        {days.map((d, i) => {
          const c = cells[i];
          const meta = c.code ? DAY_CODES[c.code] : null;
          return (
            <div key={d} className={`cal-d ${d === today() ? 'today' : ''} ${c.source === 'pending-leave' ? 'pending' : ''}`} title={c.detail ?? 'No record'}>
              <span className="cal-n">{Number(d.slice(8))}</span>
              {meta && c.code !== 'X' && <span className="code" style={{ background: meta.color }}>{c.code}</span>}
            </div>
          );
        })}
      </div>
      <div className="row gap wrap small">
        <Badge tone="info">Worked days: {sum.worked}</Badge>
        {Object.entries(sum.counts).map(([k, v]) => <Badge key={k}><span className="dot" style={{ background: DAY_CODES[k as keyof typeof DAY_CODES].color }} /> {DAY_CODES[k as keyof typeof DAY_CODES].label}: {v}</Badge>)}
      </div>
    </>
  );
}

/** Self-service for field / workshop staff: register on jobs, auto timesheet, leave, certificates. */
export default function MyWork() {
  const data = useStore();
  const { user, can } = useSession();
  const manageOthers = can('timesheet.manage');
  const [empId, setEmpId] = useState(user!.id);
  const [tab, setTab] = useState<'jobs' | 'timesheet' | 'leave' | 'certs'>('jobs');
  const [month, setMonth] = useState(today().slice(0, 7));
  const emp = data.employees.find((e) => e.id === empId)!;
  const empOptions = (manageOthers ? data.employees.filter((e) => e.active) : [user!]).map((e) => ({ value: e.id, label: `${e.empNo} · ${e.name}` }));

  return (
    <Page title="My Work" subtitle="Register on jobs — your timesheet fills in automatically">
      <Card>
        <Field label="Employee (name & ID)">
          <Select value={empId} onChange={(v) => v && setEmpId(v)} options={empOptions} />
        </Field>
        <p className="muted small">{emp.position} · {emp.department} {emp.nationalId && `· ID ${emp.nationalId}`}</p>
      </Card>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'jobs', label: 'Jobs' }, { key: 'timesheet', label: 'Timesheet' }, { key: 'leave', label: 'Vacation / Sick' }, { key: 'certs', label: 'Certificates' }]} />
      {tab === 'jobs' && <JobRegistration employeeId={empId} />}
      {tab === 'timesheet' && (
        <Card title={`Timesheet — ${emp.name}`} actions={<MonthPicker value={month} onChange={setMonth} />}>
          <MonthCalendar employeeId={empId} month={month} />
          <p className="muted small">Days come from your job registrations and approved leave. Operations can mark safety days, workshop days, absence, etc.</p>
        </Card>
      )}
      {tab === 'leave' && <LeaveRequests employeeId={empId} />}
      {tab === 'certs' && (
        <Card title="My certificates & IDs">
          {data.certificates.filter((c) => c.employeeId === empId).map((c) => (
            <div key={c.id} className="list-row">
              <div><b>{c.name}</b> <Badge>{c.category}</Badge><div className="muted small">{c.number} {c.issuer && `· ${c.issuer}`}</div></div>
              <div className="row gap"><ExpiryBadge date={c.expiryDate} /><FileLink fileId={c.fileId} /></div>
            </div>
          ))}
          {!data.certificates.some((c) => c.employeeId === empId) && <Empty>No certificates on file. HSE / Training team uploads them.</Empty>}
        </Card>
      )}
    </Page>
  );
}

function JobRegistration({ employeeId }: { employeeId: string }) {
  const data = useStore();
  const { user } = useSession();
  const active = data.jobs.filter((j) => j.status === 'Planned' || j.status === 'In Progress');
  const [jobId, setJobId] = useState('');
  const [crewRole, setCrewRole] = useState('');
  const [start, setStart] = useState(today());
  const mine = data.assignments.filter((a) => a.employeeId === employeeId).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const rigName = (id?: string) => data.rigs.find((r) => r.id === id)?.name ?? '';

  const register = (e: React.FormEvent) => {
    e.preventDefault();
    if (mine.some((a) => a.jobId === jobId && !a.endDate)) return alert('Already registered on this job');
    const a: CrewAssignment = { id: uid('as'), jobId, employeeId, crewRole: crewRole || undefined, startDate: start, registeredBy: user?.name, createdAt: nowIso() };
    upsert('assignments', a, `${data.employees.find((x) => x.id === employeeId)?.name} → ${data.jobs.find((j) => j.id === jobId)?.jobNo}`);
    setJobId('');
  };

  return (
    <>
      <Card title="Register on a job">
        <form onSubmit={register} className="grid3">
          <Field label="Job">
            <Select required value={jobId} onChange={setJobId} options={active.map((j) => ({ value: j.id, label: `${j.jobNo} · ${rigName(j.rigId)} · ${j.serviceType ?? ''} ${j.sizes.join(', ')}` }))} />
          </Field>
          <Field label="Crew role"><Select value={crewRole} onChange={setCrewRole} options={['Supervisor', 'Tong Operator', 'CRT Operator', 'Helper', 'Trainee']} /></Field>
          <Field label="Arrived on location"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
          <button className="btn primary">Register</button>
        </form>
      </Card>
      <Card title="My job registrations">
        {!mine.length && <Empty>Not registered on any job yet.</Empty>}
        {mine.map((a) => {
          const j = data.jobs.find((x) => x.id === a.jobId);
          return (
            <div key={a.id} className="list-row">
              <div>
                <b>{j?.jobNo}</b> · {rigName(j?.rigId)} {j && <JobStatusBadge s={j.status} />}
                <div className="muted small">{a.crewRole} · {fmtDate(a.startDate)} → {a.endDate ? fmtDate(a.endDate) : 'on location'}</div>
              </div>
              <div className="row gap">
                {!a.endDate && <SignOff onDone={(d) => upsert('assignments', { ...a, endDate: d }, `sign-off ${j?.jobNo}`)} min={a.startDate} />}
                {(a.registeredBy === user?.name || a.employeeId === user?.id) && <button className="btn small ghost" onClick={() => confirm('Remove this registration?') && remove('assignments', a.id)}>✕</button>}
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}

function SignOff({ onDone, min }: { onDone: (d: string) => void; min: string }) {
  const [d, setD] = useState(today());
  return (
    <span className="row gap">
      <input type="date" value={d} min={min} onChange={(e) => setD(e.target.value)} aria-label="Release date" />
      <button className="btn small" onClick={() => onDone(d)}>Released</button>
    </span>
  );
}

function LeaveRequests({ employeeId }: { employeeId: string }) {
  const data = useStore();
  const { can, user } = useSession();
  const [l, setL] = useState<Partial<Leave>>({ type: 'Vacation', startDate: today(), endDate: today() });
  const mine = data.leaves.filter((x) => x.employeeId === employeeId).sort((a, b) => b.startDate.localeCompare(a.startDate));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (l.endDate! < l.startDate!) return alert('End date is before start date');
    const autoApprove = can('leave.approve');
    upsert('leaves', {
      id: uid('lv'), employeeId, type: l.type as LeaveType, startDate: l.startDate!, endDate: l.endDate!, note: l.note, fileId: l.fileId,
      status: autoApprove ? 'Approved' : 'Pending', decidedBy: autoApprove ? user?.name : undefined, createdAt: nowIso(),
    }, `${l.type} request`);
    setL({ type: 'Vacation', startDate: today(), endDate: today() });
  };

  return (
    <>
      <Card title="Request vacation / sick leave">
        <form onSubmit={submit}>
          <div className="grid3">
            <Field label="Type"><Select value={l.type} onChange={(v) => setL({ ...l, type: (v || 'Vacation') as LeaveType })} options={['Vacation', 'Sick Leave', 'Emergency Leave', 'Unpaid Leave']} /></Field>
            <Field label="From"><input type="date" required value={l.startDate} onChange={(e) => setL({ ...l, startDate: e.target.value })} /></Field>
            <Field label="To"><input type="date" required value={l.endDate} onChange={(e) => setL({ ...l, endDate: e.target.value })} /></Field>
          </div>
          <Field label="Note"><input value={l.note ?? ''} onChange={(e) => setL({ ...l, note: e.target.value })} /></Field>
          <Field label="Attachment (sick note, ticket…)"><FileAttach fileId={l.fileId} onChange={(fileId) => setL({ ...l, fileId })} /></Field>
          <div className="row end"><button className="btn primary">Submit</button></div>
        </form>
      </Card>
      <Card title="My requests">
        {!mine.length && <Empty>No requests.</Empty>}
        {mine.map((x) => (
          <div key={x.id} className="list-row">
            <div><b>{x.type}</b> · {fmtDate(x.startDate)} → {fmtDate(x.endDate)}<div className="muted small">{x.note}</div></div>
            <div className="row gap">
              <FileLink fileId={x.fileId} />
              <LeaveBadge s={x.status} />
              {x.status === 'Pending' && <button className="btn small ghost" onClick={() => remove('leaves', x.id)}>Cancel</button>}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
