import { useState } from 'react';
import { upsert, useSession, useStore } from '../lib/store';
import { daysBetween, fmtDate } from '../lib/dates';
import { Card, Empty, FileLink, Page, Tabs } from '../components/ui';
import { LeaveBadge } from './MyWork';

export default function Leaves() {
  const data = useStore();
  const { can, user } = useSession();
  const approve = can('leave.approve');
  const [tab, setTab] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const list = data.leaves.filter((l) => l.status === tab).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const name = (id: string) => data.employees.find((e) => e.id === id);

  return (
    <Page title="Vacation & Sick Leave" subtitle="Approved leave appears automatically on the timesheet">
      <Tabs value={tab} onChange={setTab} tabs={(['Pending', 'Approved', 'Rejected'] as const).map((k) => ({ key: k, label: `${k} (${data.leaves.filter((l) => l.status === k).length})` }))} />
      <Card>
        {!list.length && <Empty>Nothing here.</Empty>}
        {list.map((l) => {
          const e = name(l.employeeId);
          return (
            <div key={l.id} className="list-row">
              <div>
                <b>{e?.name}</b> <span className="muted small">{e?.empNo} · {e?.position}</span>
                <div>{l.type}: {fmtDate(l.startDate)} → {fmtDate(l.endDate)} <span className="muted">({daysBetween(l.startDate, l.endDate) + 1} days)</span></div>
                {l.note && <div className="muted small">{l.note}</div>}
                {l.decidedBy && <div className="muted tiny">by {l.decidedBy}</div>}
              </div>
              <div className="row gap">
                <FileLink fileId={l.fileId} />
                <LeaveBadge s={l.status} />
                {approve && l.status !== 'Approved' && <button className="btn small primary" onClick={() => upsert('leaves', { ...l, status: 'Approved', decidedBy: user?.name }, `approve ${l.type} ${e?.name}`)}>Approve</button>}
                {approve && l.status !== 'Rejected' && <button className="btn small danger" onClick={() => upsert('leaves', { ...l, status: 'Rejected', decidedBy: user?.name }, `reject ${l.type} ${e?.name}`)}>Reject</button>}
              </div>
            </div>
          );
        })}
      </Card>
    </Page>
  );
}
