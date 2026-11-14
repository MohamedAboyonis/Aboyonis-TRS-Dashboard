import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { remove, uid, upsert, useSession, useStore } from '../lib/store';
import type { CertCategory, Certificate, Department, Employee } from '../lib/types';
import { expiryState, fmtDate, today } from '../lib/dates';
import { Badge, Card, Empty, ExpiryBadge, Field, FileAttach, FileLink, Modal, Page, Select, confirmDelete } from '../components/ui';
import { MonthCalendar, MonthPicker } from './MyWork';
import { readImage } from './Setup';

export const DEPARTMENTS: Department[] = ['Operations', 'Field', 'Workshop', 'HSE', 'Training', 'Management', 'Admin'];

export function certStatusCount(certs: Certificate[]) {
  const bad = certs.filter((c) => expiryState(c.expiryDate) === 'expired').length;
  const warn = certs.filter((c) => expiryState(c.expiryDate) === 'expiring').length;
  return { bad, warn };
}

export default function Employees() {
  const data = useStore();
  const { can } = useSession();
  const manage = can('employees.manage');
  const [edit, setEdit] = useState<Employee | null>(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const nav = useNavigate();
  const list = data.employees
    .filter((e) => (!dept || e.department === dept) && (!q || `${e.name} ${e.empNo} ${e.position} ${e.nationalId}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <Page
      title="People"
      subtitle="Technicians linked to their HSE, technical certificates and identification"
      actions={<>
        <input placeholder="Search name / ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
        {manage && <button className="btn primary" onClick={() => setEdit({ id: uid('emp'), empNo: '', name: '', position: '', department: 'Field', active: true })}>+ Add employee</button>}
      </>}
    >
      <div className="table-wrap card">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Position</th><th>Department</th><th>Certificates</th><th>App access</th></tr></thead>
          <tbody>
            {list.map((e) => {
              const certs = data.certificates.filter((c) => c.employeeId === e.id);
              const s = certStatusCount(certs);
              return (
                <tr key={e.id} className={`click ${e.active ? '' : 'inactive'}`} onClick={() => nav(`/employees/${e.id}`)}>
                  <td>{e.empNo}</td>
                  <td><b>{e.name}</b>{!e.active && <Badge>Inactive</Badge>}</td>
                  <td>{e.position}</td>
                  <td>{e.department}</td>
                  <td>{certs.length} {s.bad > 0 && <Badge tone="bad">⛔ {s.bad}</Badge>} {s.warn > 0 && <Badge tone="warn">⚠️ {s.warn}</Badge>}</td>
                  <td>{e.username ? <Badge tone="info">{data.roles.find((r) => r.id === e.roleId)?.name ?? 'No role'}</Badge> : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <Empty>No employees.</Empty>}
      </div>
      {edit && <EmployeeForm emp={edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

export function EmployeeForm({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const data = useStore();
  const { can } = useSession();
  const access = can('admin.access');
  const [e, setE] = useState(emp);
  const exists = data.employees.some((x) => x.id === emp.id);
  return (
    <Modal title={exists ? `Edit ${emp.name}` : 'Add employee'} onClose={onClose} wide>
      <form onSubmit={(ev) => {
        ev.preventDefault();
        if (data.employees.some((x) => x.id !== e.id && x.empNo === e.empNo)) return alert('Employee ID already used');
        if (e.username && data.employees.some((x) => x.id !== e.id && x.username === e.username)) return alert('Username already used');
        upsert('employees', e, e.name);
        onClose();
      }}>
        <div className="grid3">
          <Field label="Employee ID"><input required value={e.empNo} onChange={(x) => setE({ ...e, empNo: x.target.value })} /></Field>
          <Field label="Full name"><input required value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
          <Field label="Position"><Select value={e.position} onChange={(v) => setE({ ...e, position: v })} options={data.company!.lists.positions} required /></Field>
          <Field label="Department"><Select value={e.department} onChange={(v) => setE({ ...e, department: (v || 'Field') as Department })} options={DEPARTMENTS} /></Field>
          <Field label="National ID / Iqama"><input value={e.nationalId ?? ''} onChange={(x) => setE({ ...e, nationalId: x.target.value })} /></Field>
          <Field label="Passport no."><input value={e.passportNo ?? ''} onChange={(x) => setE({ ...e, passportNo: x.target.value })} /></Field>
          <Field label="Phone"><input type="tel" value={e.phone ?? ''} onChange={(x) => setE({ ...e, phone: x.target.value })} /></Field>
          <Field label="Email"><input type="email" value={e.email ?? ''} onChange={(x) => setE({ ...e, email: x.target.value })} /></Field>
          <Field label="Join date"><input type="date" value={e.joinDate ?? ''} onChange={(x) => setE({ ...e, joinDate: x.target.value })} /></Field>
          <Field label="Photo"><input type="file" accept="image/*" onChange={async (x) => x.target.files?.[0] && setE({ ...e, photo: await readImage(x.target.files[0], 160) })} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={e.active} onChange={(x) => setE({ ...e, active: x.target.checked })} /> Active</label>
        {access && (
          <>
            <h3>App login</h3>
            <div className="grid3">
              <Field label="Username"><input value={e.username ?? ''} autoCapitalize="none" onChange={(x) => setE({ ...e, username: x.target.value.toLowerCase() || undefined })} /></Field>
              <Field label="PIN"><input type="password" inputMode="numeric" value={e.pin ?? ''} onChange={(x) => setE({ ...e, pin: x.target.value || undefined })} /></Field>
              <Field label="Role"><Select value={e.roleId} onChange={(v) => setE({ ...e, roleId: v || undefined })} options={data.roles.map((r) => ({ value: r.id, label: r.name }))} /></Field>
            </div>
            <p className="muted small">Extra permissions for special tasks can be granted in Settings → Users & access.</p>
          </>
        )}
        <div className="row gap end">
          {exists && access && <button type="button" className="btn danger" onClick={() => { if (confirmDelete(emp.name)) { remove('employees', emp.id, emp.name); onClose(); } }}>Delete</button>}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function CertForm({ cert, onClose }: { cert: Certificate; onClose: () => void }) {
  const data = useStore();
  const [c, setC] = useState(cert);
  const exists = data.certificates.some((x) => x.id === cert.id);
  const suggestions = [...new Set([...data.trainingReqs.map((r) => r.certName), ...data.certificates.map((x) => x.name)])];
  return (
    <Modal title={exists ? 'Edit certificate' : 'Add certificate / ID'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); upsert('certificates', c, c.name); onClose(); }}>
        <div className="grid2">
          <Field label="Employee"><Select value={c.employeeId} required onChange={(v) => setC({ ...c, employeeId: v })} options={data.employees.map((e) => ({ value: e.id, label: `${e.empNo} · ${e.name}` }))} /></Field>
          <Field label="Category"><Select value={c.category} onChange={(v) => setC({ ...c, category: (v || 'HSE') as CertCategory })} options={['HSE', 'Technical', 'Identification']} /></Field>
          <Field label="Certificate / document name" span>
            <input required list="cert-names" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
            <datalist id="cert-names">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Number"><input value={c.number ?? ''} onChange={(e) => setC({ ...c, number: e.target.value })} /></Field>
          <Field label="Issuer"><input value={c.issuer ?? ''} onChange={(e) => setC({ ...c, issuer: e.target.value })} /></Field>
          <Field label="Issue date"><input type="date" value={c.issueDate ?? ''} onChange={(e) => setC({ ...c, issueDate: e.target.value })} /></Field>
          <Field label="Expiry date"><input type="date" value={c.expiryDate ?? ''} onChange={(e) => setC({ ...c, expiryDate: e.target.value || undefined })} /></Field>
        </div>
        <Field label="Scan / PDF"><FileAttach fileId={c.fileId} onChange={(fileId) => setC({ ...c, fileId })} /></Field>
        <div className="row gap end">
          {exists && <button type="button" className="btn danger" onClick={() => { if (confirmDelete(c.name)) { remove('certificates', c.id, c.name); onClose(); } }}>Delete</button>}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function EmployeeDetail() {
  const { id } = useParams();
  const data = useStore();
  const { can } = useSession();
  const [edit, setEdit] = useState(false);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const e = data.employees.find((x) => x.id === id);
  if (!e) return <Page title="Not found"><Link to="/employees">Back</Link></Page>;
  const certs = data.certificates.filter((c) => c.employeeId === e.id);
  const required = data.trainingReqs.filter((r) => r.position === '*' || r.position === e.position);
  const missing = required.filter((r) => !certs.some((c) => c.name.toLowerCase() === r.certName.toLowerCase() && expiryState(c.expiryDate) !== 'expired'));
  const jobs = data.assignments.filter((a) => a.employeeId === e.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const manageCerts = can('hse.manage');

  return (
    <Page
      title={e.name}
      subtitle={`${e.empNo} · ${e.position} · ${e.department}`}
      actions={<>
        <Link className="btn ghost" to="/employees">← People</Link>
        {can('employees.manage') && <button className="btn" onClick={() => setEdit(true)}>Edit profile</button>}
      </>}
    >
      <div className="grid2">
        <Card title="Identification">
          <div className="row gap">
            {e.photo && <img src={e.photo} alt="" className="avatar" />}
            <dl className="dl">
              <dt>Employee ID</dt><dd>{e.empNo}</dd>
              <dt>National ID / Iqama</dt><dd>{e.nationalId ?? '—'}</dd>
              <dt>Passport</dt><dd>{e.passportNo ?? '—'}</dd>
              <dt>Phone</dt><dd>{e.phone ?? '—'}</dd>
              <dt>Joined</dt><dd>{fmtDate(e.joinDate)}</dd>
            </dl>
          </div>
        </Card>
        <Card title="Training compliance">
          {!required.length ? <Empty>No training requirements for this position.</Empty> : (
            <>
              <p>{required.length - missing.length} / {required.length} required certificates valid</p>
              {missing.map((m) => <div key={m.id}><Badge tone="bad">⛔ Missing / expired: {m.certName}</Badge></div>)}
            </>
          )}
        </Card>
      </div>
      <Card title="Certificates & documents" actions={manageCerts && <button className="btn primary" onClick={() => setCert({ id: uid('ct'), employeeId: e.id, category: 'HSE', name: '' })}>+ Add</button>}>
        {(['Identification', 'HSE', 'Technical'] as CertCategory[]).map((cat) => {
          const items = certs.filter((c) => c.category === cat);
          return (
            <div key={cat}>
              <h3>{cat}</h3>
              {!items.length && <p className="muted small">None</p>}
              {items.map((c) => (
                <div key={c.id} className={`list-row ${manageCerts ? 'click' : ''}`} onClick={() => manageCerts && setCert(c)}>
                  <div><b>{c.name}</b><div className="muted small">{[c.number, c.issuer, c.issueDate && `issued ${fmtDate(c.issueDate)}`].filter(Boolean).join(' · ')}</div></div>
                  <div className="row gap" onClick={(ev) => ev.stopPropagation()}><ExpiryBadge date={c.expiryDate} /><FileLink fileId={c.fileId} /></div>
                </div>
              ))}
            </div>
          );
        })}
      </Card>
      <div className="grid2">
        <Card title="Timesheet" actions={<MonthPicker value={month} onChange={setMonth} />}><MonthCalendar employeeId={e.id} month={month} /></Card>
        <Card title="Job history">
          {!jobs.length && <Empty>No jobs.</Empty>}
          {jobs.slice(0, 20).map((a) => {
            const j = data.jobs.find((x) => x.id === a.jobId);
            return <div key={a.id} className="list-row"><div><b>{j?.jobNo}</b> · {data.rigs.find((r) => r.id === j?.rigId)?.name} <span className="muted small">{a.crewRole}</span></div><div className="small">{fmtDate(a.startDate)} → {a.endDate ? fmtDate(a.endDate) : 'on job'}</div></div>;
          })}
        </Card>
      </div>
      {edit && <EmployeeForm emp={e} onClose={() => setEdit(false)} />}
      {cert && <CertForm cert={cert} onClose={() => setCert(null)} />}
    </Page>
  );
}
