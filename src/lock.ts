/**
 * PIN-lås for appen (lokal, uten server).
 *
 * - PIN-koden lagres aldri i klartekst, bare som PBKDF2-SHA256-hash med tilfeldig salt.
 * - Låsen skjuler innholdet for andre som bruker telefonen (f.eks. barn). Dataene på enheten er
 *   ikke kryptert, så den beskytter ikke mot noen med teknisk tilgang til telefonen.
 * - Appen låses etter AUTO_LOCK_MS uten aktivitet, også om den har vært lukket i mellomtiden.
 * - Etter gjentatte feil må man vente stadig lenger, så en 4-sifret kode ikke kan gjettes raskt.
 */
export interface LockConfig {
  salt: string;
  hash: string;
  iterations: number;
}

export const LOCK_KEY = 'julegavelisten:lock';
const ACTIVE_KEY = 'julegavelisten:lastActive';
const ATTEMPTS_KEY = 'julegavelisten:pinAttempts';
export const AUTO_LOCK_MS = 15 * 60 * 1000;
const ITERATIONS = 150_000;
const FREE_ATTEMPTS = 5;

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toHex(bits);
}

export async function createLock(pin: string, iterations = ITERATIONS): Promise<LockConfig> {
  if (!isValidPin(pin)) throw new Error('PIN-koden må være 4–6 sifre');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), hash: await derive(pin, salt, iterations), iterations };
}

export async function verifyPin(pin: string, cfg: LockConfig): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const hash = await derive(pin, fromHex(cfg.salt), cfg.iterations);
  // Sammenlign alle tegn, uavhengig av hvor første avvik er.
  let diff = hash.length ^ cfg.hash.length;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ (cfg.hash.charCodeAt(i) || 0);
  return diff === 0;
}

/** Skal appen være låst nå? */
export function shouldBeLocked(cfg: LockConfig | null, lastActive: number | null, now: number): boolean {
  if (!cfg) return false;
  return lastActive == null || now - lastActive > AUTO_LOCK_MS;
}

/** Ventetid etter `failures` feil på rad: ingen de 5 første, deretter 30 s, 1 min, 2 min … maks 15 min. */
export function lockoutMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(30_000 * 2 ** (failures - FREE_ATTEMPTS), 15 * 60_000);
}

// ---------- Lagring ----------
const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignoreres */
  }
};

export function loadLock(): LockConfig | null {
  const c = read<LockConfig>(LOCK_KEY);
  return c && typeof c.salt === 'string' && typeof c.hash === 'string' && typeof c.iterations === 'number' ? c : null;
}
export const saveLock = (cfg: LockConfig | null) => write(LOCK_KEY, cfg);

export const loadLastActive = () => read<number>(ACTIVE_KEY);
export const saveLastActive = (t: number | null) => write(ACTIVE_KEY, t);

export interface Attempts {
  failures: number;
  /** Tidspunkt (ms) da neste forsøk er tillatt. */
  until: number;
}
export const loadAttempts = (): Attempts => read<Attempts>(ATTEMPTS_KEY) ?? { failures: 0, until: 0 };
export function registerFailure(now: number): Attempts {
  const failures = loadAttempts().failures + 1;
  const next = { failures, until: now + lockoutMs(failures) };
  write(ATTEMPTS_KEY, next);
  return next;
}
export const resetAttempts = () => write(ATTEMPTS_KEY, null);
