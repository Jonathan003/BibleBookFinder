import { useState } from 'react';
import { useAppConfig } from '../App';
import './Help.css';

const helpContent = {
  nl: {
    title: 'Help',
    approachTitle: 'Aanbevolen aanpak',
    approach: [
      {
        icon: '🎯',
        text: 'De app heeft twee modi: Quiz Modus en Studie Modus. Je kunt ze allebei gebruiken of maar één — kies wat voor jou werkt.',
      },
      {
        icon: '🚀',
        text: 'Een goede manier om te beginnen: start in Quiz Modus met alle 66 boeken. Het algoritme leert vanzelf welke boeken je lastig vindt. Begin met een ruime snelheidslimiet (de standaard is 10 seconden). Het standaard leertempo is Intensief — laat dat zo als je net begint. Intensief betekent meer herhaling, wat helpt om sneller te leren — ook als je niet elke dag oefent.',
      },
      {
        icon: '🪜',
        text: 'Boeken klimmen door zes niveaus: Onbekend → Geleerd → Vertrouwd → Beheerst → Verankerd → Permanent. Een boek "Beheerst" krijgen duurt enkele weken; alle 66 boeken op Verankerd ~2-3 maanden; alle 66 op Permanent een half jaar. Dat is geen vertraging — dat ís het leren. Hoe langer een boek tussen herhalingen blijft hangen zonder te vergeten, hoe sterker het in je geheugen zit.',
      },
      {
        icon: '⏸️',
        text: 'Wanneer "Klaar om te oefenen" op het startscherm — of "Te doen" in de quiz — op 0 staat: stop. Doortrainen op stabiele boeken maakt je geheugen niet sterker — wachten wel. Aan het eind van een sessie krijg je drie keuzes: de sessie afsluiten, naar Studie Modus (telt niet mee voor het schema), of "Train vooruit" gebruiken om wat extra te oefenen. Train vooruit is bedoeld als bonus, niet als gewone routine.',
      },
      {
        icon: '⚙️',
        text: 'Experimenteer met de instellingen en ontdek wat het best voor jou werkt. Sommige mensen zijn al snel zonder training — zij kunnen meteen met een lagere snelheidslimiet beginnen.',
      },
    ],
    studyTitle: 'Studie Modus',
    studyIntro: 'Als je het gevoel hebt dat je vlotter wordt en je wilt vrij leren zonder tijdsdruk, schakel dan over naar Studie Modus. Met Gerichte selectie richt Studie Modus zich automatisch op je zwakste boeken (op basis van je Quiz Modus trainingsdata). Je kunt ook specifieke groepen selecteren om gericht te oefenen.',
    studyStepsIntro: 'In Studie Modus kun je bijvoorbeeld stap voor stap opbouwen:',
    studySteps: [
      { icon: '1️⃣', text: 'Begin met Pentateuch + Evangeliën (9 boeken) — de basis van beide testamenten.' },
      { icon: '2️⃣', text: 'Voeg Historische boeken toe (21 boeken totaal) — het verhaal van Israël.' },
      { icon: '3️⃣', text: 'Voeg Handelingen + Brieven toe (43 boeken totaal) — de christelijke gemeente.' },
      { icon: '4️⃣', text: 'Tenslotte Profeten + Poëtische boeken + Openbaring (alle 66 boeken) — het moeilijkste deel.' },
    ],
    faqTitle: 'Veelgestelde vragen',
    faq: [
      // ─── 1. Modi ─────────────────────────────────────────────────────
      {
        q: 'Wat is het verschil tussen Studie Modus en Quiz Modus?',
        a: 'Studie Modus is om te leren zonder druk — kies groepen, oefen op je eigen tempo. Bij een fout antwoord licht het juiste boek blauw op. Quiz Modus test je snelheid en houdt je voortgang bij met herhaalritmes. Gebruik Studie om te leren, Quiz om te beheersen. Je kunt ook maar één modus gebruiken.',
      },
      // ─── 2. NEW: labels ─────────────────────────────────────────────
      {
        q: 'Wat betekent "Klaar om te oefenen" op het startscherm versus "Te doen" in de quiz?',
        a: 'Hetzelfde getal, twee namen. "Klaar om te oefenen" staat op het startscherm en is een uitnodiging: zoveel boeken wachten op je als je een sessie start. "Te doen" verschijnt in de quiz zelf en is een aftelteller: zoveel boeken nog te beantwoorden in deze sessie. Beide getallen tonen het aantal boeken dat het FSRS-algoritme nu wil herhalen — boeken die je nog niet hebt gezien plus boeken waarvan het herhaalinterval is verlopen. De andere naam in de quiz is bewust gekozen omdat "Klaar om te oefenen" daar gek leest — je bent al aan het oefenen.',
      },
      // ─── 3. NEW: Train Vooruit ──────────────────────────────────────
      {
        q: 'Wat is Train Vooruit en wanneer gebruik ik het?',
        a: 'Train Vooruit is een knop die verschijnt op het sessie-compleet-scherm (wanneer "Te doen" op 0 staat). Het laat je extra oefenen op boeken die nog niet aan de beurt zijn — je kiest 5 boeken, 10 boeken, deze week, of alle resterende. De boeken worden gekozen op volgorde van wanneer ze gepland staan (eerstvolgende eerst), dus je oefent precies wat het dichtst bij is. FSRS werkt gewoon door — vroege herhalingen geven automatisch iets minder stabiliteitswinst, maar dat is normaal en geen probleem. Train Vooruit is bedoeld voor momenten dat je extra tijd hebt, voor een vakantie, of gewoon omdat je zin hebt om door te gaan. Het is geen vervanger voor het normale schema; gebruik het als bonus, niet als hoofdroutine.',
      },
      // ─── 4. NEW: Drilling all-Mastered ──────────────────────────────
      {
        q: 'Wat als ik elke dag Train Vooruit doe tot alles Beheerst is?',
        a: 'Mag prima — het is geen "verkeerd gebruik" en de app blokkeert het niet. Wel een paar nuances. Je kunt op die manier alle 66 boeken sneller naar Beheerst tillen (ruwweg 1-2 weken bij intensief vooruit-trainen), naar Verankerd in 1-2 maanden, en naar Permanent in ongeveer een half jaar. Maar: meerdere herhalingen op dezelfde dag tellen niet evenveel als evenveel herhalingen verspreid over weken. FSRS schaalt de stabiliteitswinst met de retrievability (hoe ver weg het volgende moment was) — dezelfde dag is dichtbij, dus de winst per herhaling is kleiner. Je verspilt geen tijd, maar je krijgt minder rendement per minuut dan bij een gewone schema-volger. Geen oordeel: doe wat voor jou werkt. Het algoritme houdt het bij.',
      },
      // ─── 5. Pace ────────────────────────────────────────────────────
      {
        q: 'Wat betekenen Ontspannen, Gebalanceerd en Intensief?',
        a: 'Dit bepaalt hoe snel boeken terugkomen voor herhaling. Ontspannen = langere intervallen, kortere sessies. Intensief = kortere intervallen, vaker oefenen maar sneller leren. Je kunt dit altijd wijzigen via Instellingen.',
      },
      // ─── 6. Streak ──────────────────────────────────────────────────
      {
        q: 'Wat is de "dagen op rij" met het vlammetje?',
        a: 'Je streak: het aantal opeenvolgende dagen waarop je minstens één quiz-sessie hebt gedaan. Eén dag overslaan breekt de streak; de dag erna terugkomen begint opnieuw bij 1. Dit is bedoeld als zachte aansporing tot dagelijkse consistentie — wat voor lange-termijngeheugen veel meer doet dan eens per week een uur trainen. De best-streak ernaast toont je langste streak ooit.',
      },
      // ─── 7. Six tiers ───────────────────────────────────────────────
      {
        q: 'Wat zijn de zes niveaus (Onbekend, Geleerd, Vertrouwd, Beheerst, Verankerd, Permanent)?',
        a: 'Elk boek klimt geleidelijk omhoog naarmate je het correct beantwoordt en het algoritme zekerheid opbouwt. Onbekend = nog nooit gezien. Geleerd = voor het eerst geantwoord, maar nog onstabiel (uren tot een dag). Vertrouwd = enkele keren correct, het algoritme begint je intervallen op te schalen. Beheerst = stabiel voor minstens een week (dit was vroeger het enige eindniveau). Verankerd = stabiel voor een maand of meer. Permanent = stabiel voor een half jaar of meer — dit is wat het algoritme als "verankerd in lange-termijngeheugen" beschouwt. Het halen van alle 66 boeken op Permanent duurt natuurlijk maanden. Dat is geen probleem — het is precies wat lange-termijnleren betekent.',
      },
      // ─── 8. Gold line (expanded) ────────────────────────────────────
      {
        q: 'Wat is de gouden lijn onder sommige boeken en wanneer verschijnt die?',
        a: 'De gouden lijn verschijnt onder een boek zodra het niveau Beheerst (of hoger — Verankerd, Permanent) heeft bereikt. Concreet betekent dat: het algoritme heeft minstens drie correcte antwoorden gezien en de berekende stabiliteit ligt boven 7 dagen. De lijn is een visuele "dit boek zit erin"-markering, vergelijkbaar met WaniKani\'s Burned-status, en helpt je in één oogopslag zien welke boeken je nog moet oppikken. Pas dus enkele weken oefenen voordat de eerste gouden lijntjes verschijnen — dat is normaal. Je kunt de lijn ook helemaal uitschakelen via Instellingen → Grid → "Markeer beheerste boeken" als je liever zonder visuele voortgangshulp oefent.',
      },
      // ─── 9. Forecast ────────────────────────────────────────────────
      {
        q: 'Wat toont de "Komende 7 dagen"-balk?',
        a: 'Een vooruitblik: hoeveel boeken op elke dag van de komende week voor herhaling klaarstaan. Dit helpt je plannen — je kunt zien wanneer een drukke dag aankomt en eventueel iets vooruit doen, of een rustige dag verwachten. Er is geen verplichting; het is informatief.',
      },
      // ─── 10. Pause ──────────────────────────────────────────────────
      {
        q: 'Kan ik een quiz pauzeren?',
        a: 'Ja. Tik op "← Terug" om je sessie-samenvatting te zien. Van daaruit kun je doorgaan, instellingen wijzigen, of de sessie beëindigen. Je score en streak blijven bewaard.',
      },

      // ─── Voortgang begrijpen — vervolg ──────────────────────────────
      {
        q: 'Wat betekent "Klaar om te oefenen" op het startscherm?',
        a: 'Het toont hoeveel boeken het algoritme nu wil herhalen — boeken die je nog niet hebt gezien plus boeken waarvan het herhaalinterval is verlopen. Wanneer dit getal op 0 staat verschijnt in plaats daarvan een rust-kaart, met een boodschap die past bij hoe lang je rust hebt: "Sessie klaar" als het volgende boek binnen een uur terugkomt, "Klaar voor vandaag" als het later vandaag is, of "Klaar — geniet van de rust" als er pas morgen of later iets gepland staat. Eén dag uitstellen is geen probleem; meerdere dagen achter elkaar overslaan loopt op.',
      },
      {
        q: 'Waarom kan ik niet doortrainen als "Klaar om te oefenen" op 0 staat?',
        a: 'Je kunt wel — maar je voordeel ervan is bijna nul, en je kunt zelfs licht slechter af zijn. Het idee achter spaced repetition is dat je geheugen sterker wordt door de pauze tussen herhalingen, niet door extra herhalingen op iets dat al zit. Een boek dat al "Beheerst" is opnieuw oefenen voegt geen nieuwe sterkte toe; het reset alleen de timer. Voor de uren of dagen waarin een boek "rust" doet je brein onbewust werk — daarom voelt het de volgende keer makkelijker. Wil je toch verder oefenen, gebruik dan Train Vooruit (op het sessie-compleet-scherm) of Studie Modus.',
      },
      {
        q: 'Hoe wordt mijn trainingstijd bijgehouden?',
        a: 'Per beantwoorde vraag tellen we hoe lang je erover deed, met een maximum van 30 seconden per vraag. Als je weggaat of in slaap valt, telt enkel die 30 seconden mee — zo wordt je totaal niet kunstmatig opgeblazen. Je totale trainingstijd zie je op het Tussenstand-scherm en in Instellingen → Data. "Voortgang resetten" zet ook de trainingstijd terug op nul.',
      },

      // ─── Tijdens een sessie ─────────────────────────────────────────
      {
        q: 'Maakt het uit hoe snel ik tik?',
        a: 'In Quiz Modus wel. Antwoorden binnen de snelheidslimiet tellen mee voor je score en streak. Snellere antwoorden zorgen dat het boek minder snel terugkomt. Langzamere of foute antwoorden brengen het boek sneller terug. In Studie Modus maakt snelheid niet uit.',
      },
      {
        q: 'Wat gebeurt er als ik op het verkeerde boek tik?',
        a: 'De app scrollt automatisch naar het juiste boek dat blauw oplicht. Het boek dat je verkeerd aantikte wordt oranje en schudt even. Je moet op het blauwe boek tikken om verder te gaan — dit versterkt het leren.',
      },
      {
        q: 'Wat gebeurt er als ik een hint gebruik?',
        a: 'Niets negatiefs. De hint toont de groep van het boek — de kleur, de groepsnaam (bijv. Pentateuch) en een korte beschrijving. Er is geen straf. Als je de hint nodig had, ben je automatisch langzamer, en het algoritme pikt dat op.',
      },
      {
        q: 'Wat doet auto-scroll?',
        a: 'Wanneer ingeschakeld scrollt de app automatisch bij elke vraag: Hebreeuwse Geschriften naar boven, Griekse Geschriften naar beneden. Dit geeft een subtiele positiehint. Wanneer je klaar bent voor de volledige uitdaging, zet auto-scroll uit — dan moet je zelf kiezen in welk testament het boek staat. Op grotere schermen waar het hele rooster zichtbaar is (bijvoorbeeld een tablet in liggende modus met OT/NT naast elkaar), heeft auto-scroll vanzelfsprekend geen zichtbaar effect — er is dan niets om naartoe te scrollen.',
      },
      {
        q: 'Wat is het verschil tussen Gericht en Willekeurig?',
        a: 'Met Gericht (de standaard) verschijnen boeken waar je moeite mee hebt vaker in Studie Modus. Met Willekeurig heeft elk boek een gelijke kans. Te wijzigen via Instellingen.',
      },
      {
        q: 'Hoe bereid ik me voor op vergaderingen?',
        a: 'Selecteer in Studie Modus de groep(en) die bij het wekelijkse Bijbelleesprogramma horen. Zo oefen je precies de boeken die aan bod komen.',
      },
      {
        q: 'Welke boeken zijn het moeilijkst?',
        a: 'De 17 profetische boeken zijn voor de meesten het lastigst — ze liggen dicht bij elkaar in het rooster. Extra oefening op deze groep helpt het meest.',
      },
      {
        q: 'Wat als ik de app lang niet gebruik?',
        a: 'Geen probleem. Er is geen straf voor een pauze. Wanneer je terugkomt staan er meer boeken als "Klaar om te oefenen". Pak gewoon op waar je gebleven was. Je streak resetset wel, maar je tier-vooruitgang en je beste-streak blijven bewaard.',
      },

      // ─── Instellingen / Aanpassingen ────────────────────────────────
      {
        q: 'Hoe pas ik het rooster aan mijn Bijbel-app aan?',
        a: 'Open je Bijbel-app en kijk hoe het boekenrooster eruitziet. Pas dan de grid-instellingen aan zodat ze overeenkomen — zo oefen je dezelfde indeling die je dagelijks ziet.',
      },
      {
        q: 'Wat is "OT/NT layout (liggend)" en wanneer gebruik ik welke?',
        a: 'Deze instelling bepaalt hoe in liggende modus de Hebreeuws-Aramese en Christelijke Griekse Geschriften worden getoond. "Onder elkaar" plaatst beide testamenten verticaal — handig op smallere schermen of als je liever alle ruimte gebruikt voor één breed rooster. "Naast elkaar" plaatst ze horizontaal naast elkaar, zoals in de JW Library Studiebijbel — ideaal op tablets in liggende stand omdat je dan beide testamenten in één oogopslag ziet zonder te scrollen. Bij "Naast elkaar" kun je het aantal kolommen per testament apart instellen (standaard 4 voor OT en 3 voor NT, zoals in JW Library). In portretstand staan ze altijd onder elkaar — daar is geen horizontale ruimte voor twee helften. Deze instelling staat los per toestel, dus je iPad en Android tablet kunnen elk een andere voorkeur hebben.',
      },
      {
        q: 'Ik ben sneller/langzamer dan gemiddeld. Moet ik iets aanpassen?',
        a: 'Ja. Pas de snelheidslimiet aan via Instellingen → Training. Verlaag het als het te makkelijk is, verhoog het als je vaak correct bent maar als "te traag" wordt gemarkeerd.',
      },

      // ─── Data, opslag en delen ──────────────────────────────────────
      {
        q: 'Wordt mijn voortgang opgeslagen?',
        a: 'Ja, in de lokale opslag van je browser — apart per gebruiker. Maar alle voortgang gaat verloren als iemand de browserdata wist. Maak regelmatig een back-up via Instellingen → Data. Bij het herstellen van een back-up gaan je voortgang en persoonlijke voorkeuren (taal, leertempo, snelheid, beheerste boeken-markering) mee, maar apparaat-specifieke instellingen (aantal kolommen, afkortingen, OT/NT layout) blijven van het toestel waarop je herstelt. Zo kan je dezelfde back-up gebruiken op je telefoon, tablet en pc zonder dat de schermafmetingen van het ene toestel die van het andere verstoren.',
      },
      {
        q: 'Waar wordt mijn back-up opgeslagen, en kan ik kiezen waar?',
        a: 'Ja, je kiest zelf waar het bestand komt. Wanneer je op "Exporteer voortgang" tikt, opent op desktop (Chrome, Edge) een "Opslaan als"-venster waar je naar elke map kan navigeren — lokale schijf, OneDrive, Google Drive Desktop, Dropbox, of waar je maar wilt. Op telefoon of tablet opent het systeem-deelmenu met opties als "Bewaar in bestanden" (iOS) of "Save to Drive" (Android), afhankelijk van welke apps je hebt geïnstalleerd. De app schrijft niets voor — je hebt volledige vrijheid. Hetzelfde geldt voor importeren: je navigeert zelf naar het bestand. Tip: als je meerdere apparaten gebruikt, kies een gesynchroniseerde cloud-map (bv. iCloud Drive, OneDrive, Google Drive) zodat de back-up op al je apparaten beschikbaar is.',
      },
      {
        q: 'Kan ik dit offline gebruiken?',
        a: 'Ja. Na de eerste keer openen werkt de app offline als PWA. Installeer het op je telefoon via "Zet op beginscherm" voor de beste ervaring.',
      },
      {
        q: 'Wat doet de Delen-knop?',
        a: 'De Delen-knop deelt je voortgang als tekst met een link naar de app — bijvoorbeeld "Ik heb 33 van 66 bijbelboeken beheerst (10s) in de Bijbelboek Zoeker quiz!". Op telefoon of tablet opent je systeem-deelmenu zodat je naar WhatsApp, e-mail enzovoort kunt sturen; op desktop wordt het bericht naar je klembord gekopieerd zodat je het zelf kunt plakken. De snelheid tussen haakjes (bijv. "(10s)") wordt alleen meegenomen als je de snelheidslimiet niet hebt gewijzigd sinds je bent begonnen (of sinds je laatste reset). Als je halverwege bent overgestapt naar een andere snelheid, wordt de snelheid weggelaten — anders zou het misleidend zijn, want je beheerste boeken zijn dan een mix van verschillende snelheden. Wil je de snelheid weer terug in je deelbericht? Dan moet je je voortgang resetten via Instellingen → Data → "🗑️ Voortgang wissen". De reset koppelt je voortgang opnieuw aan je huidige snelheid, dus alles wat je daarna beheerst telt voor die snelheid.',
      },

      // ─── Update banner — moved to bottom ────────────────────────────
      {
        q: 'Wat betekent het "Nieuwe versie beschikbaar" balkje?',
        a: 'Wanneer er een nieuwere versie van de app is, verschijnt dit balkje op het startscherm. Tap "Nu vernieuwen" om de nieuwste versie te laden — je voortgang blijft gewoon bewaard. "Later" sluit het balkje voor deze sessie. De app controleert automatisch elk half uur of er een update is. In Instellingen → Data zie je onderaan welke versie en datum je momenteel gebruikt.',
      },
    ],
  },
  en: {
    title: 'Help',
    approachTitle: 'Recommended approach',
    approach: [
      {
        icon: '🎯',
        text: 'The app has two modes: Quiz Mode and Study Mode. You can use both or just one — choose what works for you.',
      },
      {
        icon: '🚀',
        text: 'A good way to start: jump into Quiz Mode with all 66 books. The algorithm will automatically learn which books you find difficult. Begin with a generous mastery speed (the default is 10 seconds). The default learning pace is Intensive — leave it there when starting out. Intensive means more repetition, which helps you learn faster — even if you don\'t practice every day.',
      },
      {
        icon: '🪜',
        text: 'Books climb through six tiers: Unseen → Learning → Familiar → Mastered → Anchored → Permanent. Getting a book to "Mastered" takes a few weeks; all 66 books to Anchored ~2-3 months; all 66 to Permanent about half a year. That\'s not slowness — that *is* the learning. The longer a book stays in memory between reviews without being forgotten, the deeper it\'s rooted.',
      },
      {
        icon: '⏸️',
        text: 'When "Ready to practice" on the home screen — or "Due" inside the quiz — reads 0: stop. Drilling stable books does not strengthen memory — waiting does. At the end of a session you\'ll get three choices: end the session, switch to Study Mode (which doesn\'t affect the schedule), or use "Train ahead" to do a little extra. Train ahead is a bonus, not a routine.',
      },
      {
        icon: '⚙️',
        text: 'Experiment with the settings and find what works best for you. Some people are already fast without any training — they can start with a lower mastery speed right away.',
      },
    ],
    studyTitle: 'Study Mode',
    studyIntro: 'When you feel more confident and want to practice freely without time pressure, switch to Study Mode. With Focused selection it automatically targets your weakest books (based on your Quiz Mode training data). You can also select specific groups to focus on.',
    studyStepsIntro: 'In Study Mode you can build up step by step:',
    studySteps: [
      { icon: '1️⃣', text: 'Start with Pentateuch + Gospels (9 books) — the foundation of both testaments.' },
      { icon: '2️⃣', text: 'Add Historical books (21 books total) — the story of Israel.' },
      { icon: '3️⃣', text: 'Add Acts + Letters (43 books total) — the Christian congregation.' },
      { icon: '4️⃣', text: 'Finally add Prophets + Poetic books + Revelation (all 66 books) — the hardest section.' },
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      // ─── 1. Modes ────────────────────────────────────────────────────
      {
        q: 'What is the difference between Study Mode and Quiz Mode?',
        a: 'Study Mode is for learning without pressure — pick groups, practice at your own pace. When you tap wrong, the correct book lights up blue. Quiz Mode tests your speed and tracks progress with spaced repetition. Use Study to learn, Quiz to master. You can also use just one mode.',
      },
      // ─── 2. NEW: labels ─────────────────────────────────────────────
      {
        q: 'What\'s the difference between "Ready to practice" on the home screen and "Due" during the quiz?',
        a: 'Same number, two names. "Ready to practice" appears on the home screen and frames the count as an invitation: this many books are waiting when you start a session. "Due" appears in the quiz itself and frames the same count as a session countdown: this many books still to answer in this run. Both numbers show the books FSRS wants to review now — unseen books plus books whose review interval has passed. The different name in the quiz is deliberate because "Ready to practice" reads oddly mid-session — you\'re already practicing.',
      },
      // ─── 3. NEW: Train Ahead ────────────────────────────────────────
      {
        q: 'What is Train Ahead and when should I use it?',
        a: 'Train Ahead is a button that appears on the session-complete screen (when "Due" reaches 0). It lets you practice extra on books that are not yet due — pick 5 books, 10 books, this week, or all remaining. Books are picked in order of how soon they were scheduled (closest first), so you train exactly what would have come up next. FSRS keeps running normally — early reviews give slightly smaller stability gains automatically, which is fine and not a problem. Train Ahead is intended for moments when you have extra time, before a vacation, or simply because you feel like continuing. It\'s a bonus, not a replacement for the regular schedule; use it on top, not instead of, the daily flow.',
      },
      // ─── 4. NEW: Drilling all-Mastered ──────────────────────────────
      {
        q: 'What if I do Train Ahead every day until everything is Mastered?',
        a: 'Perfectly fine — it\'s not "wrong use" and the app doesn\'t block it. A few nuances though. You can push all 66 books to Mastered faster this way (roughly 1-2 weeks of intensive Train-Ahead use), to Anchored in about 1-2 months, and to Permanent in about half a year. But: multiple reviews in one day don\'t count as much as the same number spread across weeks. FSRS scales stability gain by retrievability (how distant the next scheduled moment was) — same-day is close, so per-rep gain is smaller. You\'re not wasting time, just getting less return per minute than a regular schedule-follower. No judgment: do what works for you. The algorithm tracks it.',
      },
      // ─── 5. Pace ────────────────────────────────────────────────────
      {
        q: 'What do Relaxed, Balanced, and Intensive mean?',
        a: 'This controls how often books come back for review. Relaxed means longer intervals and shorter sessions. Intensive means shorter intervals — you practice more often but learn faster. You can change this anytime in Settings.',
      },
      // ─── 6. Streak ──────────────────────────────────────────────────
      {
        q: 'What is the "day streak" with the flame?',
        a: 'Your streak: the number of consecutive days on which you\'ve done at least one quiz session. Skipping a day breaks the streak; coming back the day after starts at 1 again. It\'s a gentle nudge toward daily consistency — which does more for long-term memory than a one-hour session once a week. The "Best" next to it shows your longest streak ever.',
      },
      // ─── 7. Six tiers ───────────────────────────────────────────────
      {
        q: 'What are the six tiers (Unseen, Learning, Familiar, Mastered, Anchored, Permanent)?',
        a: 'Each book climbs as you answer it correctly and the algorithm builds confidence. Unseen = never answered. Learning = answered for the first time but still unstable (hours to a day). Familiar = a few correct answers, intervals are starting to stretch. Mastered = stable for at least a week (this used to be the only end-state). Anchored = stable for a month or more. Permanent = stable for half a year or more — what the algorithm considers "rooted in long-term memory". Getting all 66 books to Permanent naturally takes months. That\'s not a flaw — it\'s exactly what long-term retention means.',
      },
      // ─── 8. Gold line (expanded) ────────────────────────────────────
      {
        q: 'What is the gold line at the bottom of some book cells, and when does it appear?',
        a: 'The gold line appears under a book once it has reached tier Mastered (or higher — Anchored, Permanent). Concretely: the algorithm has seen at least three correct answers and the calculated stability is above 7 days. The line is a visual "this book is rooted" marker, similar to WaniKani\'s Burned status, and helps you see at a glance which books still need work. Expect a few weeks of practice before the first gold lines appear — that\'s normal. You can also turn the line off entirely via Settings → Grid → "Mastered books" if you prefer practicing without the visual progress aid.',
      },
      // ─── 9. Forecast ────────────────────────────────────────────────
      {
        q: 'What does the "Next 7 days" bar show?',
        a: 'A look-ahead: how many books are scheduled for review on each upcoming day this week. Useful for planning — you can see when a busy day is coming and pull a few forward, or anticipate a quiet one. There\'s no obligation; it\'s informational.',
      },
      // ─── 10. Pause ──────────────────────────────────────────────────
      {
        q: 'Can I pause a quiz session?',
        a: 'Yes. Tap "← Back" to see your session summary. From there you can resume, change settings, or end the session. Your score and streak are preserved.',
      },

      // ─── Understanding progress — continued ─────────────────────────
      {
        q: 'What does "Ready to practice" mean on the home screen?',
        a: 'It shows how many books the algorithm wants to review now — unseen books plus books whose review interval has passed. When this number reaches 0, a rest card appears in its place with a message that matches how long your rest is: "Session complete" when the next book comes back within an hour, "Done for today" when it\'s later today, or "Done — enjoy the rest" when nothing is due until tomorrow or later. Postponing one day is fine; skipping multiple days in a row piles up.',
      },
      {
        q: 'Why can\'t I keep training when "Ready to practice" reads 0?',
        a: 'You can — but the benefit is near zero, and you may even be slightly worse off. Spaced repetition works because your memory strengthens *during* the wait between reviews, not from extra reps on something already stable. Re-drilling a Mastered book adds no new strength; it just resets the timer. During the hours or days a book "rests", your brain quietly does work — that\'s why the next time feels easier. If you want to keep practicing, use Train Ahead (on the session-complete screen) or Study Mode.',
      },
      {
        q: 'How is my training time tracked?',
        a: 'For each answered question we count how long you took, capped at 30 seconds per question. If you walk away or fall asleep, only 30 seconds count for that question — so your total isn\'t artificially inflated. Your total training time appears on the Stats so far screen and in Settings → Data. "Reset progress" also wipes the training-time counter.',
      },

      // ─── During a session ───────────────────────────────────────────
      {
        q: 'Does it matter how fast I tap?',
        a: 'In Quiz Mode, yes. Answers within the mastery speed threshold count toward your score and streak. Faster answers make the book come back less often. Slower or wrong answers bring it back sooner. In Study Mode, speed does not matter.',
      },
      {
        q: 'What happens when I tap the wrong book?',
        a: 'The app scrolls to the correct book which lights up blue. The book you tapped wrongly turns orange and briefly shakes. You must tap the blue book to continue — this reinforces learning.',
      },
      {
        q: 'What happens if I use a hint?',
        a: 'Nothing negative. The hint shows the book\'s group — the color, the group name (e.g. Pentateuch), and a short description. There is no penalty. If you needed the hint, you will naturally be slower, and the algorithm picks that up automatically.',
      },
      {
        q: 'What is auto-scroll?',
        a: 'When enabled, the app scrolls automatically at the start of each question: Hebrew-Aramaic Scriptures to the top, Christian Greek Scriptures to the bottom. This gives a subtle positional hint. When you\'re ready for the full challenge, turn auto-scroll off — then you have to decide which testament the book is in yourself. On larger screens where the entire grid is visible (such as a tablet in landscape with OT/NT side by side), auto-scroll naturally has no visible effect — there\'s nothing to scroll to.',
      },
      {
        q: 'What is the difference between Focused and Random?',
        a: 'With Focused (the default), books you struggle with appear more often in Study Mode. With Random, every book has an equal chance. You can change this in Settings.',
      },
      {
        q: 'How do I prepare for meetings?',
        a: 'In Study Mode, select the group(s) that match the weekly Bible reading program. This way you practice exactly the books that will come up.',
      },
      {
        q: 'Which books are the hardest?',
        a: 'The 17 prophetic books are the toughest for most people — they sit close together in the grid. Extra practice on this group helps the most.',
      },
      {
        q: "What happens if I don't use the app for a while?",
        a: 'Nothing bad. There is no penalty for taking a break. When you come back, more books will show as "Ready to practice". Just pick up where you left off. Your streak will reset, but your tier progress and best-streak record stay intact.',
      },

      // ─── Settings & adjustments ─────────────────────────────────────
      {
        q: 'How do I adjust the grid to match my Bible app?',
        a: 'Open your Bible app and check how the book grid looks. Then adjust the grid settings to match — this way you practice the same layout you see every day.',
      },
      {
        q: 'What is "OT/NT layout (landscape)" and when should I use which?',
        a: 'This setting controls how the Hebrew-Aramaic and Christian Greek Scriptures are displayed in landscape mode. "Stacked" places both testaments vertically — useful on narrower screens or when you prefer one wide grid using the full width. "Side by side" places them horizontally next to each other, like in the JW Library Study Bible — ideal on tablets in landscape because you see both testaments at a glance without scrolling. With "Side by side" you can set the column count for each testament independently (defaults are 4 for OT and 3 for NT, matching JW Library). In portrait mode they\'re always stacked — there\'s no horizontal room for two halves. This setting is independent per device, so your iPad and Android tablet can each have their own preference.',
      },
      {
        q: "I'm faster/slower than average. Should I change any settings?",
        a: 'Yes. Adjust the mastery speed in Settings → Training. Lower it if too easy, raise it if you are often correct but marked as "too slow".',
      },

      // ─── Data, storage, sharing ─────────────────────────────────────
      {
        q: 'Is my progress saved?',
        a: "Yes, in your browser's local storage — separately per user. But all progress is lost if someone clears the browser data. Create regular backups via Settings → Data. When you restore a backup, your progress and personal preferences (language, learning pace, mastery speed, mastered-book highlight) come with it, but device-specific settings (column counts, abbreviations, OT/NT layout) stay on the device you're restoring to. This way you can use the same backup on your phone, tablet, and PC without the screen-tuned settings of one device disturbing the others.",
      },
      {
        q: 'Where is my backup saved, and can I choose where?',
        a: 'Yes, you choose where the file goes. When you tap "Export progress", on desktop (Chrome, Edge) a "Save As" dialog opens where you can navigate to any folder — local drive, OneDrive, Google Drive Desktop, Dropbox, or wherever you like. On phone or tablet, the system share sheet opens with options like "Save to Files" (iOS) or "Save to Drive" (Android), depending on which apps you have installed. The app prescribes nothing — you have full freedom. The same applies to importing: you navigate to the file yourself. Tip: if you use multiple devices, pick a synced cloud folder (e.g. iCloud Drive, OneDrive, Google Drive) so your backup is available on all your devices.',
      },
      {
        q: 'Can I use this offline?',
        a: 'Yes. After opening the app once, it works offline as a PWA. Install it on your phone via "Add to Home Screen" for the best experience.',
      },
      {
        q: 'What does the Share button do?',
        a: 'The Share button shares your progress as text with a link to the app — for example "I mastered 33 out of 66 Bible books (10s) in the Bible Book Finder quiz!". On phone or tablet it opens your system share sheet so you can send to WhatsApp, email, etc.; on desktop it copies the message to your clipboard so you can paste it yourself. The speed in parentheses (e.g. "(10s)") is only included if you haven\'t changed your mastery speed since you started (or since your last reset). If you switched to a different speed partway through, the speed is left out — otherwise it would be misleading, because your mastered books are then a mix of different speeds. Want the speed back in your share message? Then reset your progress via Settings → Data → "🗑️ Reset Progress". The reset re-couples your progress to your current speed, so everything you master afterwards counts for that speed.',
      },

      // ─── Update banner — moved to bottom ────────────────────────────
      {
        q: 'What does the "New version available" banner mean?',
        a: 'When a newer version of the app is available, this banner appears on the home screen. Tap "Update now" to load the latest version — your progress stays intact. "Later" dismisses the banner for this session. The app automatically checks for updates every half hour. In Settings → Data, the bottom shows which version and date you\'re currently running.',
      },
    ],
  },
};

