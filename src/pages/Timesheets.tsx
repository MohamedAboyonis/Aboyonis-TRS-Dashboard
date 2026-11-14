import { useMemo, useState } from 'react';
import { nowIso, remove, removeWhere, uid, upsertMany, useSession, useStore } from '../lib/store';
import type { DayCode, Department, ISODate } from '../lib/types';
import { addDays, fmtDate, monthDays, parseISO, today } from '../lib/dates';
import { DAY_CODES, OVERRIDE_CODES, buildIndex, summarize } from '../lib/timesheet';
import { Card, Field, Modal, Page, Select, downloadText, toCsv } from '../components/ui';
import { MonthPicker } from './MyWork';

export default function Timesheets() {
  const data = useStore();
  const { can, user } = useSession();
  const manage = can('timesheet.manage');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [dept, setDept] = useState<string>('Field');
  const [edit, setEdit] = useState<{ employeeId: string; date: ISODate } | null>(null);
  const [bulk, setBulk] = useState(false);
  const cell = useMemo(() => buildIndex(data), [data]);
  const [y, m] = month.split('-').map(Number);
  const days = monthDays(y, m - 1);
  const emps = data.employees.filter((e) => e.active && (!dept || e.department === dept)).sort((a, b) => a.name.localeCompare(b.name));
  const depts = [...new Set(data.employees.map((e) => e.department))] as Department[];

  const exportCsv = () => {
    const codes = Object.keys(DAY_CODES).filter((c) => c !== 'X') as DayCode[];
    const rows = emps.map((e) => {
      const cells = days.map((d) => cell(e.id, d));
      const s = summarize(cells);
      return [e.empNo, e.name, e.position, ...cells.map((c) => (c.source === 'pending-leave' || c.code === 'X' ? '' : c.code ?? '')), s.worked, ...codes.map((c) => s.counts[c] ?? 0)];
    });
    downloadText(`timesheet-${month}-${dept || 'all'}.csv`, toCsv([['Emp No', 'Name', 'Position', ...days.map((d) => d.slice(8)), 'Worked', ...codes.map((c) => DAY_CODES[c].label)], ...rows]));
  };

  return (
    <Page
      title="Timesheets"
      subtitle={manage ? 'Auto-generated from job registrations & leave. Tap a day to add / remove safety day, absent, workshop day…' : 'Auto-generated from job registrations & leave'}
      actions={<>
        <MonthPicker value={month} onChange={setMonth} />
        <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {depts.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className="btn" onClick={exportCsv}>⬇ CSV</button>
        {manage && <button className="btn primary" onClick={() => setBulk(true)}>Bulk mark</button>}
      </>}
    >
      <div className="legend">
        {(Object.keys(DAY_CODES) as DayCode[]).filter((c) => c !== 'X').map((c) => (
          <span key={c}><span className="code" style={{ background: DAY_CODES[c].color }}>{c}</span> {DAY_CODES[c].label}</span>
        ))}
        <span><span className="code pending-sample">V</span> pending leave</span>
        <span>✎ = edited by operations</span>
      </div>
      <Card className="flush">
        <div className="table-wrap ts-wrap">
          <table className="ts">
            <thead>
              <tr>
                <th className="sticky">Employee</th>
                {days.map((d) => {
                  const wd = parseISO(d).getDay();
                  return <th key={d} className={`${wd === 5 || wd === 6 ? 'we' : ''} ${d === today() ? 'today' : ''}`}>{Number(d.slice(8))}<div className="tiny">{'SMTWTFS'[wd]}</div></th>;
                })}
                <th>Worked</th>
              </tr>
            </thead>
            <tbody>
              {emps.map((e) => {
                const cells = days.map((d) => cell(e.id, d));
                return (
                  <tr key={e.id}>
                    <td className="sticky"><b>{e.name}</b><div className="muted tiny">{e.empNo} · {e.position}</div></td>
                    {cells.map((c, i) => {
                      const meta = c.code && c.code !== 'X' ? DAY_CODES[c.code] : null;
                      return (
                        <td key={days[i]} className={`tc ${manage ? 'click' : ''}`} title={`${fmtDate(days[i])}: ${c.detail ?? 'No record'}`} onClick={() => manage && setEdit({ employeeId: e.id, date: days[i] })}>
                          {meta && <span className={`code ${c.source === 'pending-leave' ? 'pending' : ''}`} style={{ background: c.source === 'pending-leave' ? undefined : meta.color }}>{c.code}</span>}
                          {c.source === 'override' && <span className="edited">✎</span>}
                        </td>
                      );
                    })}
                    <td className="num"><b>{summarize(cells).worked}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {edit && (
        <DayEditor
          {...edit}
          onClose={() => setEdit(null)}
          by={user?.name}
          detail={cell(edit.employeeId, edit.date)}
        />
      )}
      {bulk && <BulkMark onClose={() => setBulk(false)} by={user?.name} defaultDept={dept} />}
    </Page>
  );
}

function DayEditor({ employeeId, date, onClose, by, detail }: { employeeId: string; date: ISODate; onClose: () => void; by?: string; detail: ReturnType<ReturnType<typeof buildIndex>> }) {
  const data = useStore();
  const emp = data.employees.find((e) => e.id === employeeId)!;
  const [note, setNote] = useState('');
  const set = (code: DayCode) => {
    removeWhere('overrides', (o) => o.employeeId === employeeId && o.date === date);
    upsertMany('overrides', [{ id: uid('ov'), employeeId, date, code, note: note || undefined, by, at: nowIso() }]);
    onClose();
  };
  return (
    <Modal title={`${emp.name} — ${fmtDate(date)}`} onClose={onClose}>
      <p>Currently: <b>{detail.detail ?? 'No record'}</b> {detail.source && <span className="muted">({detail.source === 'override' ? 'set by operations' : `from ${detail.source}`})</span>}</p>
      <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="code-grid">
        {OVERRIDE_CODES.map((c) => (
          <button key={c} className="btn" onClick={() => set(c)}>
            {c !== 'X' && <span className="code" style={{ background: DAY_CODES[c].color }}>{c}</span>} {DAY_CODES[c].label}
          </button>
        ))}
      </div>
      {detail.overrideId && (
        <div className="row end">
          <button className="btn danger" onClick={() => { remove('overrides', detail.overrideId!); onClose(); }}>Undo edit (back to automatic)</button>
        </div>
      )}
    </Modal>
  );
}

function BulkMark({ onClose, by, defaultDept }: { onClose: () => void; by?: string; defaultDept: string }) {
  const data = useStore();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [code, setCode] = useState<DayCode>('S');
  const [note, setNote] = useState('');
  const [ids, setIds] = useState<string[]>(data.employees.filter((e) => e.active && (!defaultDept || e.department === defaultDept)).map((e) => e.id));

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (to < from) return alert('End before start');
    const dates: ISODate[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
    const set = new Set(ids);
    removeWhere('overrides', (o) => set.has(o.employeeId) && dates.includes(o.date));
    upsertMany('overrides', ids.flatMap((employeeId) => dates.map((date) => ({ id: uid('ov'), employeeId, date, code, note: note || undefined, by, at: nowIso() }))));
    onClose();
  };

  return (
    <Modal title="Bulk mark days" onClose={onClose} wide>
      <form onSubmit={apply}>
        <div className="grid3">
          <Field label="Day type"><Select value={code} onChange={(v) => setCode((v || 'S') as DayCode)} options={OVERRIDE_CODES.map((c) => ({ value: c, label: `${c} — ${DAY_CODES[c].label}` }))} /></Field>
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Quarterly safety stand-down" /></Field>
        <div className="row gap"><b>Employees ({ids.length})</b>
          <button type="button" className="btn small ghost" onClick={() => setIds(data.employees.filter((e) => e.active).map((e) => e.id))}>All</button>
          <button type="button" className="btn small ghost" onClick={() => setIds([])}>None</button>
        </div>
        <div className="check-grid">
          {data.employees.filter((e) => e.active).map((e) => (
            <label key={e.id} className="check">
              <input type="checkbox" checked={ids.includes(e.id)} onChange={(ev) => setIds(ev.target.checked ? [...ids, e.id] : ids.filter((x) => x !== e.id))} />
              {e.name} <span className="muted tiny">{e.department}</span>
            </label>
          ))}
        </div>
        <div className="row end"><button className="btn primary" disabled={!ids.length}>Apply</button></div>
      </form>
    </Modal>
  );
}
