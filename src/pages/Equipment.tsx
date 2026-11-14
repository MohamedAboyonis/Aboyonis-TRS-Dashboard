import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { remove, removeWhere, uid, upsert, useSession, useStore } from '../lib/store';
import type { AppData, EquipDocKind, Equipment as Eq, EquipmentDoc, EquipmentStatus, MaintType, MaintenanceRecord } from '../lib/types';
import { addDays, expiryState, fmtDate, today } from '../lib/dates';
import { Badge, Card, Empty, ExpiryBadge, Field, FileAttach, FileLink, Modal, Page, Select, Stat, confirmDelete, downloadText, toCsv } from '../components/ui';

const STATUSES: EquipmentStatus[] = ['Available', 'On Job', 'In Maintenance', 'Quarantine', 'Retired'];
const MAINT_TYPES: MaintType[] = ['Preventive', 'Corrective', 'Inspection', 'Load Test', 'NDT', 'Calibration'];
const DOC_KINDS: EquipDocKind[] = ['Certificate', 'COC', 'Inspection Report', 'Load Test', 'NDT Report', 'Manual'];

export function nextDueOf(data: AppData, eqId: string) {
  const last = data.maintenance.filter((m) => m.equipmentId === eqId).sort((a, b) => b.date.localeCompare(a.date))[0];
  return { last, due: last?.nextDue };
}

function EqStatus({ s }: { s: EquipmentStatus }) {
  return <Badge tone={s === 'Available' ? 'good' : s === 'On Job' ? 'info' : s === 'Quarantine' ? 'bad' : s === 'In Maintenance' ? 'warn' : 'neutral'}>{s}</Badge>;
}

