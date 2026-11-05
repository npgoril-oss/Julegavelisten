import { describe, expect, it } from 'vitest';
import { needsBackup } from './persistence';
import { backupFileName } from './backup';

const now = new Date('2026-12-10T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe('påminnelse om sikkerhetskopi', () => {
  it('ingen påminnelse uten endringer', () => {
    expect(needsBackup({ lastBackupAt: null, changesSinceBackup: 0 }, now)).toBe(false);
    expect(needsBackup({ lastBackupAt: daysAgo(30), changesSinceBackup: 0 }, now)).toBe(false);
  });
  it('aldri tatt: minner etter 10 endringer', () => {
    expect(needsBackup({ lastBackupAt: null, changesSinceBackup: 9 }, now)).toBe(false);
    expect(needsBackup({ lastBackupAt: null, changesSinceBackup: 10 }, now)).toBe(true);
  });
  it('tatt før: minner når det er gått minst 7 dager og det finnes endringer', () => {
    expect(needsBackup({ lastBackupAt: daysAgo(6), changesSinceBackup: 50 }, now)).toBe(false);
    expect(needsBackup({ lastBackupAt: daysAgo(7), changesSinceBackup: 1 }, now)).toBe(true);
  });
});

describe('filnavn', () => {
  it('inneholder dato', () => {
    expect(backupFileName(now)).toBe('julegavelisten-sikkerhetskopi-2026-12-10');
  });
});
