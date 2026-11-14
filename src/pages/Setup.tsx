import { useState } from 'react';
import type { Company, Employee } from '../lib/types';
import { login, replaceAll, setCompany, upsert } from '../lib/store';
import { defaultLists, demoData } from '../lib/seed';
import { Field } from '../components/ui';

export async function readImage(file: File, max = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/png');
}

/** First-run wizard: makes the app white-label for any TRS company. */
export default function Setup() {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0f4c81');
  const [logo, setLogo] = useState<string>();
  const [country, setCountry] = useState('Saudi Arabia');
  const [currency, setCurrency] = useState('USD');
  const [adminName, setAdminName] = useState('');
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('');
  const [demo, setDemo] = useState(true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return alert('PIN must be at least 4 digits');
    const company: Company = { name: name.trim(), primaryColor: color, logo, country, currency, lists: defaultLists() };
    const admin: Employee = {
      id: 'emp-admin', empNo: 'E1000', name: adminName.trim(), position: 'Operations Manager', department: 'Management',
      username: username.trim().toLowerCase(), pin, roleId: 'role-admin', active: true,
    };
    if (demo) {
      replaceAll(demoData(company, admin));
    } else {
      setCompany(company);
      upsert('employees', admin, admin.name);
    }
    login(admin.id);
  };

  return (
    <div className="auth">
      <form className="card auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <img src="./icon.svg" alt="" width={48} height={48} />
          <div>
            <h1>TRS Field Ops</h1>
            <p className="muted">Set up your company</p>
          </div>
        </div>
        <div className="grid2">
          <Field label="Company name" span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aboyonis TRS" /></Field>
          <Field label="Company logo">
            <input type="file" accept="image/*" onChange={async (e) => e.target.files?.[0] && setLogo(await readImage(e.target.files[0]))} />
          </Field>
          <Field label="Brand color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></Field>
          <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
          <Field label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} /></Field>
        </div>
        {logo && <img src={logo} alt="Logo preview" className="logo-preview" />}
        <h2>Administrator</h2>
        <div className="grid2">
          <Field label="Full name" span><input required value={adminName} onChange={(e) => setAdminName(e.target.value)} /></Field>
          <Field label="Username"><input required value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" /></Field>
          <Field label="PIN (4+ digits)"><input required type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} /></Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          Load demo data (rigs, jobs from the TRS dashboard, crew, equipment, certificates). Demo users have PIN 1234.
        </label>
        <button className="btn primary block" type="submit">Create company</button>
      </form>
    </div>
  );
}
