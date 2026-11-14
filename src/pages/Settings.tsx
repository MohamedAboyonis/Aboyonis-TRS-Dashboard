import { useEffect, useState } from 'react';
import { set } from 'idb-keyval';
import { getData, getFile, replaceAll, remove, resetAll, setCompany, uid, upsert, useSession, useStore } from '../lib/store';
import type { AppData, Company, Employee, Permission, Role, StoredFile } from '../lib/types';
import { PERMISSION_GROUPS } from '../lib/permissions';
import { verifyLicense, type LicenseResult } from '../lib/license';
import { fmtDate, today } from '../lib/dates';
import { Badge, Card, Field, Modal, Page, Select, Tabs, confirmDelete, downloadText } from '../components/ui';
import { readImage } from './Setup';

type Tab = 'company' | 'lists' | 'roles' | 'users' | 'license' | 'data';

export default function Settings() {
  const { can } = useSession();
  const tabs = ([
    { key: 'company', label: 'Company', p: 'admin.company' },
    { key: 'lists', label: 'Drop-down lists', p: 'admin.company' },
    { key: 'roles', label: 'Roles', p: 'admin.access' },
    { key: 'users', label: 'Users & access', p: 'admin.access' },
    { key: 'license', label: 'License', p: 'admin.license' },
    { key: 'data', label: 'Data & backup', p: 'admin.data' },
  ] as { key: Tab; label: string; p: Permission }[]).filter((t) => can(t.p));
  const [tab, setTab] = useState<Tab>(tabs[0]?.key ?? 'company');
  return (
    <Page title="Settings" subtitle="White-label setup, access control and licensing">
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'company' && <CompanyTab />}
      {tab === 'lists' && <ListsTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'license' && <LicenseTab />}
      {tab === 'data' && <DataTab />}
    </Page>
  );
}

