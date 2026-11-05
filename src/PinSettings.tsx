import { useEffect, useId, useRef, useState } from 'react';
import { createLock, isValidPin, verifyPin, type LockConfig } from './lock';

export type PinMode = 'set' | 'change' | 'disable';

/** Skjema for å sette, endre eller slå av PIN-koden. Endring og avslåing krever gjeldende kode. */
export function PinSettings({
  mode,
  current,
  onDone,
  onClose,
}: {
  mode: PinMode;
  current: LockConfig | null;
  onDone: (cfg: LockConfig | null) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [oldPin, setOldPin] = useState('');
  const [pin, setPin] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const needsOld = mode !== 'set';
  const needsNew = mode !== 'disable';

  useEffect(() => firstRef.current?.focus(), []);

  const title = mode === 'set' ? 'Lås appen med PIN-kode' : mode === 'change' ? 'Endre PIN-kode' : 'Slå av PIN-lås';

  const submit = async () => {
    setError('');
    if (needsOld && current && !(await verifyPin(oldPin, current))) {
      setError('Gjeldende PIN-kode er feil.');
      return;
    }
    if (!needsNew) {
      onDone(null);
      return;
    }
    if (!isValidPin(pin)) {
      setError('PIN-koden må være 4–6 sifre.');
      return;
    }
    if (pin !== repeat) {
      setError('Kodene er ikke like.');
      return;
    }
    setBusy(true);
    onDone(await createLock(pin));
  };

  const field = (key: string, label: string, value: string, set: (v: string) => void, first: boolean, hint: 'next' | 'done') => (
    <div className="field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <input
        id={`${id}-${key}`}
        ref={first ? firstRef : undefined}
        type="password"
        inputMode="numeric"
        autoComplete={key === 'old' ? 'off' : 'new-password'}
        enterKeyHint={hint}
        maxLength={6}
        value={value}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : `${id}-hint`}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
      />
    </div>
  );

  return (
    <form
      className="pin-settings"
      noValidate
      aria-labelledby={`${id}-title`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <h2 id={`${id}-title`} className="pin-title">
        {title}
      </h2>
      {needsOld && field('old', 'Gjeldende PIN-kode', oldPin, setOldPin, true, needsNew ? 'next' : 'done')}
      {needsNew && field('new', 'Ny PIN-kode (4–6 sifre)', pin, setPin, !needsOld, 'next')}
      {needsNew && field('repeat', 'Gjenta ny PIN-kode', repeat, setRepeat, false, 'done')}
      {error ? (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="muted small">
          {mode === 'disable'
            ? 'Appen åpnes da uten kode.'
            : 'Appen låses etter 15 minutter uten bruk. Glemmer du koden, kan du låse opp med sikkerhetskopien.'}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" disabled={busy}>
          {mode === 'disable' ? 'Slå av' : 'Lagre'}
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          Avbryt
        </button>
      </div>
    </form>
  );
}
