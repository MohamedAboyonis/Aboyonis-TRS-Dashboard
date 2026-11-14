import { useState } from 'react';
import { nowIso, remove, uid, upsert, useSession, useStore } from '../lib/store';
import type { Rig, RigOperation, RigStatus } from '../lib/types';
import { fmtDate, today } from '../lib/dates';
import { Badge, Card, Empty, Field, Modal, Page, Select, confirmDelete } from '../components/ui';

const STATUSES: RigStatus[] = ['Operating', 'Rig Move', 'Standby', 'Stacked'];

export function RigStatusBadge({ status }: { status: RigStatus }) {
  const tone = status === 'Operating' ? 'good' : status === 'Rig Move' ? 'info' : status === 'Standby' ? 'warn' : 'neutral';
  const icon = status === 'Operating' ? '●' : status === 'Rig Move' ? '➜' : status === 'Standby' ? '‖' : '■';
  return <Badge tone={tone}>{icon} {status}</Badge>;
}

export default function Rigs() {
  const data = useStore();
  const { user, can } = useSession();
  const manage = can('ops.manage');
  const [editRig, setEditRig] = useState<Rig | null>(null);
  const [opFor, setOpFor] = useState<{ rig: Rig; kind: 'current' | 'next'; op?: RigOperation } | null>(null);
  const [q, setQ] = useState('');

  const save = (r: Rig) => upsert('rigs', { ...r, updatedAt: nowIso(), updatedBy: user?.name }, r.name);
  const jobLabel = (id?: string) => (id ? data.jobs.find((j) => j.id === id)?.jobNo : undefined);
  const rigs = data.rigs.filter((r) => !q || `${r.name} ${r.customer} ${r.field}`.toLowerCase().includes(q.toLowerCase()));

  const promote = (rig: Rig, op: RigOperation) => {
    const history = rig.current ? [{ ...rig.current, endedAt: today() }, ...rig.history] : rig.history;
    save({ ...rig, current: { ...op, startedAt: today() }, next: rig.next.filter((n) => n.id !== op.id), history, status: 'Operating' });
    if (op.jobId) {
      const job = data.jobs.find((j) => j.id === op.jobId);
      if (job && job.status === 'Planned') upsert('jobs', { ...job, status: 'In Progress', startDate: today() }, job.jobNo);
    }
  };

  return (
    <Page
      title="Rigs"
      subtitle="Current and next operations on every rig"
      actions={<>
        <input placeholder="Search rigs…" value={q} onChange={(e) => setQ(e.target.value)} />
        {manage && <button className="btn primary" onClick={() => setEditRig({ id: uid('rig'), name: '', status: 'Operating', next: [], history: [] })}>+ Add rig</button>}
      </>}
    >
      {!rigs.length && <Empty>No rigs yet{manage && ' — add your first rig'}.</Empty>}
      <div className="rig-grid">
        {rigs.map((r) => (
          <Card
            key={r.id}
            title={<>{r.name} <RigStatusBadge status={r.status} /></>}
            actions={manage && <button className="btn ghost" onClick={() => setEditRig(r)}>Edit</button>}
          >
            <p className="muted small">{[r.customer, r.field, r.well].filter(Boolean).join(' · ') || '—'}</p>
            <div className="op current">
              <div className="op-label">CURRENT OPERATION</div>
              {r.current ? (
                <>
                  <div className="op-desc">{r.current.description}</div>
                  <div className="muted small">Since {fmtDate(r.current.startedAt)} {jobLabel(r.current.jobId) && `· Job ${jobLabel(r.current.jobId)}`}</div>
                  {r.current.notes && <div className="small">{r.current.notes}</div>}
                </>
              ) : <div className="muted">Not set</div>}
              {manage && (
                <div className="row gap">
                  <button className="btn small" onClick={() => setOpFor({ rig: r, kind: 'current', op: r.current })}>{r.current ? 'Update' : 'Set current'}</button>
                  {r.current && <button className="btn small ghost" onClick={() => save({ ...r, current: undefined, history: [{ ...r.current!, endedAt: today() }, ...r.history] })}>Mark finished</button>}
                </div>
              )}
            </div>
            <div className="op">
              <div className="op-label">NEXT OPERATIONS</div>
              {!r.next.length && <div className="muted">None planned</div>}
              {r.next.map((n) => (
                <div key={n.id} className="op-next">
                  <div>
                    <div>{n.description}</div>
                    <div className="muted small">{fmtDate(n.plannedDate)} {jobLabel(n.jobId) && `· Job ${jobLabel(n.jobId)}`}</div>
                  </div>
                  {manage && (
                    <div className="row">
                      <button className="btn small" title="Start now (move to current)" onClick={() => promote(r, n)}>▶ Start</button>
                      <button className="btn small ghost" onClick={() => setOpFor({ rig: r, kind: 'next', op: n })}>Edit</button>
                      <button className="btn small ghost" aria-label="Remove" onClick={() => save({ ...r, next: r.next.filter((x) => x.id !== n.id) })}>✕</button>
                    </div>
                  )}
                </div>
              ))}
              {manage && <button className="btn small" onClick={() => setOpFor({ rig: r, kind: 'next' })}>+ Add next operation</button>}
            </div>
            {r.history.length > 0 && (
              <details>
                <summary className="small">History ({r.history.length})</summary>
                <ul className="small">
                  {r.history.slice(0, 15).map((h) => <li key={h.id}>{fmtDate(h.startedAt)} → {fmtDate(h.endedAt)}: {h.description}</li>)}
                </ul>
              </details>
            )}
            {r.updatedAt && <div className="muted tiny">Updated {new Date(r.updatedAt).toLocaleString()} {r.updatedBy && `by ${r.updatedBy}`}</div>}
          </Card>
        ))}
      </div>

      {editRig && <RigForm rig={editRig} onClose={() => setEditRig(null)} onSave={(r) => { save(r); setEditRig(null); }} />}
      {opFor && (
        <OpForm
          op={opFor.op}
          rigId={opFor.rig.id}
          kind={opFor.kind}
          title={opFor.kind === 'current' ? `Current operation — ${opFor.rig.name}` : `Next operation — ${opFor.rig.name}`}
          onClose={() => setOpFor(null)}
          onSave={(op) => {
            const r = opFor.rig;
            if (opFor.kind === 'current') save({ ...r, current: op });
            else save({ ...r, next: [...r.next.filter((n) => n.id !== op.id), op].sort((a, b) => (a.plannedDate ?? '').localeCompare(b.plannedDate ?? '')) });
            setOpFor(null);
          }}
        />
      )}
    </Page>
  );
}

