import { useState } from 'react';
import { login, useStore } from '../lib/store';
import { Field } from '../components/ui';

export default function Login() {
  const data = useStore();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const c = data.company!;
  const users = data.employees.filter((e) => e.active && e.username);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find((x) => x.username === username.trim().toLowerCase() && x.pin === pin);
    if (!u) return setErr('Wrong username or PIN');
    login(u.id);
  };

  return (
    <div className="auth" style={{ ['--brand' as string]: c.primaryColor }}>
      <form className="card auth-card narrow" onSubmit={submit}>
        <div className="auth-brand">
          {c.logo ? <img src={c.logo} alt="" /> : <img src="./icon.svg" alt="" width={48} height={48} />}
          <div>
            <h1>{c.name}</h1>
            <p className="muted">Sign in to TRS Field Ops</p>
          </div>
        </div>
        <Field label="Username">
          <input list="usernames" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
          <datalist id="usernames">{users.map((u) => <option key={u.id} value={u.username}>{u.name}</option>)}</datalist>
        </Field>
        <Field label="PIN">
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" required />
        </Field>
        {err && <p className="error">{err}</p>}
        <button className="btn primary block">Sign in</button>
      </form>
    </div>
  );
}
