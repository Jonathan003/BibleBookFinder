# v3.1 update — Flexibel leertempo + sessielengte-keuze

Deze update voegt twee samenhangende verbeteringen toe die Quiz Modus
geschikter maken voor mensen met wisselende vrije tijd. Beide raken het
FSRS-algoritme niet aan — alleen hoe de gebruiker ermee in contact komt.

## Wat zit er in deze zip

### A. Nieuwe "Flexibel" leertempo-instelling

**Probleem:** de drie bestaande tempo's (Ontspannen 0.85, Gebalanceerd
0.90, Intensief 0.95) zijn allemaal geijkt op gebruikers die regelmatig
oefenen. Voor wie wisselende vrije tijd heeft levert zelfs Ontspannen
nog steeds een schema op dat als "achterstand" voelt: 30-50 boeken
klaarstaan na een paar dagen niet kunnen oefenen is normaal voor het
algoritme, maar visueel ontmoedigend.

**Oplossing:** een vierde tempo "Flexibel" met `request_retention=0.80`.
Bij dit niveau worden intervallen ongeveer dubbel zo lang als bij
Gebalanceerd. Concreet: een gebruiker die nu 30 boeken/dag te oefenen
heeft op Gebalanceerd, ziet bij Flexibel ongeveer 12-15 boeken/dag. Alle
66 boeken halen nog steeds Permanent over de tijd; ze hangen alleen
langer in tussenstadia en het schema voelt minder veeleisend.

**Veiligheid bij wisselen:** bestaande FSRS-data blijft onaangetast. De
ts-fsrs scheduler wordt herbouwd zodra `learningPace` verandert (via
`useMemo([learningPace])`), maar alleen toekomstige herhalingen gebruiken
de nieuwe retention. Bestaande due-dates blijven staan. Dit volgt Anki's
default "Reschedule cards on change: NO" — de aanbevolen aanpak.

**Bestanden:** `src/fsrs.js` (`PACE_CONFIG.flexible: { request_retention:
0.80 }` toegevoegd boven `relaxed`), `src/components/Settings.jsx`
(dropdown uitgebreid + hint switch case), `src/data.js` (`paceFlexible`
+ `paceFlexibleHint` translation keys in NL en EN).

**Hintteksten:**
- NL: "Lichtste schema — kom wanneer je tijd hebt, geen dagelijkse druk"
- EN: "Lightest schedule — come when you have time, no daily pressure"

### B. Sessielengte-keuze op het startscherm (Snel / Normaal / Volledig)

**Probleem:** Quiz Modus had één enkele Start-knop, die alle klaarstaande
boeken in één sessie zette. Voor een gebruiker met 12 due en 5 minuten
voelt dat als "ik moet alles doen of niets". Box Modus had dit probleem
al opgelost via zijn scope-keuze; Quiz Modus niet.

**Oplossing:** waar nu één Start-knop staat, verschijnen 1-3 launcher-
knoppen afhankelijk van hoeveel boeken klaarstaan:
- ≤ 5 due: alleen "Volledig (N boeken)" (de andere zouden hetzelfde
  resultaat geven, dus geen redundante keuzes)
- 6-10 due: "Snel (5)" + "Volledig (N)"
- > 10 due: "Snel (5)" + "Normaal (10)" + "Volledig (N)"

Klikt op Snel → quiz start met limiet van 5 boeken. De pickNextBook-
logica blijft identiek (most-overdue eerst, 20% kans op nieuw boek voor
variatie), maar telt af richting de gekozen limiet. Bij 5 antwoorden
verschijnt het bestaande sessie-compleet-scherm, met Train-vooruit
beschikbaar als de gebruiker toch wil doorgaan.

**Algoritme-impact:** geen. FSRS update als gebruikelijk per antwoord.
De 5 die je doet zijn de 5 die je hoe dan ook eerst zou hebben gedaan —
de rest blijft "due" voor de volgende sessie. Een Snelle sessie van 5
boeken is dus geen "halve sessie" maar een echte korte sessie.

**Edge cases:**
- Train Vooruit overrulet de session-limit (eigen queue, eigen lengte).
- Sessionlimit-keuze is per launch, niet persistent over launches.
- Pace-wissel mid-sessie blijft veilig: bestaande sessie blijft draaien
  met de nieuwe scheduler voor toekomstige reviews.
