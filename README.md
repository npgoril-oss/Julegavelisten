# Julegavelisten

Oversikt over julegaver når man skal kjøpe til mange.

## Funksjoner
- **Personer** (mottakere) er felles for alle år – de følger automatisk med til nytt år. Kan arkiveres.
- **Gaver** (en eller flere) per person per år, med valgfritt **budsjett** og avkrysning for **pakket inn**.
- **Items** per gave: navn/beskrivelse, pris, notat, lenke, **kjøpt** og **mottatt**.
- Viser sum kjøpt/bestilt, planlagt sum og status mot budsjett.
- **Alt kjøpt**-status når alle items er kjøpt. Budsjettet påvirker ikke status, men vises som indikator:
  «X kr igjen», «På budsjett» (innenfor ±100 kr) eller «X kr over budsjett». Totalt per person og per år.
- Inneværende år er valgt ved oppstart. Årsoversikt øverst.
- Eksport/import av data som JSON (backup / flytte mellom enheter).

## Lagring
Data lagres lokalt i nettleseren (`localStorage`). Ingen server, ingen innlogging.
Bruk eksport for backup.

## Utvikling
```bash
npm install
npm run dev     # utviklingsserver
npm test        # enhetstester for forretningsregler
npm run build   # produksjonsbygg i dist/ (statisk, kan legges på f.eks. GitHub Pages)
```

## Universell utforming og mobil
Målet er WCAG 2.2 nivå AA. Appen er laget for mobil først.
- Alle felt har synlige, programmatiske etiketter. På brede skjermer vises de som kolonneoverskrifter.
- Kontrast på minst 4,5:1 for tekst og 3:1 for feltkanter og fokus, i både lys og mørk modus.
- Synlig fokus, «hopp til innhold»-lenke og logisk overskriftsstruktur (h1–h4).
- Fokus flyttes til det nye feltet når du legger til gave eller ting, og tilbake når du fjerner.
- Trykkflater på minst 44 × 44 px og 16 px tekst i felt, så iOS ikke zoomer inn.
- Ingen horisontal scrolling ned til 320 px bredde (reflow).
- Feilmeldinger ved ugyldig beløp leses opp. Status og budsjett formidles med tekst, ikke bare farge.
- Respekterer `prefers-reduced-motion` og Windows høykontrastmodus.

Verifisert med axe-core (0 brudd på wcag2a/aa, wcag21aa og wcag22aa). Automatiske tester fanger
bare en del av WCAG, så appen bør også testes manuelt med VoiceOver (iOS) og TalkBack (Android).
