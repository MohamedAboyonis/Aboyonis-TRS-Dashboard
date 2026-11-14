import { useState } from 'react';
import { remove, removeWhere, uid, upsert, useSession, useStore } from '../lib/store';
import type { Job, JobStatus } from '../lib/types';
import { fmtDate, today } from '../lib/dates';
import { Badge, Empty, Field, Modal, MultiChips, Page, Select, confirmDelete, downloadText, toCsv } from '../components/ui';

const STATUSES: JobStatus[] = ['Planned', 'In Progress', 'Completed', 'Cancelled'];

export function JobStatusBadge({ s }: { s: JobStatus }) {
  return <Badge tone={s === 'In Progress' ? 'info' : s === 'Completed' ? 'good' : s === 'Cancelled' ? 'bad' : 'neutral'}>{s}</Badge>;
}

export default function Jobs() {
  const data = useStore();
  const { can } = useSession();
  const manage = can('ops.manage');
  const [edit, setEdit] = useState<Job | null>(null);
  const [status, setStatus] = useState<string>('active');
  const [q, setQ] = useState('');
  const rigName = (id?: string) => data.rigs.find((r) => r.id === id)?.name ?? '—';

  const list = data.jobs
    .filter((j) => (status === 'active' ? j.status === 'Planned' || j.status === 'In Progress' : status === 'all' || j.status === status))
    .filter((j) => !q || `${j.jobNo} ${j.customer} ${j.well} ${rigName(j.rigId)} ${j.serviceType}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const exportCsv = () =>
    downloadText(`jobs-${today()}.csv`, toCsv([
      ['Job No', 'Date', 'End', 'Customer', 'Rig', 'Well', 'Service', 'Tool', 'Sizes', 'Status', 'Revenue', 'Job Hrs', 'Joints', 'NPT Hrs', 'NPT Category', 'Crew'],
      ...list.map((j) => [j.jobNo, j.startDate, j.endDate, j.customer, rigName(j.rigId), j.well, j.serviceType, j.toolType, j.sizes.join(' / '), j.status, j.revenue, j.hours, j.joints, j.nptHours, j.nptCategory,
        data.assignments.filter((a) => a.jobId === j.id).map((a) => data.employees.find((e) => e.id === a.employeeId)?.name).join('; ')]),
    ]));

  return (
    <Page
      title="Jobs"
      subtitle="Job register (replaces the Excel daily log) — KPIs feed the dashboard"
      actions={<>
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="active">Active</option>
          <option value="all">All</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn" onClick={exportCsv}>⬇ CSV</button>
        {manage && <button className="btn primary" onClick={() => setEdit({ id: uid('job'), jobNo: nextJobNo(data.jobs), sizes: [], startDate: today(), status: 'Planned' })}>+ New job</button>}
      </>}
    >
      {!list.length ? <Empty>No jobs match.</Empty> : (
        <div className="table-wrap card">
          <table>
            <thead><tr><th>Job</th><th>Date</th><th>Rig / Well</th><th>Customer</th><th>Service</th><th>Sizes</th><th>Crew</th><th>Status</th><th className="num">Revenue</th><th className="num">NPT</th></tr></thead>
            <tbody>
              {list.map((j) => {
                const crew = data.assignments.filter((a) => a.jobId === j.id);
                return (
                  <tr key={j.id} className={manage ? 'click' : ''} onClick={() => manage && setEdit(j)}>
                    <td><b>{j.jobNo}</b></td>
                    <td>{fmtDate(j.startDate)}</td>
                    <td>{rigName(j.rigId)}<div className="muted small">{j.well}</div></td>
                    <td>{j.customer}</td>
                    <td>{j.serviceType}<div className="muted small">{j.toolType}</div></td>
                    <td>{j.sizes.join(', ')}</td>
                    <td>{crew.length || '—'}</td>
                    <td><JobStatusBadge s={j.status} /></td>
                    <td className="num">{j.revenue?.toLocaleString() ?? '—'}</td>
                    <td className="num">{j.nptHours ? `${j.nptHours}h` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <JobForm job={edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function nextJobNo(jobs: Job[]) {
  const yy = String(new Date().getFullYear()).slice(2);
  const n = jobs.filter((j) => j.jobNo.startsWith(`J-${yy}`)).length + 1;
  return `J-${yy}${String(n).padStart(4, '0')}`;
}

function JobForm({ job, onClose }: { job: Job; onClose: () => void }) {
  const data = useStore();
  const L = data.company!.lists;
  const [j, setJ] = useState(job);
  const exists = data.jobs.some((x) => x.id === job.id);
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const crew = data.assignments.filter((a) => a.jobId === job.id);

  return (
    <Modal title={exists ? `Job ${job.jobNo}` : 'New job'} onClose={onClose} wide>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (data.jobs.some((x) => x.jobNo === j.jobNo && x.id !== j.id)) return alert('Job number already exists');
        upsert('jobs', { ...j, endDate: j.status === 'Completed' && !j.endDate ? today() : j.endDate }, j.jobNo);
        onClose();
      }}>
        <div className="grid3">
          <Field label="Job number"><input required value={j.jobNo} onChange={(e) => setJ({ ...j, jobNo: e.target.value })} /></Field>
          <Field label="Status"><Select value={j.status} onChange={(v) => setJ({ ...j, status: (v || 'Planned') as JobStatus })} options={STATUSES} /></Field>
          <Field label="Rig"><Select value={j.rigId} onChange={(v) => { const r = data.rigs.find((x) => x.id === v); setJ({ ...j, rigId: v || undefined, customer: j.customer ?? r?.customer, well: j.well ?? r?.well }); }} options={data.rigs.map((r) => ({ value: r.id, label: r.name }))} /></Field>
          <Field label="Customer"><Select value={j.customer} onChange={(v) => setJ({ ...j, customer: v })} options={L.customers} /></Field>
          <Field label="Well"><input value={j.well ?? ''} onChange={(e) => setJ({ ...j, well: e.target.value })} /></Field>
          <Field label="Service type"><Select value={j.serviceType} onChange={(v) => setJ({ ...j, serviceType: v })} options={L.serviceTypes} /></Field>
          <Field label="Tool type"><Select value={j.toolType} onChange={(v) => setJ({ ...j, toolType: v })} options={L.toolTypes} /></Field>
          <Field label="Start date"><input type="date" required value={j.startDate} onChange={(e) => setJ({ ...j, startDate: e.target.value })} /></Field>
          <Field label="End date"><input type="date" value={j.endDate ?? ''} onChange={(e) => setJ({ ...j, endDate: e.target.value || undefined })} /></Field>
        </div>
        <Field label="Sizes (one or more)"><MultiChips value={j.sizes} onChange={(sizes) => setJ({ ...j, sizes })} options={L.sizes} /></Field>
        <h3>Job results</h3>
        <div className="grid3">
          <Field label={`Revenue (${data.company!.currency})`}><input type="number" step="any" value={j.revenue ?? ''} onChange={(e) => setJ({ ...j, revenue: num(e.target.value) })} /></Field>
          <Field label="Job hours"><input type="number" step="any" value={j.hours ?? ''} onChange={(e) => setJ({ ...j, hours: num(e.target.value) })} /></Field>
          <Field label="Joints run"><input type="number" value={j.joints ?? ''} onChange={(e) => setJ({ ...j, joints: num(e.target.value) })} /></Field>
          <Field label="NPT hours"><input type="number" step="any" value={j.nptHours ?? ''} onChange={(e) => setJ({ ...j, nptHours: num(e.target.value) })} /></Field>
          <Field label="NPT category"><Select value={j.nptCategory} onChange={(v) => setJ({ ...j, nptCategory: v || undefined })} options={L.nptCategories} /></Field>
        </div>
        <Field label="Notes"><textarea rows={2} value={j.notes ?? ''} onChange={(e) => setJ({ ...j, notes: e.target.value })} /></Field>
        {exists && (
          <p className="small muted">Crew registered: {crew.length ? crew.map((a) => `${data.employees.find((e) => e.id === a.employeeId)?.name} (${fmtDate(a.startDate)}→${a.endDate ? fmtDate(a.endDate) : 'on job'})`).join(', ') : 'none'}</p>
        )}
        <div className="row gap end">
          {exists && <button type="button" className="btn danger" onClick={() => { if (confirmDelete(`job ${job.jobNo} and its crew registrations`)) { removeWhere('assignments', (a) => a.jobId === job.id); remove('jobs', job.id, job.jobNo); onClose(); } }}>Delete</button>}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
