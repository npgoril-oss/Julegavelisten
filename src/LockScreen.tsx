import { useEffect, useId, useRef, useState } from 'react';
import type { AppData } from './types';
import { parseData } from './store';
import { Icon } from './icons';
import { loadAttempts, registerFailure, resetAttempts, verifyPin, type LockConfig } from './lock';

/**
 * Vises i stedet for appen når den er låst. Ingen gavedata rendres før koden er riktig,
 * så heller ikke skjermlesere eller «Finn på siden» kan se innholdet.
 */
export function LockScreen({
  cfg,
  onUnlock,
  onRestore,
}: {
  cfg: LockConfig;
  onUnlock: () => void;
  onRestore: (data: AppData, backedUpAt: string | null) => void;
}) {
  const id = useId();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [until, setUntil] = useState(() => loadAttempts().until);
  const [forgot, setForgot] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const waitSec = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (waitSec === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitSec]);

  useEffect(() => {
    if (waitSec === 0) inputRef.current?.focus();
  }, [waitSec]);

  const submit = async () => {
    if (waitSec > 0 || busy) return;
    setBusy(true);
    const ok = await verifyPin(pin, cfg);
    setBusy(false);
    if (ok) {
      resetAttempts();
      onUnlock();
      return;
    }
    const a = registerFailure(Date.now());
    setNow(Date.now());
    setUntil(a.until);
    setPin('');
    setError(
      a.until > Date.now()
        ? `Feil kode. Prøv igjen om ${Math.ceil((a.until - Date.now()) / 1000)} sekunder.`
        : 'Feil kode. Prøv igjen.',
    );
  };

  return (
    <div className="lock-screen">
      <header className="topbar">
        <div className="topbar-inner">
          <h1>
            <span aria-hidden="true">🎄 </span>Julegavelisten
          </h1>
        </div>
      </header>
      <main className="lock-body">
        <div className="lock-card">
          <span className="lock-icon" aria-hidden="true">
            <Icon name="lock" />
          </span>
          <h2>Appen er låst</h2>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor={`${id}-pin`}>PIN-kode</label>
            <input
              id={`${id}-pin`}
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="go"
              maxLength={6}
              value={pin}
              disabled={waitSec > 0}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${id}-err` : undefined}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
            />
            <button type="submit" disabled={waitSec > 0 || busy || pin.length < 4}>
              {waitSec > 0 ? `Vent ${waitSec} s` : 'Lås opp'}
            </button>
            {error && (
              <p id={`${id}-err`} className="field-error" role="alert">
                {error}
              </p>
            )}
          </form>

          <button type="button" className="link-btn" aria-expanded={forgot} onClick={() => setForgot((f) => !f)}>
            Glemt koden?
          </button>
          {forgot && (
            <div className="lock-forgot">
              <p>
                Velg sikkerhetskopien din (f.eks. fra Google Drive). Dataene på telefonen erstattes med kopien, og
                PIN-låsen slås av, så du kan velge en ny kode.
              </p>
              <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
                Velg sikkerhetskopi
              </button>
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
                    const data = parseData(raw);
                    const exportedAt =
                      typeof raw?.exportedAt === 'string' && !Number.isNaN(Date.parse(raw.exportedAt)) ? raw.exportedAt : null;
                    if (!confirm(`Erstatte alt på telefonen med «${file.name}» og slå av PIN-låsen?`)) return;
                    resetAttempts();
                    onRestore(data, exportedAt);
                  } catch {
                    setError('Filen er ikke en gyldig sikkerhetskopi fra Julegavelisten.');
                  }
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
