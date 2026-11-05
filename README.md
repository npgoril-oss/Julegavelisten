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
