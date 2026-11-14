import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { logout, useLoaded, useSession, useStore } from './lib/store';
import type { Permission } from './lib/types';
import { verifyLicense, type LicenseResult } from './lib/license';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rigs from './pages/Rigs';
import Jobs from './pages/Jobs';
import MyWork from './pages/MyWork';
import Timesheets from './pages/Timesheets';
import Leaves from './pages/Leaves';
import Workshop from './pages/Workshop';
import Employees, { EmployeeDetail } from './pages/Employees';
import Hse from './pages/Hse';
import Equipment, { EquipmentDetail } from './pages/Equipment';
import Settings from './pages/Settings';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  perm?: Permission | Permission[];
  el: ReactNode;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', perm: 'dashboard.view', el: <Dashboard /> },
  { to: '/my', label: 'My Work', icon: '🧑‍🔧', perm: 'field.register', el: <MyWork /> },
  { to: '/rigs', label: 'Rigs', icon: '🛢️', perm: 'ops.view', el: <Rigs /> },
  { to: '/jobs', label: 'Jobs', icon: '📋', perm: 'ops.view', el: <Jobs /> },
  { to: '/timesheets', label: 'Timesheets', icon: '🗓️', perm: ['timesheet.viewAll', 'timesheet.manage'], el: <Timesheets /> },
  { to: '/leaves', label: 'Leave', icon: '🏖️', perm: ['leave.approve', 'timesheet.viewAll'], el: <Leaves /> },
  { to: '/workshop', label: 'Workshop', icon: '🔧', perm: 'workshop.view', el: <Workshop /> },
  { to: '/hse', label: 'Training & HSE', icon: '🦺', perm: 'hse.view', el: <Hse /> },
  { to: '/equipment', label: 'Equipment', icon: '⚙️', perm: 'equipment.view', el: <Equipment /> },
  { to: '/employees', label: 'People', icon: '👥', perm: ['employees.view', 'employees.manage'], el: <Employees /> },
  { to: '/settings', label: 'Settings', icon: '🏢', perm: ['admin.company', 'admin.access', 'admin.license', 'admin.data'], el: <Settings /> },
];

function LicenseBanner() {
  const data = useStore();
  const [res, setRes] = useState<LicenseResult | null>(null);
  useEffect(() => {
    if (data.company) verifyLicense(data.company.licenseKey, data.company.name).then(setRes);
  }, [data.company]);
  if (!res || res.state === 'valid' && res.daysLeft > 30) return null;
  const msg =
    res.state === 'valid' ? `License expires in ${res.daysLeft} days` :
    res.state === 'expired' ? 'License expired — contact your vendor to renew' :
    res.state === 'invalid' ? `License invalid: ${res.reason}` :
    res.state === 'missing' ? 'No license key — evaluation mode' : 'Evaluation build';
  return <div className={`banner ${res.state === 'valid' || res.state === 'not-configured' ? '' : 'bad'}`}>{msg}</div>;
}

function Shell() {
  const data = useStore();
  const { user, can } = useSession();
  const [open, setOpen] = useState(false);
  if (!user) return <Login />;
  const allowed = NAV.filter((n) => !n.perm || (Array.isArray(n.perm) ? n.perm.some(can) : can(n.perm)));
  const home = allowed[0]?.to ?? '/my';
  const company = data.company!;
  return (
    <div className="shell" style={{ ['--brand' as string]: company.primaryColor }}>
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand">
          {company.logo ? <img src={company.logo} alt="" /> : <div className="logo-fallback">{company.name.slice(0, 2).toUpperCase()}</div>}
          <div>
            <strong>{company.name}</strong>
            <small>TRS Field Ops</small>
          </div>
        </div>
        <nav onClick={() => setOpen(false)}>
          {allowed.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav ${isActive ? 'on' : ''}`}>
              <span aria-hidden>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <div>
            <strong>{user.name}</strong>
            <small>{data.roles.find((r) => r.id === user.roleId)?.name ?? '—'} · {user.empNo}</small>
          </div>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </div>
      </aside>
      {open && <div className="side-scrim" onClick={() => setOpen(false)} />}
      <main>
        <div className="topbar">
          <button className="btn ghost" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
          {company.logo && <img src={company.logo} alt="" className="top-logo" />}
          <strong>{company.name}</strong>
        </div>
        <LicenseBanner />
        <Routes>
          {allowed.map((n) => <Route key={n.to} path={n.to} element={n.el} />)}
          {can('employees.view') || can('employees.manage') || can('hse.view') ? <Route path="/employees/:id" element={<EmployeeDetail />} /> : null}
          {can('equipment.view') && <Route path="/equipment/:id" element={<EquipmentDetail />} />}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
        <nav className="bottom-nav">
          {allowed.slice(0, 5).map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
              <span aria-hidden>{n.icon}</span>
              <small>{n.label}</small>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}

export default function App() {
  const loaded = useLoaded();
  const data = useStore();
  if (!loaded) return <div className="center muted">Loading…</div>;
  if (!data.company) return <Setup />;
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