- Box Modus behoudt de enkele Start-knop met scope-picker. De asymmetrie
  is bewust: elke modus surfacet zijn eigen kernkeuze (Box = scope,
  Quiz = lengte).

**Bestanden:** `src/components/QuizGrid.jsx` (`sessionLimit` prop,
`sessionLimitRef` + `sessionPickCountRef`, limit-check in `pickNextBook`
boven de regular flow, increment na succesvolle pick, clear in
`handleStartTrainAhead`), `src/App.jsx` (`quizSessionLimit` state, drie
launcher-knoppen vervangen de Quiz-mode Start-knop, `onBack` reset de
limit, wrapper `.home-launcher-area` voor hoogte-stabiliteit),
`src/App.css` (`.home-quiz-launchers`, `.home-launcher-btn`,
`.home-launcher-primary`, `.home-launcher-area` met responsive collapse
op ≥640px), `src/data.js` (`sessionSizeQuick`/`Standard`/`Full`/`Books`/
`BookSingle`/`Minutes` translation keys in NL en EN).

### C. Help-pagina uitgebreid

**Twee FAQ-aanpassingen** in `src/components/Help.jsx`:
- De bestaande "Wat betekenen Ontspannen, Gebalanceerd en Intensief?"-
  vraag is verbreed naar "Wat betekenen Flexibel, Ontspannen,
  Gebalanceerd en Intensief?" met uitleg per niveau (vergetingsrisico-
  percentages, doelgroep per niveau, en de garantie dat wisselen veilig
  is voor bestaande data).
- Nieuwe vraag "Wat zijn Snel, Normaal en Volledig op het startscherm?"
  legt de drie launcher-knoppen uit en wanneer welke verschijnen.

Beide vragen in NL en EN.

### D. Documentatie

- `BibleBooks-Reference.md` ongewijzigd (eerder deze week gepubliceerd).
- README niet aangepast (de hoofdfunctionaliteit blijft hetzelfde, alleen
  detail-instellingen veranderen).

## Build-verificatie

Clean build slaagt op vite 6 + React 19 (bundle 414.81 KiB, ~2 KiB groei
t.o.v. v3 door extra translation keys en launcher-rendering). Geen
warnings. Logic test voor de launcher-zichtbaarheidsregels (7 scenario's
van dueNow=0 tot 66) past 7/7.

---

# v3 polish update — wijzigingen overzicht

Deze update voltooit de v3-rebuild door de Box/Quiz oefenervaring volledig
gelijk te trekken, een belangrijke export/import-bug te repareren, en de
projectdocumentatie up-to-date te brengen na de Studie Modus-verwijdering.

## Wat zit er in deze zip

### 1. Box Mode wrong-answer flow nu identiek aan Quiz Mode

**Probleem:** in Box Mode advanceerde de app automatisch na een fout
antwoord (1500 ms feedback-window). In Quiz Mode moet de gebruiker eerst
op het blauw oplichtende correcte boek tikken om door te gaan. Dit zorgde
voor inconsistente leerervaring tussen modi en sloeg de pedagogische
versterking ("zie het juiste antwoord, kies het bewust") in Box Mode over.

**Oplossing:** auto-advance verwijderd. Na een fout antwoord (of
hard-mode timeout) blijft het correcte boek blauw oplichten tot de
gebruiker erop tikt. Andere boeken zijn gedisabled tijdens dat venster
(deze guard bestond al in BoxMode.jsx — auto-advance schakelde er gewoon
omheen). De prompt toont al "Fout — kijk naar het blauwe vakje!"
(`wrongShowCorrect` translation key, ongewijzigd).

**Bestanden:** `src/components/BoxMode.jsx` (nieuwe wrong-feedback branch
in `handleBookClick`, twee `setTimeout`-blokken verwijderd, dode
`WRONG_FEEDBACK_MS` constant + comment opgeruimd).

### 2. Start-knop labels gelijkgetrokken

**Probleem:** "Start Box Mode" vs "Start Quiz" — inconsistente naamgeving
tussen modi.

**Oplossing:** beide knoppen gebruiken nu hetzelfde patroon:
- EN: "Start Quiz Mode" / "Start Box Mode"
- NL: "Start Quiz Modus" / "Start Doos Modus"

**Bestanden:** `src/data.js` (oude dode `upNext*` translation keys hernoemd
naar `homeStart*` matching their actual use; `upNextStartStudy` verwijderd),
`src/App.jsx` (start-button gebruikt nu `t.homeStartQuiz` / `t.homeStartBoxMode`).

