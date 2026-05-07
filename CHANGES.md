# Polish update — wijzigingen overzicht

Deze zip bevat polish-verbeteringen die we vóór Drill Modus afronden, zodat het huidige FSRS-flow zo goed mogelijk werkt voordat we een tweede leersysteem ernaast bouwen.

## Wat zit er in deze zip

### 1. Drie-niveau rust-kaart op het startscherm

**Probleem:** wanneer `dueNow` op 0 staat, toonde de app altijd "Klaar voor vandaag" — ook wanneer het volgende boek in 5 minuten alweer terugkomt (Learning-tier korte intervallen). Dat was misleidend en maakte de boodschap hol.

**Oplossing:** drie eerlijke niveaus, gekozen op basis van hoe ver weg het volgende boek is:

| Niveau | Wanneer | Titel (NL) | Body (NL) |
|---|---|---|---|
| `session-end` | volgende boek <1 uur | ✓ Sessie klaar | Je sessie is af. Het volgende boek komt zo terug — neem even pauze. |
| `today` | volgende boek 1 uur — einde dag | ✓ Klaar voor vandaag | Geen boeken klaar om te oefenen. Het wachten is geen pauze — het is wanneer je geheugen het werk doet. |
| `multi-day` | volgende boek morgen of later | ✓ Klaar — geniet van de rust | Niets gepland tot je volgende boek terugkomt. Je geheugen consolideert tussen herhalingen — dit is het belangrijkste deel. |

**Bestanden:** `src/forecast.js` (nieuwe `getCelebrationLevel` helper), `src/App.jsx` (selecteert title/body via niveau), `src/data.js` (zes nieuwe i18n strings × NL/EN).

**De drempel is 1 uur (sessie-end → today)**, gekozen omdat de meeste Learning-tier intervallen onder een uur vallen. Wil je een andere drempel (2u, 4u), dan is het één regel aanpassen in `forecast.js` regel `const oneHour = 60 * 60 * 1000;`.

### 2. Reset Progress verplaatst van menu naar Settings → Data

**Probleem:** de Reset-knop stond op het hoofdmenu naast Quiz/Study/Share. Dat is een data-management actie die niet bij de oefen-actiestroom hoort, en geeft visuele afleiding.

**Oplossing:** verplaatst naar Settings → Data, onderaan na de export/import sectie, gescheiden door een visuele divider.

**Bestanden:** `src/App.jsx` (knop + bevestiging-paneel verwijderd uit menu, `confirmReset` state verwijderd, `doResetProgress` doorgegeven als prop), `src/components/Settings.jsx` (nieuwe Reset-sectie aan einde Data tab, eigen `confirmReset` state), `src/components/Settings.css` (`.btn-reset-progress`, `.settings-divider`, `.data-section-heading` stijlen toegevoegd), `src/App.css` (ongebruikte `.reset-btn` stijlen verwijderd), `src/data.js` (nieuwe `resetSectionTitle`, `resetSectionDesc` × NL/EN).

De bestaande bevestigings-flow blijft hetzelfde (inline panel, niet browser-confirm), met dezelfde `.reset-confirm-panel` styling als de import-bevestiging.

### 3. Help FAQ updates

Drie FAQ's bijgewerkt in zowel NL als EN:

- **"Wat betekent Klaar om te oefenen op het startscherm?"** — beschrijft nu de drie verschillende rust-kaarten (Sessie klaar / Klaar voor vandaag / Klaar — geniet van de rust)
- **"Wat doet de Delen-knop?"** — pad naar Reset bijgewerkt: "Instellingen → Data → 🗑️ Voortgang wissen" in plaats van alleen de knop-naam

**Bestand:** `src/components/Help.jsx`

### 4. README.md uitgebreid

Features-sectie aangevuld met de tier-ladder, 7-day forecast, day streak, drie-niveau rest celebration, en learning pace settings. Reset-pad bijgewerkt.

## Wat is BEWUST niet in deze zip

Deze zaken stonden op de polish-checklist maar zijn uitgesteld omdat ze verdere ontwerpbeslissingen vereisen die jij nog niet hebt gemaakt. Ze zijn voor "Sprint 2" — na deze polish, voor of parallel aan Drill Modus.