function AccordionItem({ question, answer, id }) {
  const [open, setOpen] = useState(false);
  const bodyId = `faq-body-${id}`;
  return (
    <div className={`accordion-item ${open ? 'open' : ''}`}>
      <button
        className="accordion-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="accordion-question">{question}</span>
        <span className="accordion-icon" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div id={bodyId} className="accordion-body">{answer}</div>}
    </div>
  );
}

export default function Help({ onBack }) {
  const { lang } = useAppConfig();
  const content = helpContent[lang] || helpContent.en;

  return (
    <div className="help-page">
      <div className="help-header">
        <button className="back-btn" onClick={onBack}>← {lang === 'nl' ? 'Terug' : 'Back'}</button>
        <h2>{content.title}</h2>
      </div>

      <section className="help-section">
        <h3>{content.approachTitle}</h3>
        <div className="approach">
          {content.approach.map((item, i) => (
            <div key={i} className="approach-item">
              <span className="approach-icon">{item.icon}</span>
              <p className="approach-text">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="help-section">
        <h3>{content.studyTitle}</h3>
        <p className="study-intro">{content.studyIntro}</p>
        <p className="study-steps-intro">{content.studyStepsIntro}</p>
        <div className="steps-card">
          {content.studySteps.map((step, i) => (
            <div key={i} className="step">
              <span className="step-icon">{step.icon}</span>
              <span className="step-text">{step.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="help-section">
        <h3>{content.faqTitle}</h3>
        <div className="accordion">
          {content.faq.map((item, i) => (
            <AccordionItem key={i} id={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </section>
    </div>
  );
}