### 3. Home-screen dashboard hoogte stabiel bij modus-wisseling

**Probleem:** wanneer de gebruiker wisselde tussen Box-kaart en Quiz-kaart
op het startscherm, sprong de layout omdat de Quiz dashboard veel hoger
was (~360 px met mastery cards + tier bar + 7-dagen forecast) dan de
Box dashboard (~140 px met alleen empty state).

**Oplossing:** `.dashboard-panel` heeft nu `min-height: 360 px` en
flex-column display, zodat de Box dashboard zich uitstrekt om dezelfde
ruimte te vullen. De empty-state berichtgeving in Box Mode is ook
vereenvoudigd voor parallelliteit met Quiz Mode: "Personal bests"
subtitle is nu altijd zichtbaar, met een muted hint-regel eronder
wanneer er nog geen records zijn — geen aparte "no sessions yet"
verbose wrapper meer, parallel aan hoe Quiz Mode "show structure with
zeros" doet zonder verklarende tekst.

**Bestanden:** `src/App.css` (`.dashboard-panel` min-height + flex,
`.boxmode-dashboard` flex 1, nieuwe `.boxmode-bests-empty-hint`),
`src/App.jsx` (Box dashboard JSX altijd dezelfde structuur — subtitle
+ content area).

### 4. Backup/restore omvat nu Box Mode data — bug fix

**Probleem:** twee aparte data-paden ontbraken in de export/import:
- `config.boxMode` (failMode, timePressure) was niet in de exported
  settings opgenomen — backup/restore reset deze stilletjes naar default
- `currentUser.boxModeBests` (per-scope persoonlijke records) was niet
  in de exported user-data opgenomen — een geslaagde "alle 66 in 2:30
  met 3 fouten" record overleefde geen backup/restore round-trip
- `handleRestore` in App.jsx restoorde `boxModeBests` evenmin

Aanwezig sinds Box Mode werd toegevoegd; we hebben deze niet veroorzaakt
maar wel ontdekt tijdens de v3 push-voorbereiding.

**Oplossing:** beide velden toegevoegd aan export shape, restore handelt
ze af met `|| {}` fallback voor pre-v3 backups. Schema bumped naar v3
met expliciete comment over wat er nieuw is. Geen migratie nodig — oude
backups laden gewoon zonder Box Mode data, wat correct gedrag is.

**Bestanden:** `src/components/Settings.jsx` (export shape uitgebreid,
`_schemaVersion: 3`), `src/App.jsx` (`handleRestore` herstelt
`boxModeBests`).

### 5. Stuk "Studie Modus"-knop verwijderd uit session-complete scherm — bug fix

**Probleem:** wanneer de gebruiker een Quiz-sessie afmaakte (Due → 0)
toonde het session-complete-scherm drie knoppen: Sessie afsluiten /
Studie Modus / Train vooruit. De "Studie Modus"-knop riep
`onGoToStudy()` aan, wat `setView('study')` deed — maar de
`view === 'study'` render-branch was in v3 verwijderd. Klikken zette
de app dus in een gebroken staat (state zegt 'study' maar niets
rendert daarvoor). Voor de meeste gebruikers ongezien omdat ze zelden
het session-complete-scherm bereiken (vereist Due + unseen = 0), maar
een echte gebroken-knop bug. Aanwezig sinds v3 home-rebuild.

**Oplossing:** knop volledig verwijderd. Train vooruit is de enige
overgebleven "ik wil verder oefenen"-optie en dekt het use-case af.
Alle bijbehorende code opgeruimd: `handleGoToStudy` callback,
`onGoToStudy` prop in QuizGrid, `setView('study')` callback in App.jsx,
`sessionCompleteStudy` translation key (NL+EN), `.session-complete-study`
CSS rule, en stale comments die de drie-keuzes flow beschreven.

**Bestanden:** `src/components/QuizGrid.jsx`, `src/App.jsx`,
`src/data.js`, `src/components/QuizGrid.css`.

### 6. HMR Fast Refresh fix

**Probleem:** Vite's React plugin gaf elke save de waarschuwing
"Could not Fast Refresh ('defaultConfig' export is incompatible)" en
deed een full page reload, omdat App.jsx zowel React-componenten
exporteerde als plain-data exports (`defaultConfig`, `mergeConfig`).

