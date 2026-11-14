import { LICENSE_PUBLIC_KEY } from './licensePublicKey';

// License key format:  TRS1.<base64url(JSON payload)>.<base64url(ECDSA P-256 signature)>
// Issued offline by the vendor with scripts/license.mjs; verified on-device with the embedded public key.

export interface LicensePayload {
  company: string; // must match the company name in the app (case-insensitive)
  licenseId: string;
  plan: string; // e.g. Standard / Enterprise
  maxUsers: number;
  modules: string[]; // ['ops','field','workshop','hse','equipment'] or ['*']
  issued: string;
  expires: string; // YYYY-MM-DD
}

export type LicenseResult =
  | { state: 'valid'; payload: LicensePayload; daysLeft: number }
  | { state: 'expired'; payload: LicensePayload }
  | { state: 'invalid'; reason: string }
  | { state: 'missing' }
  | { state: 'not-configured' };

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function verifyLicense(key: string | undefined, companyName: string): Promise<LicenseResult> {
  if (!LICENSE_PUBLIC_KEY) return { state: 'not-configured' };
  if (!key) return { state: 'missing' };
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'TRS1') return { state: 'invalid', reason: 'Wrong key format' };
  try {
    const pub = await crypto.subtle.importKey('jwk', LICENSE_PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pub,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return { state: 'invalid', reason: 'Signature check failed' };
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as LicensePayload;
    if (payload.company.trim().toLowerCase() !== companyName.trim().toLowerCase())
      return { state: 'invalid', reason: `Key is issued to "${payload.company}"` };
    const daysLeft = Math.floor((new Date(payload.expires + 'T23:59:59').getTime() - Date.now()) / 86_400_000);
    if (daysLeft < 0) return { state: 'expired', payload };
    return { state: 'valid', payload, daysLeft };
  } catch (e) {
    return { state: 'invalid', reason: (e as Error).message };
  }
}
