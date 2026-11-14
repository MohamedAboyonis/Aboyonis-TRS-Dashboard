import { useState } from 'react';
import { Link } from 'react-router-dom';
import { remove, uid, upsert, useSession, useStore } from '../lib/store';
import type { CertCategory, Certificate, HseEvent, HseEventType } from '../lib/types';
import { expiryState, fmtDate, today } from '../lib/dates';
import { Badge, Card, Empty, ExpiryBadge, Field, FileAttach, FileLink, Modal, Page, Select, Tabs, confirmDelete, downloadText, toCsv } from '../components/ui';
import { CertForm } from './Employees';

type Tab = 'expiry' | 'matrix' | 'reqs' | 'events';

export default function Hse() {
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('expiry');
  return (
    <Page title="Training & HSE" subtitle="Certificates, training matrix and HSE events">
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'expiry', label: 'Certificate tracker' }, { key: 'matrix', label: 'Training matrix' }, { key: 'reqs', label: 'Requirements' }, { key: 'events', label: 'HSE log' }]} />
      {tab === 'expiry' && <Expiry manage={can('hse.manage')} />}
      {tab === 'matrix' && <Matrix />}
      {tab === 'reqs' && <Requirements manage={can('hse.manage')} />}
      {tab === 'events' && <Events manage={can('hse.manage')} />}
    </Page>
  );
}

