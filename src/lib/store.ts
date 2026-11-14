import { useSyncExternalStore } from 'react';
import { del, get, set } from 'idb-keyval';
import type { AppData, Collection, Company, Employee, StoredFile } from './types';
import { defaultRoles, permissionsOf } from './permissions';
import type { Permission } from './types';

// Offline-first local store (IndexedDB). All screens read from memory synchronously and every change
// is persisted. A cloud adapter (see supabase/schema.sql) can replace `persist`/`load` later to sync
// several devices of the same company.

const DATA_KEY = 'trs-data-v1';
const SESSION_KEY = 'trs-session';

export function emptyData(): AppData {
  return {
    version: 1,
    company: null,
    roles: defaultRoles(),
    employees: [],
    rigs: [],
    jobs: [],
    assignments: [],
    leaves: [],
    overrides: [],
    preps: [],
    certificates: [],
    trainingReqs: [],
    equipment: [],
    maintenance: [],
    equipmentDocs: [],
    hseEvents: [],
    audit: [],
  };
}

let data: AppData = emptyData();
let sessionUserId: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    set(DATA_KEY, data).catch((e) => console.error('Save failed', e));
  }, 150);
}

export async function loadStore() {
  try {
    const saved = (await get(DATA_KEY)) as AppData | undefined;
    if (saved) data = { ...emptyData(), ...saved };
  } catch (e) {
    console.error('Load failed', e);
  }
  try {
    sessionUserId = localStorage.getItem(SESSION_KEY);
  } catch {
    sessionUserId = null;
  }
  loaded = true;
  emit();
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

function currentUserName() {
  return data.employees.find((e) => e.id === sessionUserId)?.name;
}

function audit(action: string) {
  data = { ...data, audit: [{ at: nowIso(), by: currentUserName(), action }, ...data.audit].slice(0, 500) };
}

// ---- Mutations ----
type ItemOf<C extends Collection> = AppData[C][number];

export function upsert<C extends Collection>(col: C, item: ItemOf<C>, label?: string) {
  const list = data[col] as ItemOf<C>[];
  const idx = list.findIndex((x) => (x as { id: string }).id === (item as { id: string }).id);
  const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [...list, item];
  data = { ...data, [col]: next };
  audit(`${idx >= 0 ? 'Updated' : 'Added'} ${col}${label ? `: ${label}` : ''}`);
  persist();
  emit();
}

export function upsertMany<C extends Collection>(col: C, items: ItemOf<C>[]) {
  const map = new Map((data[col] as ItemOf<C>[]).map((x) => [(x as { id: string }).id, x]));
  items.forEach((i) => map.set((i as { id: string }).id, i));
  data = { ...data, [col]: [...map.values()] };
  persist();
  emit();
}

export function remove<C extends Collection>(col: C, id: string, label?: string) {
  data = { ...data, [col]: (data[col] as { id: string }[]).filter((x) => x.id !== id) };
  audit(`Deleted ${col}${label ? `: ${label}` : ''}`);
  persist();
  emit();
}

export function removeWhere<C extends Collection>(col: C, pred: (x: ItemOf<C>) => boolean) {
  data = { ...data, [col]: (data[col] as ItemOf<C>[]).filter((x) => !pred(x)) };
  persist();
  emit();
}

export function setCompany(company: Company) {
  data = { ...data, company };
  audit('Updated company profile');
  persist();
  emit();
}

export function replaceAll(next: AppData) {
  data = { ...emptyData(), ...next };
  persist();
  emit();
}

export async function resetAll() {
  data = emptyData();
  sessionUserId = null;
  await del(DATA_KEY);
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

// ---- Session ----
export function login(userId: string) {
  sessionUserId = userId;
  try {
    localStorage.setItem(SESSION_KEY, userId);
  } catch {
    /* ignore */
  }
  emit();
}

export function logout() {
  sessionUserId = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

// ---- Files (certificates, COC, sick notes …) stored as separate IndexedDB entries ----
export async function saveFile(file: File): Promise<StoredFile> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const stored: StoredFile = { id: uid('file'), name: file.name, type: file.type, size: file.size, dataUrl };
  await set(`file:${stored.id}`, stored);
  return stored;
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  return get(`file:${id}`);
}

export async function openFile(id: string) {
  const f = await getFile(id);
  if (!f) return alert('File not found on this device.');
  const blob = await (await fetch(f.dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---- Hooks ----
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let snapshot: { data: AppData; sessionUserId: string | null; loaded: boolean } = { data, sessionUserId, loaded };
function getSnapshot() {
  if (snapshot.data !== data || snapshot.sessionUserId !== sessionUserId || snapshot.loaded !== loaded) {
    snapshot = { data, sessionUserId, loaded };
  }
  return snapshot;
}

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot).data;
}

export function useLoaded() {
  return useSyncExternalStore(subscribe, getSnapshot).loaded;
}

export function useSession(): { user: Employee | null; can: (p: Permission) => boolean } {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  const user = s.data.employees.find((e) => e.id === s.sessionUserId && e.active) ?? null;
  const perms = permissionsOf(s.data, user);
  return { user, can: (p) => perms.has(p) };
}

export function getData() {
  return data;
}
