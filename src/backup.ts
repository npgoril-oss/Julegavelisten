import type { AppData } from './types';

export type BackupResult = 'shared' | 'downloaded' | 'cancelled';

export function backupFileName(now: Date = new Date()): string {
  return `julegavelisten-sikkerhetskopi-${now.toISOString().slice(0, 10)}`;
}

/**
 * Tar sikkerhetskopi. På Android åpnes delingsmenyen, slik at filen kan lagres i
 * Google Drive, Filer e.l. – altså utenfor nettleseren. Faller tilbake til nedlasting.
 */
export async function createBackup(data: AppData): Promise<BackupResult> {
  const json = JSON.stringify({ app: 'julegavelisten', exportedAt: new Date().toISOString(), ...data }, null, 2);
  const base = backupFileName();
  // Ikke alle nettlesere tillater deling av .json, så prøv .txt som reserve. Gjenoppretting godtar begge.
  const candidates = [
    new File([json], `${base}.json`, { type: 'application/json' }),
    new File([json], `${base}.txt`, { type: 'text/plain' }),
  ];
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
    const file = candidates.find((f) => navigator.canShare!({ files: [f] }));
    if (file) {
      try {
        await navigator.share({ files: [file], title: 'Julegavelisten – sikkerhetskopi' });
        return 'shared';
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return 'cancelled';
        // Annen feil: fall tilbake til nedlasting
      }
    }
  }
  const url = URL.createObjectURL(candidates[0]);
  const a = document.createElement('a');
  a.href = url;
  a.download = candidates[0].name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
