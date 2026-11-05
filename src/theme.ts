/**
 * Valg av lyst/mørkt tema. «system» følger telefonens innstilling.
 * Valget lagres per enhet. index.html har et lite skript som setter temaet før siden tegnes,
 * så den ikke blinker i feil tema ved oppstart.
 */
export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_KEY = 'julegavelisten:theme';
const BAR_COLOR = { light: '#14452f', dark: '#0d2b1e' } as const;

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  // Fargen på nettleserlinjen/statuslinjen følger valgt tema.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.dataset.media ?? m.getAttribute('media') ?? '';
    if (!m.dataset.media) m.dataset.media = media;
    if (pref === 'system') {
      m.setAttribute('media', media);
      m.content = media.includes('dark') ? BAR_COLOR.dark : BAR_COLOR.light;
    } else {
      m.removeAttribute('media');
      m.content = BAR_COLOR[pref];
    }
  });
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* ikke kritisk */
  }
  applyTheme(pref);
}