**Oplossing:** `defaultConfig` en `mergeConfig` verplaatst naar nieuwe
`src/appConfig.js`. App.jsx exporteert nu alleen `useAppConfig` (hook)
en de default `App` component — Fast Refresh compatible.

**Bestanden:** `src/appConfig.js` (nieuw), `src/App.jsx` (import in
plaats van inline definitions, dode module-level `detectedLang`
opgeruimd).

### 7. Studie Modus references opgeruimd

**Probleem:** Studie Modus is in de v3 home-rebuild verwijderd, maar
referenties bleven verspreid:
- Help.jsx had nog een hele "Studie Modus" sectie met intro + 4-stappen
  build-up lijst, plus 3 obsolete FAQs (Study-vs-Quiz, Random/Focused,
  Up Next), plus 6 incidentele Study Mode-vermeldingen verspreid over
  andere FAQ antwoorden, in zowel NL als EN
- `data.js` had 8 dode translation keys (`studyMode`, `bookSelection*`,
  `studyChooseGroup`, `startStudy`, `settingsSubsectionStudy`)
- `Settings.jsx` had ongebruikte `study` in de destructure
- README beschreef Study Mode in het features-overzicht, miste
  Box Mode helemaal

**Oplossing:** alle dode references verwijderd; FAQ entries die
Studie Modus tangentieel noemden zijn herschreven naar Box Mode of
Quiz Mode waar logisch. README features-sectie heeft nu de Box Mode
beschrijving op de plek waar Study Mode stond. JW Library Studie-
bijbel verwijzingen blijven (echte publicatie, niet de app-modus).

**Bestanden:** `src/components/Help.jsx`, `src/data.js`,
`src/components/Settings.jsx`, `README.md`.

## Test instructies

1. Pak de zip uit in `C:\qwencode\BibleBookFinder` — overschrijf
   bestaande bestanden. Verwijder `src/components/UpNextPanel.css`,
   `src/components/UpNextPanel.jsx`, en `src/suggestedMode.js` als ze
   nog op disk staan (oude v3-resten die nooit werden opgeruimd).
2. `npm install` (indien nodig)
3. `npm run dev` om lokaal te testen
4. Test in de browser:
   - **Box Mode wrong-answer:** start een sessie, tik op een fout boek
     → het juiste boek licht blauw op → wacht 5 seconden, niets gebeurt
     (geen auto-advance) → tik op het blauwe boek → advanceert
   - **Hard-mode timeout:** Settings → Doos Modus → Tijdsdruk: streng,
     start sessie, laat timer aflopen → identiek wrong-answer-gedrag
   - **Start-knop labels:** wissel tussen Box/Quiz selector cards op
     home → label past zich aan ("Start Box Mode" / "Start Quiz Mode")
   - **Layout-stabiliteit:** wissel snel heen en weer tussen Box en
     Quiz selector cards → cards en knoppen eronder verschuiven niet
   - **Backup round-trip:** wijzig Box Mode tijdsdruk-instelling, behaal
     een Box Mode persoonlijk record, exporteer backup, reset progress,
     importeer backup → instelling EN record moeten terugkomen
   - **HMR:** edit een willekeurige .jsx of .css file in dev-mode →
     hot patch (geen full page reload, geen "Could not Fast Refresh"
     waarschuwing in terminal)
5. `npm run build` om production-build te valideren
6. Indien alles goed is: commit en push.

## Voorgestelde commit-message

```
v3 polish: uniform Box/Quiz UX, backup completeness, doc cleanup

Box Mode now mirrors Quiz Mode for wrong answers (tap correct book to
advance, no auto-advance after 1.5s). Start button labels uniform
across modes/languages. Home dashboard panel height-stabilized so
mode-card switching no longer shifts layout below.

Backup/restore bug fix: config.boxMode and user.boxModeBests are now
included in export and restored on import (schema v3). Both fields
existed since Box Mode was added but were silently omitted from the
export shape, causing a backup round-trip to lose Box Mode settings
and personal bests.

HMR Fast Refresh fix via new src/appConfig.js so App.jsx only exports
React-component-shaped values. Saves no longer trigger full reload.

Documentation: README modes section updated (Study Mode out, Box Mode
in); CHANGES.md rewritten for this round; all Study Mode references
removed from in-app Help (FAQ entries, intro text, JSX section);
8 dead translation keys removed; upNext* keys renamed to homeStart*.
```
