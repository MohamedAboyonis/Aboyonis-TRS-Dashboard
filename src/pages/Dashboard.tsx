import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { expiryState, fmtDate, today } from '../lib/dates';
import { BarList, Badge, Card, Page, Stat } from '../components/ui';
import { RigStatusBadge } from './Rigs';

export default function Dashboard() {
  const data = useStore();
  const cur = data.company!.currency;
  const months = useMemo(() => [...new Set(data.jobs.map((j) => j.startDate.slice(0, 7)))].sort().reverse(), [data.jobs]);
  const [month, setMonth] = useState<string>('all');

  const jobs = data.jobs.filter((j) => j.status !== 'Cancelled' && (month === 'all' || j.startDate.startsWith(month)));
  const k = useMemo(() => {
    const sum = (f: (j: (typeof jobs)[number]) => number | undefined) => jobs.reduce((a, j) => a + (f(j) ?? 0), 0);
    const revenue = sum((j) => j.revenue);
    const hours = sum((j) => j.hours);
    const npt = sum((j) => j.nptHours);
    const joints = sum((j) => j.joints);
    const done = jobs.filter((j) => j.status === 'Completed').length;
    const group = (key: (j: (typeof jobs)[number]) => string | undefined, val: (j: (typeof jobs)[number]) => number) => {
      const m = new Map<string, number>();
      jobs.forEach((j) => { const g = key(j); if (g) m.set(g, (m.get(g) ?? 0) + val(j)); });
      return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    return {
      revenue, hours, npt, joints, done,
      nptPct: hours ? npt / hours : 0,
      jph: hours - npt > 0 ? joints / (hours - npt) : 0,
      byCustomer: group((j) => j.customer, (j) => j.revenue ?? 0),
      nptByCat: group((j) => (j.nptHours ? j.nptCategory ?? 'Other' : undefined), (j) => j.nptHours ?? 0),
      jobsByRig: group((j) => data.rigs.find((r) => r.id === j.rigId)?.name, () => 1),
    };
  }, [jobs, data.rigs]);

  const t = today();
  const alerts = {
    certs: data.certificates.filter((c) => ['expired', 'expiring'].includes(expiryState(c.expiryDate))).length,
    maint: data.equipment.filter((e) => {
      const last = data.maintenance.filter((m) => m.equipmentId === e.id && m.nextDue).sort((a, b) => b.date.localeCompare(a.date))[0];
      return last?.nextDue && last.nextDue <= t;
    }).length,
    eqDocs: data.equipmentDocs.filter((d) => ['expired', 'expiring'].includes(expiryState(d.expiryDate))).length,
    leaves: data.leaves.filter((l) => l.status === 'Pending').length,
    preps: data.preps.filter((p) => !['Ready', 'Dispatched', 'Returned'].includes(p.status)).length,
    hse: data.hseEvents.filter((h) => h.status === 'Open').length,
  };
  const onJob = new Set(data.assignments.filter((a) => !a.endDate && data.jobs.find((j) => j.id === a.jobId)?.status === 'In Progress').map((a) => a.employeeId));
  const money = (n: number) => `${cur} ${Math.round(n).toLocaleString()}`;

  return (
    <Page
      title="Operations Dashboard"
      subtitle={`${data.company!.name} · ${fmtDate(t)}`}
      actions={
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Period">
          <option value="all">All time</option>
          {months.map((m) => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</option>)}
        </select>
      }
    >
      <div className="stats">
        <Stat label="Revenue" value={money(k.revenue)} hint={`${jobs.length} jobs · ${k.done} completed`} />
        <Stat label="NPT %" value={`${(k.nptPct * 100).toFixed(1)}%`} hint={`${k.npt.toFixed(1)} NPT hrs of ${k.hours.toFixed(0)}`} />
        <Stat label="Joints / productive hr" value={k.jph.toFixed(2)} hint={`${k.joints.toLocaleString()} joints run`} />
        <Stat label="Avg revenue / job" value={money(jobs.length ? k.revenue / jobs.length : 0)} />
        <Stat label="Crew on location" value={onJob.size} hint={`of ${data.employees.filter((e) => e.active && e.department === 'Field').length} field staff`} />
      </div>

      <div className="alerts">
        <Link to="/hse" className={`alert ${alerts.certs ? 'warn' : ''}`}>🦺 <b>{alerts.certs}</b> certificates expired / expiring</Link>
        <Link to="/equipment" className={`alert ${alerts.maint ? 'bad' : ''}`}>⚙️ <b>{alerts.maint}</b> equipment maintenance overdue</Link>
        <Link to="/equipment" className={`alert ${alerts.eqDocs ? 'warn' : ''}`}>📄 <b>{alerts.eqDocs}</b> equipment certs expiring</Link>
        <Link to="/leaves" className={`alert ${alerts.leaves ? 'info' : ''}`}>🏖️ <b>{alerts.leaves}</b> leave requests pending</Link>
        <Link to="/workshop" className={`alert ${alerts.preps ? 'info' : ''}`}>🔧 <b>{alerts.preps}</b> preparations open</Link>
        <Link to="/hse" className={`alert ${alerts.hse ? 'warn' : ''}`}>⚠️ <b>{alerts.hse}</b> open HSE events</Link>
      </div>

      <Card title="Rig board" actions={<Link className="btn ghost" to="/rigs">Manage rigs →</Link>}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rig</th><th>Status</th><th>Current operation</th><th>Next operation</th></tr></thead>
            <tbody>
              {data.rigs.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b><div className="muted small">{r.customer} {r.field && `· ${r.field}`}</div></td>
                  <td><RigStatusBadge status={r.status} /></td>
                  <td>{r.current?.description ?? <span className="muted">—</span>}</td>
                  <td>{r.next[0] ? <>{r.next[0].description} <span className="muted small">{fmtDate(r.next[0].plannedDate)}</span></> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid3">
        <Card title={`Revenue by customer (${cur})`}><BarList rows={k.byCustomer} format={(n) => Math.round(n).toLocaleString()} /></Card>
        <Card title="NPT hours by category"><BarList rows={k.nptByCat} format={(n) => n.toFixed(1)} /></Card>
        <Card title="Jobs by rig"><BarList rows={k.jobsByRig} /></Card>
      </div>

      <Card title="Recent activity">
        <ul className="activity">
          {data.audit.slice(0, 8).map((a, i) => (
            <li key={i}><Badge>{new Date(a.at).toLocaleString()}</Badge> {a.by && <b>{a.by}</b>} {a.action}</li>
          ))}
          {!data.audit.length && <li className="muted">No activity yet</li>}
        </ul>
      </Card>
    </Page>
  );
}