export default function Equipment() {
  const data = useStore();
  const { can } = useSession();
  const manage = can('equipment.manage');
  const nav = useNavigate();
  const [edit, setEdit] = useState<Eq | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const t = today();
  const rows = data.equipment
    .filter((e) => (!type || e.type === type) && (!q || `${e.assetNo} ${e.name} ${e.serialNo} ${e.location}`.toLowerCase().includes(q.toLowerCase())))
    .map((e) => ({ e, ...nextDueOf(data, e.id), docs: data.equipmentDocs.filter((d) => d.equipmentId === e.id) }));
  const overdue = rows.filter((r) => r.due && r.due < t).length;
  const dueSoon = rows.filter((r) => r.due && r.due >= t && r.due <= addDays(t, 14)).length;
  const docIssues = data.equipmentDocs.filter((d) => ['expired', 'expiring'].includes(expiryState(d.expiryDate))).length;

  return (
    <Page
      title="Equipment & Maintenance"
      subtitle="Every tool linked to its maintenance records, certificates and COC"
      actions={<>
        <input placeholder="Search asset / serial…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All types</option>{data.company!.lists.equipmentTypes.map((x) => <option key={x}>{x}</option>)}</select>
        <button className="btn" onClick={() => downloadText(`equipment-${t}.csv`, toCsv([['Asset', 'Name', 'Type', 'Serial', 'Size', 'Location', 'Status', 'Last maintenance', 'Next due', 'Documents'], ...rows.map((r) => [r.e.assetNo, r.e.name, r.e.type, r.e.serialNo, r.e.size, r.e.location, r.e.status, r.last?.date, r.due, r.docs.length])]))}>⬇ CSV</button>
        {manage && <button className="btn primary" onClick={() => setEdit({ id: uid('eq'), assetNo: '', name: '', type: '', status: 'Available' })}>+ Add equipment</button>}
      </>}
    >
      <div className="stats">
        <Stat label="Equipment" value={data.equipment.length} hint={`${data.equipment.filter((e) => e.status === 'On Job').length} on job`} />
        <Stat label="Maintenance overdue" value={overdue} hint={overdue ? '⛔ action required' : '✓ none'} />
        <Stat label="Due in 14 days" value={dueSoon} />
        <Stat label="Certs / COC expiring" value={docIssues} hint="expired or < 30 days" />
      </div>
      <div className="table-wrap card">
        <table>
          <thead><tr><th>Asset</th><th>Type / Size</th><th>Serial</th><th>Location</th><th>Status</th><th>Next maintenance</th><th>Docs</th></tr></thead>
          <tbody>
            {rows.map(({ e, due, docs }) => (
              <tr key={e.id} className="click" onClick={() => nav(`/equipment/${e.id}`)}>
                <td><b>{e.assetNo}</b><div className="muted small">{e.name}</div></td>
                <td>{e.type}<div className="muted small">{e.size}</div></td>
                <td>{e.serialNo}</td>
                <td>{e.location}</td>
                <td><EqStatus s={e.status} /></td>
                <td>{due ? <ExpiryBadge date={due} due /> : <span className="muted">—</span>}</td>
                <td>{docs.length} {docs.some((d) => expiryState(d.expiryDate) === 'expired') && <Badge tone="bad">⛔</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty>No equipment.</Empty>}
      </div>
      {edit && <EqForm eq={edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function EqForm({ eq, onClose }: { eq: Eq; onClose: () => void }) {
  const data = useStore();
  const L = data.company!.lists;
  const [e, setE] = useState(eq);
  const exists = data.equipment.some((x) => x.id === eq.id);
  return (
    <Modal title={exists ? `Edit ${eq.assetNo}` : 'Add equipment'} onClose={onClose} wide>
      <form onSubmit={(ev) => {
        ev.preventDefault();
        if (data.equipment.some((x) => x.id !== e.id && x.assetNo === e.assetNo)) return alert('Asset number already exists');
        upsert('equipment', e, e.assetNo);
        onClose();
      }}>
        <div className="grid3">
          <Field label="Asset no."><input required value={e.assetNo} onChange={(x) => setE({ ...e, assetNo: x.target.value })} /></Field>
          <Field label="Name / description"><input required value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /></Field>
          <Field label="Type"><Select required value={e.type} onChange={(v) => setE({ ...e, type: v })} options={L.equipmentTypes} /></Field>
          <Field label="Serial no."><input value={e.serialNo ?? ''} onChange={(x) => setE({ ...e, serialNo: x.target.value })} /></Field>
          <Field label="Size / range"><input value={e.size ?? ''} onChange={(x) => setE({ ...e, size: x.target.value })} /></Field>
          <Field label="Manufacturer"><input value={e.manufacturer ?? ''} onChange={(x) => setE({ ...e, manufacturer: x.target.value })} /></Field>
          <Field label="Model"><input value={e.model ?? ''} onChange={(x) => setE({ ...e, model: x.target.value })} /></Field>
          <Field label="Location"><input list="eq-locs" value={e.location ?? ''} onChange={(x) => setE({ ...e, location: x.target.value })} /><datalist id="eq-locs"><option value="Workshop" />{data.rigs.map((r) => <option key={r.id} value={r.name} />)}</datalist></Field>
          <Field label="Status"><Select value={e.status} onChange={(v) => setE({ ...e, status: (v || 'Available') as EquipmentStatus })} options={STATUSES} /></Field>
          <Field label="Maintenance interval (days)"><input type="number" value={e.maintIntervalDays ?? ''} onChange={(x) => setE({ ...e, maintIntervalDays: x.target.value ? Number(x.target.value) : undefined })} /></Field>
        </div>
        <Field label="Notes"><textarea rows={2} value={e.notes ?? ''} onChange={(x) => setE({ ...e, notes: x.target.value })} /></Field>
        <div className="row gap end">
          {exists && <button type="button" className="btn danger" onClick={() => { if (confirmDelete(`${eq.assetNo} with all its records`)) { removeWhere('maintenance', (m) => m.equipmentId === eq.id); removeWhere('equipmentDocs', (d) => d.equipmentId === eq.id); remove('equipment', eq.id, eq.assetNo); onClose(); } }}>Delete</button>}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function EquipmentDetail() {
  const { id } = useParams();
  const data = useStore();
  const { can, user } = useSession();
  const manage = can('equipment.manage');
  const [edit, setEdit] = useState(false);
  const [maint, setMaint] = useState<MaintenanceRecord | null>(null);
  const [doc, setDoc] = useState<EquipmentDoc | null>(null);
  const e = data.equipment.find((x) => x.id === id);
  if (!e) return <Page title="Not found"><Link to="/equipment">Back</Link></Page>;
  const records = data.maintenance.filter((m) => m.equipmentId === e.id).sort((a, b) => b.date.localeCompare(a.date));
  const docs = data.equipmentDocs.filter((d) => d.equipmentId === e.id);
  const preps = data.preps.filter((p) => p.equipmentIds.includes(e.id));
  const { due } = nextDueOf(data, e.id);

  return (
    <Page
      title={`${e.assetNo} — ${e.name}`}
      subtitle={`${e.type}${e.size ? ` · ${e.size}` : ''} · S/N ${e.serialNo ?? '—'}`}
      actions={<>
        <Link className="btn ghost" to="/equipment">← Equipment</Link>
        {manage && <button className="btn" onClick={() => setEdit(true)}>Edit</button>}
      </>}
    >
      <div className="stats">
        <Stat label="Status" value={<EqStatus s={e.status} />} hint={e.location} />
        <Stat label="Next maintenance" value={due ? fmtDate(due) : '—'} hint={due ? <ExpiryBadge date={due} due /> : e.maintIntervalDays ? `every ${e.maintIntervalDays} days` : undefined} />
        <Stat label="Maintenance records" value={records.length} />
        <Stat label="Certificates / COC" value={docs.length} />
      </div>
      <Card title="Certificates, COC & reports" actions={manage && <button className="btn primary" onClick={() => setDoc({ id: uid('ed'), equipmentId: e.id, kind: 'COC' })}>+ Add document</button>}>
        {!docs.length && <Empty>No documents attached.</Empty>}
        {docs.map((d) => (
          <div key={d.id} className={`list-row ${manage ? 'click' : ''}`} onClick={() => manage && setDoc(d)}>
            <div><Badge tone="info">{d.kind}</Badge> <b>{d.number ?? '—'}</b><div className="muted small">{d.issuer} {d.issueDate && `· issued ${fmtDate(d.issueDate)}`}</div></div>
            <div className="row gap" onClick={(x) => x.stopPropagation()}><ExpiryBadge date={d.expiryDate} /><FileLink fileId={d.fileId} /></div>
          </div>
        ))}
      </Card>
      <Card title="Maintenance history" actions={manage && <button className="btn primary" onClick={() => setMaint({ id: uid('mt'), equipmentId: e.id, date: today(), type: 'Preventive', description: '', performedBy: user?.name, nextDue: e.maintIntervalDays ? addDays(today(), e.maintIntervalDays) : undefined })}>+ Add record</button>}>
        {!records.length && <Empty>No maintenance recorded.</Empty>}
        <div className="timeline">
          {records.map((m) => (
            <div key={m.id} className={`tl-item ${manage ? 'click' : ''}`} onClick={() => manage && setMaint(m)}>
              <div className="tl-date">{fmtDate(m.date)}</div>
              <div>
                <Badge>{m.type}</Badge> {m.description}
                <div className="muted small">{m.performedBy} {m.cost ? `· ${data.company!.currency} ${m.cost.toLocaleString()}` : ''} {m.nextDue && `· next due ${fmtDate(m.nextDue)}`}</div>
              </div>
              <span onClick={(x) => x.stopPropagation()}><FileLink fileId={m.fileId} /></span>
            </div>
          ))}
        </div>
      </Card>
      {preps.length > 0 && (
        <Card title="Used on job preparations">
          {preps.map((p) => <div key={p.id} className="list-row"><div>Job <b>{p.jobNo}</b> · {data.rigs.find((r) => r.id === p.rigId)?.name}</div><Badge>{p.status}</Badge></div>)}
        </Card>
      )}
      {edit && <EqForm eq={e} onClose={() => setEdit(false)} />}
      {maint && <MaintForm rec={maint} eq={e} onClose={() => setMaint(null)} />}
      {doc && <DocForm d={doc} onClose={() => setDoc(null)} />}
    </Page>
  );
}

function MaintForm({ rec, eq, onClose }: { rec: MaintenanceRecord; eq: Eq; onClose: () => void }) {
  const data = useStore();
  const [m, setM] = useState(rec);
  const [setStatus, setSetStatus] = useState<EquipmentStatus | ''>('');
  const exists = data.maintenance.some((x) => x.id === rec.id);
  return (
    <Modal title="Maintenance record" onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        upsert('maintenance', m, `${eq.assetNo} ${m.type}`);
        if (setStatus) upsert('equipment', { ...eq, status: setStatus }, eq.assetNo);
        onClose();
      }}>
        <div className="grid2">
          <Field label="Date"><input type="date" required value={m.date} onChange={(e) => setM({ ...m, date: e.target.value, nextDue: eq.maintIntervalDays && !exists ? addDays(e.target.value, eq.maintIntervalDays) : m.nextDue })} /></Field>
          <Field label="Type"><Select value={m.type} onChange={(v) => setM({ ...m, type: (v || 'Preventive') as MaintType })} options={MAINT_TYPES} /></Field>
          <Field label="Performed by"><input value={m.performedBy ?? ''} onChange={(e) => setM({ ...m, performedBy: e.target.value })} /></Field>
          <Field label="Cost"><input type="number" step="any" value={m.cost ?? ''} onChange={(e) => setM({ ...m, cost: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Next due"><input type="date" value={m.nextDue ?? ''} onChange={(e) => setM({ ...m, nextDue: e.target.value || undefined })} /></Field>
          <Field label="Set equipment status"><Select value={setStatus} onChange={(v) => setSetStatus(v as EquipmentStatus | '')} options={STATUSES} placeholder="— unchanged —" /></Field>
        </div>
        <Field label="Work done"><textarea required rows={3} value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} /></Field>
        <Field label="Report / job card"><FileAttach fileId={m.fileId} onChange={(fileId) => setM({ ...m, fileId })} /></Field>
        <div className="row gap end">
          {exists && <button type="button" className="btn danger" onClick={() => { if (confirmDelete('this record')) { remove('maintenance', m.id); onClose(); } }}>Delete</button>}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function DocForm({ d: init, onClose }: { d: EquipmentDoc; onClose: () => void }) {
  const data = useStore();
  const [d, setD] = useState(init);
  const exists = data.equipmentDocs.some((x) => x.id === init.id);
  return (
    <Modal title="Certificate / COC" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); upsert('equipmentDocs', d, d.kind); onClose(); }}>
        <div className="grid2">
          <Field label="Document type"><Select value={d.kind} onChange={(v) => setD({ ...d, kind: (v || 'COC') as EquipDocKind })} options={DOC_KINDS} /></Field>
          <Field label="Number"><input value={d.number ?? ''} onChange={(e) => setD({ ...d, number: e.target.value })} /></Field>
          <Field label="Issuer"><input value={d.issuer ?? ''} onChange={(e) => setD({ ...d, issuer: e.target.value })} /></Field>
          <Field label="Issue date"><input type="date" value={d.issueDate ?? ''} onChange={(e) => setD({ ...d, issueDate: e.target.value })} /></Field>
          <Field label="Expiry date"><input type="date" value={d.expiryDate ?? ''} onChange={(e) => setD({ ...d, expiryDate: e.target.value || undefined })} /></Field>
        </div>
        <Field label="File"><FileAttach fileId={d.fileId} onChange={(fileId) => setD({ ...d, fileId })} /></Field>
        <div className="row gap end">
          {exists && <button type="button" className="btn danger" onClick={() => { if (confirmDelete('this document')) { remove('equipmentDocs', d.id); onClose(); } }}>Delete</button>}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