function CompanyTab() {
  const data = useStore();
  const [c, setC] = useState<Company>(data.company!);
  const [saved, setSaved] = useState(false);
  return (
    <Card title="Company profile">
      <form onSubmit={(e) => { e.preventDefault(); setCompany(c); setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
        <div className="row gap wrap">
          {c.logo ? <img src={c.logo} alt="Company logo" className="logo-preview" /> : <div className="logo-fallback big">{c.name.slice(0, 2).toUpperCase()}</div>}
          <div className="col gap">
            <input type="file" accept="image/*" onChange={async (e) => e.target.files?.[0] && setC({ ...c, logo: await readImage(e.target.files[0]) })} aria-label="Upload logo" />
            {c.logo && <button type="button" className="btn small ghost" onClick={() => setC({ ...c, logo: undefined })}>Remove logo</button>}
          </div>
        </div>
        <div className="grid3">
          <Field label="Company name"><input required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="Legal name"><input value={c.legalName ?? ''} onChange={(e) => setC({ ...c, legalName: e.target.value })} /></Field>
          <Field label="Brand color"><input type="color" value={c.primaryColor} onChange={(e) => setC({ ...c, primaryColor: e.target.value })} /></Field>
          <Field label="Country"><input value={c.country ?? ''} onChange={(e) => setC({ ...c, country: e.target.value })} /></Field>
          <Field label="Currency"><input value={c.currency} maxLength={3} onChange={(e) => setC({ ...c, currency: e.target.value.toUpperCase() })} /></Field>
          <Field label="Phone"><input value={c.phone ?? ''} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
          <Field label="Email"><input type="email" value={c.email ?? ''} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
          <Field label="Address" span><input value={c.address ?? ''} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
        </div>
        <div className="row gap end">{saved && <Badge tone="good">✓ Saved</Badge>}<button className="btn primary">Save</button></div>
      </form>
    </Card>
  );
}

const LIST_LABELS: Record<keyof Company['lists'], string> = {
  customers: 'Customers', serviceTypes: 'Service types', toolTypes: 'Tool types', sizes: 'Pipe sizes',
  nptCategories: 'NPT categories', positions: 'Positions', equipmentTypes: 'Equipment types',
};

function ListsTab() {
  const data = useStore();
  const c = data.company!;
  return (
    <div className="grid2">
      {(Object.keys(LIST_LABELS) as (keyof Company['lists'])[]).map((k) => (
        <Card key={k} title={LIST_LABELS[k]}>
          <p className="muted small">One per line</p>
          <textarea
            rows={7}
            defaultValue={c.lists[k].join('\n')}
            onBlur={(e) => setCompany({ ...getData().company!, lists: { ...getData().company!.lists, [k]: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } })}
          />
        </Card>
      ))}
    </div>
  );
}

function PermissionPicker({ value, onChange, inherited = [] }: { value: Permission[]; onChange: (p: Permission[]) => void; inherited?: Permission[] }) {
  return (
    <div className="perm-grid">
      {PERMISSION_GROUPS.map((g) => (
        <fieldset key={g.group}>
          <legend>{g.group}</legend>
          {g.items.map((i) => {
            const fromRole = inherited.includes(i.key);
            return (
              <label key={i.key} className="check">
                <input type="checkbox" disabled={fromRole} checked={fromRole || value.includes(i.key)} onChange={(e) => onChange(e.target.checked ? [...value, i.key] : value.filter((x) => x !== i.key))} />
                {i.label} {fromRole && <span className="muted tiny">(role)</span>}
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}

function RolesTab() {
  const data = useStore();
  const [edit, setEdit] = useState<Role | null>(null);
  return (
    <Card title="Roles" actions={<button className="btn primary" onClick={() => setEdit({ id: uid('role'), name: '', permissions: [] })}>+ New role</button>}>
      {data.roles.map((r) => (
        <div key={r.id} className="list-row click" onClick={() => setEdit(r)}>
          <div><b>{r.name}</b> {r.system && <Badge>system</Badge>}<div className="muted small">{r.description}</div></div>
          <div className="row gap"><Badge tone="info">{r.permissions.length} permissions</Badge><Badge>{data.employees.filter((e) => e.roleId === r.id).length} users</Badge></div>
        </div>
      ))}
      {edit && (
        <Modal title={edit.name || 'New role'} onClose={() => setEdit(null)} wide>
          <form onSubmit={(e) => { e.preventDefault(); upsert('roles', edit, edit.name); setEdit(null); }}>
            <div className="grid2">
              <Field label="Role name"><input required value={edit.name} disabled={edit.system} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Description"><input value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            </div>
            {edit.system ? <p className="muted">The Administrator role always has every permission.</p> : <PermissionPicker value={edit.permissions} onChange={(permissions) => setEdit({ ...edit, permissions })} />}
            <div className="row gap end">
              {!edit.system && data.roles.some((r) => r.id === edit.id) && (
                <button type="button" className="btn danger" onClick={() => {
                  if (data.employees.some((e) => e.roleId === edit.id)) return alert('Role is assigned to users — reassign them first');
                  if (confirmDelete(edit.name)) { remove('roles', edit.id, edit.name); setEdit(null); }
                }}>Delete</button>
              )}
              {!edit.system && <button className="btn primary">Save</button>}
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

function UsersTab() {
  const data = useStore();
  const { user } = useSession();
  const [edit, setEdit] = useState<Employee | null>(null);
  const users = data.employees.filter((e) => e.username);
  const admins = data.employees.filter((e) => e.active && e.roleId === 'role-admin' && e.username);
  return (
    <Card title="Users & access" actions={<Select value="" onChange={(id) => { const e = data.employees.find((x) => x.id === id); if (e) setEdit({ ...e, username: e.username ?? e.name.split(' ')[0].toLowerCase(), roleId: e.roleId ?? 'role-field' }); }} options={data.employees.filter((e) => !e.username).map((e) => ({ value: e.id, label: e.name }))} placeholder="+ Give app access to…" />}>
      <p className="muted small">Each user gets a role. Special people can receive extra permissions for particular tasks without changing their role.</p>
      {users.map((u) => (
        <div key={u.id} className="list-row click" onClick={() => setEdit(u)}>
          <div><b>{u.name}</b> <span className="muted small">@{u.username} · {u.empNo}</span></div>
          <div className="row gap">
            <Badge tone="info">{data.roles.find((r) => r.id === u.roleId)?.name ?? 'No role'}</Badge>
            {!!u.extraPermissions?.length && <Badge tone="warn">+{u.extraPermissions.length} extra</Badge>}
            {!u.active && <Badge tone="bad">Inactive</Badge>}
          </div>
        </div>
      ))}
      {edit && (
        <Modal title={`Access — ${edit.name}`} onClose={() => setEdit(null)} wide>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (data.employees.some((x) => x.id !== edit.id && x.username === edit.username)) return alert('Username taken');
            if (!edit.pin || edit.pin.length < 4) return alert('PIN must be 4+ digits');
            if (edit.id === user?.id && edit.roleId !== 'role-admin' && admins.length <= 1) return alert('You are the only administrator');
            upsert('employees', edit, `access ${edit.name}`);
            setEdit(null);
          }}>
            <div className="grid3">
              <Field label="Username"><input required value={edit.username ?? ''} autoCapitalize="none" onChange={(e) => setEdit({ ...edit, username: e.target.value.toLowerCase() })} /></Field>
              <Field label="PIN"><input required type="password" inputMode="numeric" value={edit.pin ?? ''} onChange={(e) => setEdit({ ...edit, pin: e.target.value })} /></Field>
              <Field label="Role"><Select required value={edit.roleId} onChange={(v) => setEdit({ ...edit, roleId: v })} options={data.roles.map((r) => ({ value: r.id, label: r.name }))} /></Field>
            </div>
            <h3>Extra permissions (special tasks)</h3>
            <PermissionPicker value={edit.extraPermissions ?? []} inherited={data.roles.find((r) => r.id === edit.roleId)?.permissions} onChange={(extraPermissions) => setEdit({ ...edit, extraPermissions })} />
            <div className="row gap end">
              {edit.username && edit.id !== user?.id && <button type="button" className="btn danger" onClick={() => { upsert('employees', { ...edit, username: undefined, pin: undefined, roleId: undefined, extraPermissions: undefined }, `revoke ${edit.name}`); setEdit(null); }}>Revoke access</button>}
              <button className="btn primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

function LicenseTab() {
  const data = useStore();
  const [key, setKey] = useState(data.company!.licenseKey ?? '');
  const [res, setRes] = useState<LicenseResult | null>(null);
  useEffect(() => { verifyLicense(data.company!.licenseKey, data.company!.name).then(setRes); }, [data.company]);
  const users = data.employees.filter((e) => e.active && e.username).length;
  return (
    <Card title="License">
      {res && (
        <div className="license-box">
          {res.state === 'valid' && <>
            <Badge tone="good">✓ Licensed</Badge>
            <dl className="dl">
              <dt>Licensed to</dt><dd>{res.payload.company}</dd>
              <dt>Plan</dt><dd>{res.payload.plan}</dd>
              <dt>Users</dt><dd>{users} / {res.payload.maxUsers} {users > res.payload.maxUsers && <Badge tone="bad">over limit</Badge>}</dd>
              <dt>Modules</dt><dd>{res.payload.modules.join(', ')}</dd>
              <dt>Expires</dt><dd>{fmtDate(res.payload.expires)} ({res.daysLeft} days)</dd>
              <dt>License ID</dt><dd className="tiny">{res.payload.licenseId}</dd>
            </dl>
          </>}
          {res.state === 'expired' && <Badge tone="bad">⛔ Expired {fmtDate(res.payload.expires)}</Badge>}
          {res.state === 'invalid' && <Badge tone="bad">⛔ Invalid: {res.reason}</Badge>}
          {res.state === 'missing' && <Badge tone="warn">⚠️ No license key — evaluation mode</Badge>}
          {res.state === 'not-configured' && <Badge>Evaluation build — vendor licensing key not configured (see README)</Badge>}
        </div>
      )}
      <Field label="License key"><textarea rows={4} value={key} onChange={(e) => setKey(e.target.value)} placeholder="TRS1.xxxxx.yyyyy" /></Field>
      <p className="muted small">The key is issued to the exact company name “{data.company!.name}”.</p>
      <div className="row end"><button className="btn primary" onClick={() => setCompany({ ...data.company!, licenseKey: key.trim() || undefined })}>Activate</button></div>
    </Card>
  );
}

function fileIdsOf(d: AppData) {
  return [...d.certificates, ...d.leaves, ...d.maintenance, ...d.equipmentDocs, ...d.hseEvents].map((x) => x.fileId).filter(Boolean) as string[];
}

function DataTab() {
  const data = useStore();
  const [busy, setBusy] = useState(false);

  const backup = async () => {
    setBusy(true);
    const files = (await Promise.all(fileIdsOf(data).map(getFile))).filter(Boolean);
    downloadText(`trs-backup-${data.company!.name.replace(/\W+/g, '_')}-${today()}.json`, JSON.stringify({ data, files }), 'application/json');
    setBusy(false);
  };

  const restore = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text()) as { data: AppData; files?: StoredFile[] };
      if (!parsed.data?.company) throw new Error('Not a TRS backup');
      if (!confirm(`Replace ALL data on this device with the backup of “${parsed.data.company.name}”?`)) return;
      await Promise.all((parsed.files ?? []).map((x) => set(`file:${x.id}`, x)));
      replaceAll(parsed.data);
    } catch (e) {
      alert(`Restore failed: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <Card title="Backup & restore">
        <p className="muted">Data is stored on this device (works offline). Back up regularly, or connect the cloud backend for multi-device sync (see README).</p>
        <div className="row gap wrap">
          <button className="btn primary" onClick={backup} disabled={busy}>{busy ? 'Preparing…' : '⬇ Download full backup'}</button>
          <label className="btn">⬆ Restore backup<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} /></label>
          <button className="btn danger" onClick={() => { if (confirm('Erase ALL company data on this device?') && confirm('Really erase everything? This cannot be undone.')) resetAll(); }}>Reset app</button>
        </div>
      </Card>
      <Card title="Audit log (last 100)">
        <ul className="activity">
          {data.audit.slice(0, 100).map((a, i) => <li key={i}><span className="muted tiny">{new Date(a.at).toLocaleString()}</span> <b>{a.by}</b> {a.action}</li>)}
        </ul>
      </Card>
    </>
  );
}
