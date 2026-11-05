import { useEffect, useRef, useState } from 'react';
import type { AppData } from './types';
import { parseData } from './store';
import { createBackup } from './backup';
import { needsBackup, saveSafetyCopy, type BackupMeta, type PersistState } from './persistence';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const dateFmt = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

function useInstallPrompt(onInstalled: () => void) {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onDone = () => {
      setInstalled(true);
      setEvent(null);
      onInstalled();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onDone);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onDone);
    };
  }, [onInstalled]);
  return { canInstall: !!event && !installed, installed, install: () => event?.prompt() };
}

export function StoragePanel({
  data,
  restore,
  meta,
  persist,
  idbAvailable,
  saveError,
  markBackedUp,
  recheckPersistence,
  announce,
}: {
  data: AppData;
  restore: (data: AppData, backedUpAt: string | null) => void;
  meta: BackupMeta;
  persist: PersistState | 'pending';
  idbAvailable: boolean;
  saveError: boolean;
  markBackedUp: () => void;
  recheckPersistence: () => void;
  announce: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const { canInstall, installed, install } = useInstallPrompt(recheckPersistence);
  const remind = needsBackup(meta);
  const hasData = data.persons.length > 0;

  const backup = async () => {
    const result = await createBackup(data);
    if (result === 'cancelled') return;
    markBackedUp();
    announce(
      result === 'shared'
        ? 'Sikkerhetskopi delt. Husk å velge et sted utenfor telefonen, f.eks. Google Drive.'
        : 'Sikkerhetskopi lastet ned til telefonen. Flytt den gjerne til Google Drive.',
    );
  };

  const lastBackupText = meta.lastBackupAt
    ? `${dateFmt.format(new Date(meta.lastBackupAt))}${
        meta.changesSinceBackup ? ` – ${meta.changesSinceBackup} endringer siden` : ' – ingen endringer siden'
      }`
    : hasData
      ? 'Aldri'
      : 'Ingen data ennå';

  return (
    <>
      {saveError && (
        <div className="notice error" role="alert">
          <strong>Kunne ikke lagre på enheten.</strong> Ta en sikkerhetskopi nå, så du ikke mister endringer.{' '}
          <button className="ghost" onClick={backup}>
            Ta sikkerhetskopi
          </button>
        </div>
      )}
      {!saveError && remind && (
        <div className="notice warn">
          <p>
            {meta.lastBackupAt
              ? `Det er over en uke siden forrige sikkerhetskopi (${meta.changesSinceBackup} endringer siden).`
              : 'Du har ikke tatt sikkerhetskopi ennå.'}{' '}
            Data finnes bare på denne telefonen.
          </p>
          <button onClick={backup}>Ta sikkerhetskopi nå</button>
        </div>
      )}

      <details className="storage" ref={detailsRef}>
        <summary>Lagring og sikkerhetskopi</summary>
        <div className="storage-body">
          <p>Alt lagres bare på denne enheten og sendes aldri til en server.</p>
          <dl className="storage-status">
            <div>
              <dt>Siste sikkerhetskopi</dt>
              <dd>{lastBackupText}</dd>
            </div>
            <div>
              <dt>Installert som app</dt>
              <dd>{installed ? 'Ja' : 'Nei – installer for å beskytte data og bruke appen uten nett'}</dd>
            </div>
            <div>
              <dt>Beskyttet mot automatisk opprydding</dt>
              <dd>
                {persist === 'granted'
                  ? 'Ja'
                  : persist === 'pending'
                    ? 'Sjekker …'
                    : persist === 'denied'
                      ? 'Ikke ennå – innvilges vanligvis når appen er installert'
                      : 'Ikke støttet i denne nettleseren'}
              </dd>
            </div>
            {!idbAvailable && (
              <div>
                <dt>Lager</dt>
                <dd>Reserve-lager i bruk (begrenset). Ta sikkerhetskopi jevnlig.</dd>
              </div>
            )}
          </dl>
          <div className="storage-actions">
            <button onClick={backup} disabled={!hasData}>
              Ta sikkerhetskopi
            </button>
            <button className="ghost" onClick={() => fileRef.current?.click()}>
              Gjenopprett fra fil
            </button>
            {canInstall && (
              <button className="ghost" onClick={install}>
                Installer på hjemskjermen
              </button>
            )}
          </div>
          <p className="muted small">
            Velg Google Drive (eller en annen skytjeneste) når delingsmenyen åpnes. Da overlever kopien selv om
            telefonen byttes eller nettleserdata slettes.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,text/plain,.json,.txt"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const raw = JSON.parse(await file.text());
                const parsed = parseData(raw);
                const exportedAt =
                  typeof raw?.exportedAt === 'string' && !Number.isNaN(Date.parse(raw.exportedAt)) ? raw.exportedAt : null;
                const msg =
                  `Gjenopprette ${parsed.persons.length} personer og ${parsed.gifts.length} gaver fra «${file.name}»?\n\n` +
                  'Dette erstatter alt som ligger på enheten nå.';
                if (!confirm(msg)) return;
                await saveSafetyCopy(data);
                restore(parsed, exportedAt);
                announce('Sikkerhetskopi gjenopprettet.');
              } catch (err) {
                alert(`Kunne ikke lese filen: ${(err as Error).message}`);
              }
            }}
          />
        </div>
      </details>
    </>
  );
}
