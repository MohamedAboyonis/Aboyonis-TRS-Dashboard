import { useEffect, useRef, useState, type ReactNode } from 'react';
import { openFile, saveFile } from '../lib/store';
import { expiryState, fmtDate } from '../lib/dates';

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="row gap">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="card-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, span }: { label: string; children: ReactNode; span?: boolean }) {
  return (
    <label className={`field ${span ? 'span' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Select({ value, onChange, options, placeholder, required }: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{placeholder ?? '— Select —'}</option>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function MultiChips({ value, onChange, options }: { value: string[]; onChange: (v: string[]) => void; options: string[] }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function ExpiryBadge({ date, due }: { date?: string; due?: boolean }) {
  const s = expiryState(date, due ? 14 : 30);
  if (s === 'none') return <Badge>No expiry</Badge>;
  const tone = s === 'expired' ? 'bad' : s === 'expiring' ? 'warn' : 'good';
  const icon = s === 'expired' ? '⛔' : s === 'expiring' ? '⚠️' : '✓';
  const words = due ? ['Overdue', 'Due soon', 'Due'] : ['Expired', 'Expiring', 'Valid'];
  return <Badge tone={tone}>{icon} {s === 'expired' ? words[0] : s === 'expiring' ? words[1] : words[2]} · {fmtDate(date)}</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/** Attach a file (PDF / photo of certificate, COC, sick note…). Stores it on-device and returns its id. */
export function FileAttach({ fileId, onChange }: { fileId?: string; onChange: (id: string | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="row gap wrap">
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 8 * 1024 * 1024) return alert('Max 8 MB per file');
          setBusy(true);
          const s = await saveFile(f);
          setBusy(false);
          onChange(s.id);
        }}
      />
      <button type="button" className="btn" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? 'Saving…' : fileId ? '📎 Replace file' : '📎 Attach / scan'}
      </button>
      {fileId && (
        <>
          <button type="button" className="btn ghost" onClick={() => openFile(fileId)}>View</button>
          <button type="button" className="btn ghost" onClick={() => onChange(undefined)}>Remove</button>
        </>
      )}
    </div>
  );
}

export function FileLink({ fileId }: { fileId?: string }) {
  if (!fileId) return <span className="muted">—</span>;
  return <button className="link" onClick={() => openFile(fileId)}>📎 View</button>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={t.key === value} className={`tab ${t.key === value ? 'on' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Single-series horizontal bar list (one accent color, values labeled, hover title). */
export function BarList({ rows, format = (n) => n.toLocaleString() }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Empty>No data yet</Empty>;
  return (
    <div className="barlist">
      {rows.map((r) => (
        <div className="bar-row" key={r.label} title={`${r.label}: ${format(r.value)}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bar-value">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function confirmDelete(what: string) {
  return window.confirm(`Delete ${what}? This cannot be undone.`);
}

export function downloadText(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function toCsv(rows: (string | number | undefined | null)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