function Expiry({ manage }: { manage: boolean }) {
  const data = useStore();
  const [filter, setFilter] = useState<'attention' | 'all'>('attention');
  const [cat, setCat] = useState('');
  const [edit, setEdit] = useState<Certificate | null>(null);
  const emp = (id: string) => data.employees.find((e) => e.id === id);
  const list = data.certificates
    .filter((c) => emp(c.employeeId)?.active)
    .filter((c) => (!cat || c.category === cat) && (filter === 'all' || ['expired', 'expiring'].includes(expiryState(c.expiryDate, 60))))
    .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));
  return (
    <Card
      title={filter === 'attention' ? 'Expired or expiring within 60 days' : 'All certificates'}
      actions={<div className="row gap">
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'attention' | 'all')} aria-label="Filter"><option value="attention">Needs attention</option><option value="all">All</option></select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option><option>HSE</option><option>Technical</option><option>Identification</option></select>
        <button className="btn" onClick={() => downloadText(`certificates-${today()}.csv`, toCsv([['Emp No', 'Name', 'Category', 'Certificate', 'Number', 'Issuer', 'Issued', 'Expiry', 'Status'], ...list.map((c) => [emp(c.employeeId)?.empNo, emp(c.employeeId)?.name, c.category, c.name, c.number, c.issuer, c.issueDate, c.expiryDate, expiryState(c.expiryDate)])]))}>⬇ CSV</button>
        {manage && <button className="btn primary" onClick={() => setEdit({ id: uid('ct'), employeeId: '', category: 'HSE', name: '' })}>+ Add</button>}
      </div>}
    >
      {!list.length && <Empty>All certificates are valid 👍</Empty>}
      {list.map((c) => (
        <div key={c.id} className={`list-row ${manage ? 'click' : ''}`} onClick={() => manage && setEdit(c)}>
          <div>
            <Link to={`/employees/${c.employeeId}`} onClick={(e) => e.stopPropagation()}><b>{emp(c.employeeId)?.name}</b></Link> <span className="muted small">{emp(c.employeeId)?.empNo}</span>
            <div>{c.name} <Badge>{c.category}</Badge></div>
          </div>
          <div className="row gap" onClick={(e) => e.stopPropagation()}><ExpiryBadge date={c.expiryDate} /><FileLink fileId={c.fileId} /></div>
        </div>
      ))}
      {edit && <CertForm cert={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function Matrix() {
  const data = useStore();
  const names = [...new Set(data.trainingReqs.map((r) => r.certName))];
  const emps = data.employees.filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name));
  if (!names.length) return <Empty>Add training requirements first (Requirements tab).</Empty>;
  return (
    <Card className="flush">
      <div className="table-wrap">
        <table className="matrix">
          <thead><tr><th className="sticky">Employee</th>{names.map((n) => <th key={n}>{n}</th>)}</tr></thead>
          <tbody>
            {emps.map((e) => (
              <tr key={e.id}>
                <td className="sticky"><Link to={`/employees/${e.id}`}><b>{e.name}</b></Link><div className="muted tiny">{e.position}</div></td>
                {names.map((n) => {
                  const required = data.trainingReqs.some((r) => r.certName === n && (r.position === '*' || r.position === e.position));
                  const c = data.certificates.filter((x) => x.employeeId === e.id && x.name.toLowerCase() === n.toLowerCase()).sort((a, b) => (b.expiryDate ?? '9999').localeCompare(a.expiryDate ?? '9999'))[0];
                  const s = c ? expiryState(c.expiryDate) : null;
                  const label = !c ? (required ? '⛔ Missing' : '—') : s === 'expired' ? '⛔ Expired' : s === 'expiring' ? `⚠️ ${fmtDate(c.expiryDate)}` : '✓';
                  const cls = !c ? (required ? 'm-bad' : 'm-na') : s === 'expired' ? 'm-bad' : s === 'expiring' ? 'm-warn' : 'm-ok';
                  return <td key={n} className={`mcell ${cls}`} title={c ? `${c.name} · expires ${fmtDate(c.expiryDate)}` : required ? 'Required — not on file' : 'Not required'}>{label}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Requirements({ manage }: { manage: boolean }) {
  const data = useStore();
  const [position, setPosition] = useState('*');
  const [certName, setCertName] = useState('');
  const [category, setCategory] = useState<CertCategory>('HSE');
  return (
    <Card title="Required certificates per position">
      {manage && (
        <form className="grid-req" onSubmit={(e) => { e.preventDefault(); upsert('trainingReqs', { id: uid('tr'), position, certName: certName.trim(), category }, certName); setCertName(''); }}>
          <Select value={position} onChange={(v) => setPosition(v || '*')} options={[{ value: '*', label: 'All positions' }, ...data.company!.lists.positions]} />
          <input required placeholder="Certificate name, e.g. H2S Awareness" value={certName} onChange={(e) => setCertName(e.target.value)} />
          <Select value={category} onChange={(v) => setCategory((v || 'HSE') as CertCategory)} options={['HSE', 'Technical', 'Identification']} />
          <button className="btn primary">Add</button>
        </form>
      )}
      {data.trainingReqs.map((r) => (
        <div key={r.id} className="list-row">
          <div><b>{r.certName}</b> <Badge>{r.category}</Badge></div>
          <div className="row gap">{r.position === '*' ? 'All positions' : r.position}{manage && <button className="btn small ghost" aria-label="Remove" onClick={() => remove('trainingReqs', r.id, r.certName)}>✕</button>}</div>
        </div>
      ))}
      {!data.trainingReqs.length && <Empty>No requirements yet.</Empty>}
    </Card>
  );
}

const EVENT_TYPES: HseEventType[] = ['Observation', 'Near Miss', 'First Aid', 'Recordable', 'Toolbox Talk', 'Drill'];

function Events({ manage }: { manage: boolean }) {
  const data = useStore();
  const { user, can } = useSession();
  const [edit, setEdit] = useState<HseEvent | null>(null);
  const canReport = manage || can('field.register');
  const list = [...data.hseEvents].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card title="HSE events" actions={canReport && <button className="btn primary" onClick={() => setEdit({ id: uid('hs'), type: 'Observation', date: today(), description: '', status: 'Open', reportedBy: user?.name })}>+ Report</button>}>
      {!list.length && <Empty>No events.</Empty>}
      {list.map((h) => (
        <div key={h.id} className={`list-row ${manage ? 'click' : ''}`} onClick={() => manage && setEdit(h)}>
          <div>
            <Badge tone={h.type === 'Recordable' || h.type === 'Near Miss' ? 'bad' : h.type === 'First Aid' ? 'warn' : 'info'}>{h.type}</Badge> <b>{fmtDate(h.date)}</b> {data.rigs.find((r) => r.id === h.rigId)?.name}
            <div>{h.description}</div>
            {h.action && <div className="muted small">Action: {h.action}</div>}
            <div className="muted tiny">Reported by {h.reportedBy}</div>
          </div>
          <div className="row gap" onClick={(e) => e.stopPropagation()}><FileLink fileId={h.fileId} /><Badge tone={h.status === 'Open' ? 'warn' : 'good'}>{h.status}</Badge></div>
        </div>
      ))}
      {edit && (
        <Modal title="HSE event" onClose={() => setEdit(null)}>
          <EventForm ev={edit} onDone={() => setEdit(null)} manage={manage} />
        </Modal>
      )}
    </Card>
  );
}

function EventForm({ ev, onDone, manage }: { ev: HseEvent; onDone: () => void; manage: boolean }) {
  const data = useStore();
  const [h, setH] = useState(ev);
  const exists = data.hseEvents.some((x) => x.id === ev.id);
  return (
    <form onSubmit={(e) => { e.preventDefault(); upsert('hseEvents', h, h.type); onDone(); }}>
      <div className="grid2">
        <Field label="Type"><Select value={h.type} onChange={(v) => setH({ ...h, type: (v || 'Observation') as HseEventType })} options={EVENT_TYPES} /></Field>
        <Field label="Date"><input type="date" value={h.date} onChange={(e) => setH({ ...h, date: e.target.value })} /></Field>
        <Field label="Rig"><Select value={h.rigId} onChange={(v) => setH({ ...h, rigId: v || undefined })} options={data.rigs.map((r) => ({ value: r.id, label: r.name }))} /></Field>
        <Field label="Status"><Select value={h.status} onChange={(v) => setH({ ...h, status: (v || 'Open') as 'Open' | 'Closed' })} options={['Open', 'Closed']} /></Field>
      </div>
      <Field label="Description"><textarea required rows={3} value={h.description} onChange={(e) => setH({ ...h, description: e.target.value })} /></Field>
      <Field label="Action taken"><textarea rows={2} value={h.action ?? ''} onChange={(e) => setH({ ...h, action: e.target.value })} /></Field>
      <Field label="Photo / report"><FileAttach fileId={h.fileId} onChange={(fileId) => setH({ ...h, fileId })} /></Field>
      <div className="row gap end">
        {exists && manage && <button type="button" className="btn danger" onClick={() => { if (confirmDelete('this event')) { remove('hseEvents', h.id); onDone(); } }}>Delete</button>}
        <button className="btn primary">Save</button>
      </div>
    </form>
  );
}