### Statistieken-pagina (D2)

Idee: Share-knop vervangen door Statistieken-pagina (of het toevoegen van een tweede knop). De Share-knop blijft in deze zip ongewijzigd werken zoals voorheen.

**Wat ontbreekt:** ontwerpbeslissingen over wat er op de Statistieken-pagina komt — totaal trainingstijd, beste-tijden per boek, streak history, milestones bereikt? Wat is de hiërarchie?

### Speed-tracking en mijlpalen (G3-G7)

Idee: detect wanneer de gebruiker een persoonlijk record breekt op een boek, of een gemiddelde-tijd-drempel kruist (bijv. eerste keer onder 5s/3s/2s gemiddeld), en toon een mijlpaal-modal.

**Wat ontbreekt:** antwoorden op de vragen die ik je eerder stelde:
1. Welke gemiddelde-tijd-drempels (5s / 3s / 2s / 1.5s)?
2. Welke streak-mijlpalen (7 / 30 / 100 of 7 / 14 / 30 / 60 / 100 / 365)?
3. Speedrun-modus apart of natuurlijk uit normale quizzes?

De data is er al (`bestTimes`, `bestStreak`, `quizHistory`) — alleen de detectie en presentatie ontbreken.

### Achievements / share-card systeem

Idee: detecteer mijlpalen (33/66 boeken beheerst, hele OT/NT klaar, 30-dag streak, alle boeken op niveau Anchored, etc.) en toon een mooie share-card.

**Wat ontbreekt:** Statistieken-pagina is een prerequisite hiervoor — share-cards halen hun content meestal uit dezelfde data.

## Test instructies

1. Pak de zip uit in `C:\qwencode\BibleBookFinder` — overschrijf bestaande bestanden.
2. `npm install` (indien nodig)
3. `npm run dev` om lokaal te testen
4. Test in de browser:
   - **Drie-niveau celebratie:** in localhost waar je weinig/geen due hebt, kijk welke variant verschijnt en of het klopt met `Volgende boek: ...`
   - **Reset Progress:** ga naar Instellingen → Data → scroll naar beneden → "🗑️ Voortgang wissen" → Annuleer (test eerst zonder te wissen!) → klik weer → "Wissen" → controleer dat alles terug op nul staat
   - **Help FAQs:** open Help → expand "Wat betekent Klaar om te oefenen..." en "Wat doet de Delen-knop?" → controleer de nieuwe teksten
5. `npm run build` om production-build te valideren (mocht localhost iets missen)
6. Indien alles goed is: commit en push.

## Voorgestelde commit-messages

Kun je naar wens aanpassen, maar deze structuur werkt goed met je een-commit-per-onderwerp aanpak:

```
feat: three-level rest celebration based on next-due distance

Replace single "Klaar voor vandaag" message with three honest levels:
- session-end (next book <1h) → "Sessie klaar"
- today (next book later today) → "Klaar voor vandaag"
- multi-day (next book tomorrow+) → "Klaar — geniet van de rust"

Adds getCelebrationLevel() helper in forecast.js. Picks title/body
key based on level in App.jsx. Six new i18n strings (NL+EN).

Avoids the misleading "Done for today" appearance when Learning-tier
short intervals mean a book is back in 5 minutes.
```

```
refactor: move Reset Progress from home menu to Settings → Data

Reset is data-management, not practice flow — it belongs alongside
backup/restore. Home menu now stays focused on Quiz/Study/Share.

Settings.jsx owns the confirmation state internally (matches the
existing pendingImport pattern). App.jsx passes doResetProgress as
a prop. Inline confirm panel reuses the .reset-confirm-panel styling
from the import flow. Visual divider separates safe data actions
(export/import) from the destructive reset.
```

```
docs: update Help FAQs and README for tier system, forecast, streak

- "Ready to practice" FAQ now describes the three rest-card variants
- Share FAQ updates the path to Reset (Settings → Data instead of menu)
- README features section expanded: six-tier ladder, 7-day forecast,
  day streak, three-level celebration, learning pace
```

(Of doe het in één commit als je dat liever hebt — de bovenstaande splitsing is alleen een suggestie.)
