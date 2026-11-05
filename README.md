# Julegavelisten

Oversikt over julegaver når man skal kjøpe til mange.

## Funksjoner
- **Personer** (mottakere) er felles for alle år – de følger automatisk med til nytt år. Kan arkiveres.
- **Gaver** (en eller flere) per person per år, med valgfritt **budsjett** og avkrysning for **pakket inn**.
  Budsjettet ligger på gaven, slik at du kan ha flere gaver til samme person, for eksempel når du kjøper inn på vegne av flere.
- **Få trykk**: Har personen ingen gave, legger «Legg til ting» tingen i en ny gave automatisk. Enter i navn går
  til pris, og Enter i pris lagrer og åpner neste ting. «+ Budsjett» setter budsjett med ett trykk. En ny gave
  går rett videre til første ting.
  Navn og budsjett vises som tekst og endres via «Rediger».
- Personer kan **foldes sammen** (huskes på enheten). «Fold alle» / «Åpne alle».
- **Sortering**: Dra personer, gaver og ting i håndtaket (⠿) med mus, finger eller tastatur (mellomrom + piltaster).
  Ting kan dras innen en gave og til en annen åpen gave (slipp på en ting, eller på «Legg til ting» for å legge
  den sist). Alternativ uten dra: «Flytt opp/ned» og «Flytt til annen gave» i ⋯-menyen (WCAG 2.5.7).
  «Sorter A–Å» for personer.
- **Flytt** en ting til en annen gave i samme år – også til en annen person eller til en ny gave.
- **Kompakt visning**: én linje per ting (☐ kjøpt, navn/notat, lenke, pris, ☐ mottatt, ⋯). Mindre brukte
  handlinger (rediger, flytt, arkiver, slett) ligger i ⋯-menyer på person, gave og ting.
  En ny ting åpnes i redigering. «Avbryt» på en tom, ny ting fjerner den.
- **Items** per gave: navn/beskrivelse, pris, notat, lenke, **kjøpt** og **mottatt**.
- Viser sum kjøpt/bestilt, planlagt sum og status mot budsjett.
- **Alt kjøpt**-status når alle items er kjøpt. Budsjettet påvirker ikke status, men vises som indikator:
  «X kr igjen», «På budsjett» (innenfor ±10 % av budsjettet) eller «X kr over budsjett». Totalt per person og per år.
- Inneværende år er valgt ved oppstart. Årsoversikt øverst.
- **Juletema**: toppfelt i granfarge med diskrete, statiske snøfnugg og nedtelling til julaften. Ingen animasjon,
  og kontrasten er tilpasset WCAG også i mørk modus.
- **Lyst eller mørkt tema**: velges i ⋯-menyen (Lyst tema / Mørkt tema / Følg telefonen). Valget huskes på enheten.
- Eksport/import av data som JSON (backup / flytte mellom enheter).

## Lagring og personvern
Ingen server. Alle data lagres bare på enheten og sendes aldri noe sted, bortsett fra når du selv tar
en sikkerhetskopi.

- **IndexedDB** er hovedlager. `localStorage` er speilkopi som reserve. Data fra eldre versjoner flyttes automatisk over.
- **Varig lagring** (`navigator.storage.persist()`) blir forespurt, så nettleseren ikke rydder bort data.
  På Android/Chrome innvilges dette normalt når appen er installert.
- **Installerbar app (PWA)** med offline-støtte. Installer fra Chrome-menyen eller med knappen i
  «Lagring og sikkerhetskopi». Ny versjon tas i bruk først når du trykker «Oppdater».
- **Sikkerhetskopi**: Åpner Androids delingsmeny, så filen kan lagres i Google Drive o.l. Der deling ikke
  støttes, lastes filen ned. **Gjenopprett fra fil** erstatter data på enheten. En kopi av gjeldende data
  lagres internt før gjenoppretting.
- **Påminnelse** når du ikke har tatt sikkerhetskopi (etter 10 endringer), eller når det er gått mer enn
  7 dager siden forrige kopi og det er gjort endringer siden.

**Publisering:** Appen publiseres automatisk til GitHub Pages ved hver push til `main`
(`.github/workflows/deploy.yml`): https://npgoril-oss.github.io/Julegavelisten/
GitHub Pages leverer bare de statiske filene og ser aldri dataene dine.

Engangsoppsett i repoet: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

**Installere på Android:** Åpne adressen i Chrome. Velg deretter «Installer på hjemskjermen» under
«Lagring og sikkerhetskopi», eller *⋮ → Installer app* i Chrome-menyen.

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
