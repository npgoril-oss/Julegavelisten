import { useRegisterSW } from 'virtual:pwa-register/react';

/** Varsler når en ny versjon er klar, i stedet for å laste siden på nytt midt i redigering. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update-toast" role="status">
      <span>En ny versjon av appen er klar.</span>
      <button onClick={() => updateServiceWorker(true)}>Oppdater</button>
      <button className="ghost" onClick={() => setNeedRefresh(false)}>
        Senere
      </button>
    </div>
  );
}
