import { useState } from 'react';
import { Link } from 'react-router-dom';
import { nowIso, remove, uid, upsert, useSession, useStore } from '../lib/store';
import type { PrepStatus, WorkshopPrep } from '../lib/types';
import { fmtDate, today } from '../lib/dates';
import { Badge, Card, Empty, Field, Modal, MultiChips, Page, Select, confirmDelete } from '../components/ui';

const STATUSES: PrepStatus[] = ['Requested', 'In Preparation', 'Ready', 'Dispatched', 'Returned'];
const DEFAULT_CHECKLIST = ['Tong / tool function test', 'Jaws & dies for size', 'Elevators & slips inspected', 'Torque gauge / torque-turn calibration valid', 'Certificates & COC packed', 'Load-out inspection'];

function PrepBadge({ s }: { s: PrepStatus }) {
  return <Badge tone={s === 'Ready' ? 'good' : s === 'Dispatched' ? 'info' : s === 'In Preparation' ? 'warn' : 'neutral'}>{s}</Badge>;
}

export default function Workshop() {
  const data = useStore();
  const { can, user } = useSession();
  const manage = can('workshop.manage');
  const [edit, setEdit] = useState<WorkshopPrep | null>(null);
  const [show, setShow] = useState<'open' | 'all'>('open');
  const list = data.preps
    .filter((p) => show === 'all' || !['Dispatched', 'Returned'].includes(p.status))
    .sort((a, b) => (a.requiredDate ?? '').localeCompare(b.requiredDate ?? ''));
  const rig = (id?: string) => data.rigs.find((r) => r.id === id)?.name ?? '—';

  return (
    <Page
      title="Workshop — Job Preparation"
      subtitle="Prepare tools and equipment per job number, rig and size(s)"
      actions={<>
        <select value={show} onChange={(e) => setShow(e.target.value as 'open' | 'all')} aria-label="Filter"><option value="open">Open</option><option value="all">All</option></select>
        {manage && <button className="btn primary" onClick={() => setEdit({ id: uid('wp'), jobNo: '', sizes: [{ size: '' }], equipmentIds: [], assignedTo: [], status: 'Requested', checklist: DEFAULT_CHECKLIST.map((text) => ({ text, done: false })), createdAt: nowIso(), createdBy: user?.name })}>+ New preparation</button>}
      </>}
    >
      {!list.length && <Empty>No preparations.</Empty>}
      <div className="rig-grid">
        {list.map((p) => {
          const done = p.checklist.filter((c) => c.done).length;
          const late = p.requiredDate && p.requiredDate < today() && !['Ready', 'Dispatched', 'Returned'].includes(p.status);
          return (
            <Card key={p.id} title={<>Job {p.jobNo} <PrepBadge s={p.status} /></>} actions={manage && <button className="btn ghost" onClick={() => setEdit(p)}>Edit</button>}>
              <div className="muted small">{rig(p.rigId)} · Required {fmtDate(p.requiredDate)} {late && <Badge tone="bad">⏰ Late</Badge>}</div>
              <table className="mini">
                <thead><tr><th>Size</th><th>Connection</th><th>Weight</th><th className="num">Qty</th></tr></thead>
                <tbody>{p.sizes.map((s, i) => <tr key={i}><td>{s.size}</td><td>{s.connection ?? '—'}</td><td>{s.weight ?? '—'}</td><td className="num">{s.qty ?? '—'}</td></tr>)}</tbody>
              </table>
              {p.equipmentIds.length > 0 && (
                <div className="small">Equipment: {p.equipmentIds.map((id) => { const e = data.equipment.find((x) => x.id === id); return e ? <Link key={id} to={`/equipment/${id}`} className="chip on">{e.assetNo}</Link> : null; })}</div>
              )}
              {p.assignedTo.length > 0 && <div className="small muted">Team: {p.assignedTo.map((id) => data.employees.find((e) => e.id === id)?.name).join(', ')}</div>}
              <div className="progress" aria-label={`${done} of ${p.checklist.length} checks`}><span style={{ width: `${p.checklist.length ? (done / p.checklist.length) * 100 : 0}%` }} /></div>
              <ul className="checklist">
                {p.checklist.map((c, i) => (
                  <li key={i}>
                    <label className="check">
                      <input type="checkbox" checked={c.done} disabled={!manage} onChange={() => upsert('preps', { ...p, checklist: p.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} />
                      {c.text}
                    </label>
                  </li>
                ))}
              </ul>
              {manage && (
                <div className="row gap wrap">
                  {STATUSES.filter((s) => s !== p.status).map((s) => <button key={s} className="btn small" onClick={() => upsert('preps', { ...p, status: s }, `Job ${p.jobNo} → ${s}`)}>{s}</button>)}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {edit && <PrepForm prep={edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function PrepForm({ prep, onClose }: { prep: WorkshopPrep; onClose: () => void }) {
  const data = useStore();
  const L = data.company!.lists;
  const [p, setP] = useState(prep);
  const [newCheck, setNewCheck] = useState('');
  const exists = data.preps.some((x) => x.id === prep.id);
  const jobs = data.jobs.filter((j) => j.status === 'Planned' || j.status === 'In Progress');

  const pickJob = (jobId: string) => {
    const j = data.jobs.find((x) => x.id === jobId);
    if (!j) return setP({ ...p, jobId: undefined });
    setP({ ...p, jobId, jobNo: j.jobNo, rigId: j.rigId, requiredDate: p.requiredDate ?? j.startDate, sizes: p.sizes.some((s) => s.size) ? p.sizes : j.sizes.map((size) => ({ size })) });
  };

  return (
    <Modal title={exists ? `Preparation — Job ${prep.jobNo}` : 'New job preparation'} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); upsert('preps', { ...p, sizes: p.sizes.filter((s) => s.size) }, `prep ${p.jobNo}`); onClose(); }}>
        <div className="grid3">
          <Field label="Pick existing job"><Select value={p.jobId} onChange={pickJob} options={jobs.map((j) => ({ value: j.id, label: `${j.jobNo} · ${data.rigs.find((r) => r.id === j.rigId)?.name ?? ''}` }))} placeholder="— or type job no. —" /></Field>
          <Field label="Job number"><input required value={p.jobNo} onChange={(e) => setP({ ...p, jobNo: e.target.value })} /></Field>
          <Field label="Rig"><Select value={p.rigId} onChange={(v) => setP({ ...p, rigId: v || undefined })} options={data.rigs.map((r) => ({ value: r.id, label: r.name }))} /></Field>
          <Field label="Required by"><input type="date" value={p.requiredDate ?? ''} onChange={(e) => setP({ ...p, requiredDate: e.target.value })} /></Field>
          <Field label="Status"><Select value={p.status} onChange={(v) => setP({ ...p, status: (v || 'Requested') as PrepStatus })} options={STATUSES} /></Field>
        </div>
        <h3>Sizes</h3>
        {p.sizes.map((s, i) => {
          const setS = (patch: Partial<typeof s>) => setP({ ...p, sizes: p.sizes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={i} className="grid-size">
              <Select value={s.size} onChange={(v) => setS({ size: v })} options={L.sizes} placeholder="Size" />
              <input placeholder="Connection (e.g. BTC, VAM TOP)" value={s.connection ?? ''} onChange={(e) => setS({ connection: e.target.value })} />
              <input placeholder="Weight / grade" value={s.weight ?? ''} onChange={(e) => setS({ weight: e.target.value })} />
              <input placeholder="Qty jts" type="number" value={s.qty ?? ''} onChange={(e) => setS({ qty: e.target.value ? Number(e.target.value) : undefined })} />
              <button type="button" className="btn ghost" aria-label="Remove size" onClick={() => setP({ ...p, sizes: p.sizes.filter((_, j) => j !== i) })}>✕</button>
            </div>
          );
        })}
        <button type="button" className="btn small" onClick={() => setP({ ...p, sizes: [...p.sizes, { size: '' }] })}>+ Add size</button>
        <h3>Equipment</h3>
        <MultiChips
          value={p.equipmentIds.map((id) => data.equipment.find((e) => e.id === id)?.assetNo ?? id)}
          onChange={(v) => setP({ ...p, equipmentIds: data.equipment.filter((e) => v.includes(e.assetNo)).map((e) => e.id) })}
          options={data.equipment.filter((e) => e.status !== 'Retired').map((e) => e.assetNo)}
        />
        <h3>Workshop team</h3>
        <MultiChips
          value={p.assignedTo.map((id) => data.employees.find((e) => e.id === id)?.name ?? id)}
          onChange={(v) => setP({ ...p, assignedTo: data.employees.filter((e) => v.includes(e.name)).map((e) => e.id) })}
          options={data.employees.filter((e) => e.active && (e.department === 'Workshop' || e.department === 'Field')).map((e) => e.name)}
        />
        <h3>Checklist</h3>
        <ul className="checklist">
          {p.checklist.map((c, i) => (
            <li key={i} className="row gap">
              <label className="check"><input type="checkbox" checked={c.done} onChange={() => setP({ ...p, checklist: p.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} /> {c.text}</label>
              <button type="button" className="btn small ghost" aria-label="Remove" onClick={() => setP({ ...p, checklist: p.checklist.filter((_, j) => j !== i) })}>✕</button>
            </li>
          ))}
        </ul>
        <div className="row gap">
          <input placeholder="Add checklist item" value={newCheck} onChange={(e) => setNewCheck(e.target.value)} />
          <button type="button" className="btn small" onClick={() => { if (newCheck.trim()) { setP({ ...p, checklist: [...p.checklist, { text: newCheck.trim(), done: false }] }); setNewCheck(''); } }}>Add</button>
        </div>
        <Field label="Notes"><textarea rows={2} value={p.notes ?? ''} onChange={(e) => setP({ ...p, notes: e.target.value })} /></Field>
        <div className="row gap end">
          {exists && <button type="button" className="btn danger" onClick={() => { if (confirmDelete('this preparation')) { remove('preps', prep.id); onClose(); } }}>Delete</button>}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}
