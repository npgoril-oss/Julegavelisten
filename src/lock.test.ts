import { describe, expect, it } from 'vitest';
import { AUTO_LOCK_MS, createLock, isValidPin, lockoutMs, shouldBeLocked, verifyPin } from './lock';

describe('PIN-kode', () => {
  it('godtar 4–6 sifre', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });
  it('lagrer ikke koden i klartekst og verifiserer riktig', async () => {
    const cfg = await createLock('2412', 1000);
    expect(JSON.stringify(cfg)).not.toContain('2412');
    expect(await verifyPin('2412', cfg)).toBe(true);
    expect(await verifyPin('2413', cfg)).toBe(false);
    expect(await verifyPin('', cfg)).toBe(false);
  });
  it('samme kode gir ulik hash (tilfeldig salt)', async () => {
    const [a, b] = await Promise.all([createLock('1111', 1000), createLock('1111', 1000)]);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('automatisk låsing', () => {
  const cfg = { salt: '00', hash: '00', iterations: 1 };
  it('ingen lås satt: aldri låst', () => {
    expect(shouldBeLocked(null, null, 0)).toBe(false);
  });
  it('låst ved oppstart uten tidligere aktivitet', () => {
    expect(shouldBeLocked(cfg, null, 1000)).toBe(true);
  });
  it('låses etter 15 minutter uten aktivitet', () => {
    expect(shouldBeLocked(cfg, 0, AUTO_LOCK_MS)).toBe(false);
    expect(shouldBeLocked(cfg, 0, AUTO_LOCK_MS + 1)).toBe(true);
  });
});

describe('ventetid ved feil kode', () => {
  it('fem frie forsøk, deretter økende ventetid med tak', () => {
    expect(lockoutMs(4)).toBe(0);
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(7)).toBe(120_000);
    expect(lockoutMs(20)).toBe(15 * 60_000);
  });
});