function RigForm({ rig, onClose, onSave }: { rig: Rig; onClose: () => void; onSave: (r: Rig) => void }) {
  const data = useStore();
  const [r, setR] = useState(rig);
  const exists = data.rigs.some((x) => x.id === rig.id);
  return (
    <Modal title={exists ? `Edit ${rig.name}` : 'Add rig'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(r); }}>
        <div className="grid2">
          <Field label="Rig name / number"><input required value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
          <Field label="Status"><Select value={r.status} onChange={(v) => setR({ ...r, status: (v || 'Operating') as RigStatus })} options={STATUSES} /></Field>
          <Field label="Customer"><Select value={r.customer} onChange={(v) => setR({ ...r, customer: v })} options={data.company!.lists.customers} /></Field>
          <Field label="Field / area"><input value={r.field ?? ''} onChange={(e) => setR({ ...r, field: e.target.value })} /></Field>
          <Field label="Current well"><input value={r.well ?? ''} onChange={(e) => setR({ ...r, well: e.target.value })} /></Field>
        </div>
        <div className="row gap end">
          {exists && <button type="button" className="btn danger" onClick={() => { if (confirmDelete(rig.name)) { remove('rigs', rig.id, rig.name); onClose(); } }}>Delete</button>}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function OpForm({ op, rigId, kind, title, onClose, onSave }: { op?: RigOperation; rigId: string; kind: 'current' | 'next'; title: string; onClose: () => void; onSave: (o: RigOperation) => void }) {
  const data = useStore();
  const [o, setO] = useState<RigOperation>(op ?? { id: uid('op'), description: '', ...(kind === 'current' ? { startedAt: today() } : {}) });
  const dateKey = kind === 'current' ? 'startedAt' : 'plannedDate';
  const jobs = data.jobs.filter((j) => j.rigId === rigId && j.status !== 'Completed' && j.status !== 'Cancelled');
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(o); }}>
        <Field label="Operation description"><textarea required rows={2} value={o.description} onChange={(e) => setO({ ...o, description: e.target.value })} placeholder="e.g. Running 9 5/8in casing" /></Field>
        <div className="grid2">
          <Field label="Linked TRS job (optional)"><Select value={o.jobId} onChange={(v) => setO({ ...o, jobId: v || undefined })} options={jobs.map((j) => ({ value: j.id, label: `${j.jobNo} · ${j.serviceType ?? ''} ${j.sizes.join(', ')}` }))} placeholder="— None —" /></Field>
          <Field label={kind === 'current' ? 'Started on' : 'Planned date'}><input type="date" value={o[dateKey] ?? ''} onChange={(e) => setO({ ...o, [dateKey]: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><textarea rows={2} value={o.notes ?? ''} onChange={(e) => setO({ ...o, notes: e.target.value })} /></Field>
        <div className="row end"><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}
