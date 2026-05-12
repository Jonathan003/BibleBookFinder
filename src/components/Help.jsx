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
        text: 'De app heeft twee modi: Quiz Modus en Doos Modus. Je kunt ze allebei gebruiken of maar één — kies wat voor jou werkt.',
      },
      {
        icon: '🚀',
        text: 'Een goede manier om te beginnen: start in Quiz Modus met alle 66 boeken. Het algoritme leert vanzelf welke boeken je lastig vindt. Begin met een ruime doeltijd (de standaard is 10 seconden). Het standaard leertempo is Intensief — laat dat zo als je net begint. Intensief betekent meer herhaling, wat helpt om sneller te leren — ook als je niet elke dag oefent.',
      },
      {
        icon: '🪜',
        text: 'Boeken klimmen door zes niveaus: Onbekend → Geleerd → Bekend → Geworteld → Verankerd → Permanent. Een boek "Geworteld" krijgen duurt enkele weken; alle 66 boeken op Verankerd ~2-3 maanden; alle 66 op Permanent een half jaar. Dat is geen vertraging — dat ís het leren. Hoe langer een boek tussen herhalingen blijft hangen zonder te vergeten, hoe sterker het in je geheugen zit.',
      },
      {
        icon: '⏸️',
        text: 'Wanneer "Te doen" in de quiz op 0 staat: stop. Doortrainen op stabiele boeken maakt je geheugen niet sterker — wachten wel. Kom terug wanneer je tijd hebt; het is geen probleem als dat niet elke dag is.',
      },
      {
        icon: '⚙️',
        text: 'Experimenteer met de instellingen en ontdek wat het best voor jou werkt. Sommige mensen zijn al snel zonder training — zij kunnen meteen met een kortere doeltijd beginnen.',
      },
    ],
    howItWorksTitle: 'Hoe werkt het',
    howItWorks: [
      {
        heading: 'Twee signalen die samen werken',
        body: `De app houdt je voortgang bij met twee signalen die los van elkaar werken.

De gouden lijn onder een boek (in zowel Quiz als Doos Modus) verschijnt zodra je laatste drie antwoorden op dat boek correct én binnen je doeltijd waren. Dit is je "ik ben vertrouwd met dit boek"-markering. Eén fout of één te traag antwoord en de lijn is weg; drie nieuwe goede antwoorden brengen hem terug. Het gaat hier om je huidige vorm.

Het niveau (zichtbaar in de gekleurde balk op het startscherm) is gebaseerd op de FSRS-stabiliteit van een boek — een schatting van hoe lang je het in je geheugen vasthoudt zonder te oefenen. Niveaus veranderen langzaam: je werkt ze in dagen, weken en maanden op. Het niveau verandert niet binnen één sessie.

Beide zijn nuttig. De gouden lijn geeft directe feedback; het niveau toont je voortgang op de lange termijn.`,
      },
      {
        heading: 'De zes niveaus',
        body: `Elk boek doorloopt zes niveaus:

• Onbekend — nog niet beantwoord
• Geleerd — minstens één keer beantwoord, maar nog niet stabiel volgens FSRS
• Bekend — in het FSRS-systeem, maar stabiliteit < 7 dagen
• Geworteld — stabiliteit > 7 dagen plus genoeg herhalingen. Het "ik ken dit echt"-punt.
• Verankerd — stabiliteit > 30 dagen, typisch 1-2 maanden bezig
• Permanent — stabiliteit > 180 dagen, het lange-termijn doel

Globale tijdlijn op de standaard "Intensief"-leerpace: een paar weken om één boek tot Geworteld te krijgen, 2-3 maanden om alle 66 op Verankerd te krijgen, ongeveer een half jaar voor alle 66 op Permanent.

Dit is geen vertraging — dat ís het leren. Hoe langer een boek tussen herhalingen in je geheugen blijft zonder te vergeten, hoe sterker het wortelt.`,
      },
      {
        heading: 'Hoe je antwoorden het schema sturen',
        body: `FSRS schedulet elk boek apart, gebaseerd op je geschiedenis met dat boek. Het principe: hoe langer je geheugen voor een boek heeft vastgehouden zonder te vergeten, hoe langer het kan wachten voor de volgende test.

Concreet in Quiz Modus:

• Snel correct — telt voor je score en streak. FSRS-waardering: Good. Boek komt later terug.
• Traag correct — telt voor het totaal maar niet voor "goed". Streak reset. FSRS: Hard. Boek komt sneller terug.
• Fout — telt voor het totaal, niet voor "goed". Streak reset. FSRS: Again. Boek komt heel snel terug.
• Tijd voorbij — hetzelfde als traag correct (je hebt geen verkeerd boek gekozen, de tijd liep gewoon op). FSRS: Hard.

In Doos Modus is het simpeler: correct verhoogt het dozennummer, fout verlaagt het. Doos Modus heeft geen invloed op FSRS — het is een aparte oefensessie zonder schema-effect.

Je hoeft hier zelf niet over na te denken; antwoord gewoon eerlijk. Het schema corrigeert zichzelf.`,
      },
      {
        heading: 'De snelheidsbalk',
        body: `Boven elke vraag tikt een dunne oranje balk af. Hij telt af van de doeltijd die je in Instellingen → Training → Algemeen hebt ingesteld (standaard 10 seconden).

Loopt de balk leeg vóór je antwoordt? Dan:

• Het gevraagde boek licht blauw op
• De prompt verandert in "Tijd voorbij — zoek het blauwe vakje!"
• Andere boeken zijn niet meer aantikbaar
• Tik op het blauwe boek om verder te gaan

In Quiz Modus krijgt het boek een Hard-waardering en komt sneller terug. In Doos Modus zakt het één doos.

Wil je geen tijdsdruk? Zet de doeltijd op 30 seconden — in de praktijk voel je de timer dan niet meer. Wil je het uitdagender? Zet hem op 2-5 seconden.`,
      },
      {
        heading: 'Waarom pauzes prima zijn',
        body: `Spaced repetition werkt juist door de wachttijd tussen herhalingen. Tijdens de pauze doet je geheugen onzichtbaar werk — dat is wat het sterker maakt. Een boek dat je al kent opnieuw oefenen voegt geen nieuwe sterkte toe; het reset alleen de timer.

Lange pauzes voegen een achterstand toe (meer boeken staan op "Te doen" als je terugkomt) maar geen straf. Het schema corrigeert zichzelf: boeken die je echt vergeten bent vragen meer aandacht; boeken die je nog kent passen gewoon terug in het ritme.

Geen druk om dagelijks te oefenen. Train wanneer je tijd hebt.`,
      },
    ],
    faqTitle: 'Veelgestelde vragen',
    faq: [
      // ─── 4. Doos Modus introduction ────────────────────────────────
      {
        q: 'Wat is Doos Modus en waarvoor dient het?',
        a: 'Doos Modus is een aparte oefenmodus, los van het normale schema. Alle gekozen boeken beginnen in doos 1. Een goed antwoord verplaatst dat boek een doos hoger; een fout antwoord verplaatst het een doos lager. Je sessie is klaar wanneer alle gekozen boeken in doos 5 (de "verankerde" doos) staan. Het is een snelle, op zichzelf staande sessie — typisch 10-20 minuten — bedoeld voor wanneer je gewoon zin hebt om te trainen zonder je voortgang te beïnvloeden. Een persoonlijk record per selectie (alle 66, alleen Pentateuch, alleen Evangeliën, etc.) wordt bijgehouden voor tijd, fouten, en langste reeks. Je kunt zoveel sessies achter elkaar doen als je wilt; alleen je beste tijd telt mee.',
      },
      // ─── 5. Doos Modus vs Quiz Modus ───────────────────────────────
      {
        q: 'Wat is het verschil tussen Doos Modus en Quiz Modus?',
        a: 'Quiz Modus volgt het FSRS-schema — je werkt aan boeken die volgens het algoritme nu aan de beurt zijn. Doos Modus negeert het schema volledig: je kiest een selectie (alle 66 of een groep), elk boek begint in doos 1, en je werkt totdat alles in doos 5 staat. Het is een cram-modus zonder schema-impact: je beheersniveaus, gouden lijntjes, streak en herhaalintervallen veranderen er niet door. Gebruik Quiz voor lange-termijngeheugen, Doos Modus voor een korte intensieve sessie wanneer je iets even goed wilt vastzetten — bijvoorbeeld voor een vergadering waarin je snel moet kunnen opzoeken.',
      },
      // ─── 6. Doos Modus and the schedule ────────────────────────────
      {
        q: 'Beïnvloedt Doos Modus mijn FSRS-schema of mijn streak?',
        a: 'Nee. Doos Modus is volledig apart van het reguliere systeem. Boeken die je in Doos Modus beantwoordt — goed of fout — veranderen niets aan hun FSRS-stabiliteit, retrievability, niveau of plannings-interval. Je beheers-status blijft hetzelfde. Je dagelijkse streak telt alleen Quiz Modus-sessies, dus een Doos Modus-sessie alleen verdedigt je streak niet. De enige data die overblijft is je persoonlijk record per selectie (snelste tijd, minste fouten, langste reeks).',
      },
      // ─── 7. Doos Modus tijd ────────────────────────────────────────
      {
        q: 'Hoe werkt de tijd in Doos Modus?',
        a: 'Standaard heb je 10 seconden per vraag in Doos Modus, met een aftellende balk bovenaan het scherm. Als de tijd op is voordat je antwoordt, licht het gevraagde boek blauw op en moet je daarop tikken om verder te gaan — hetzelfde gedrag als bij een fout antwoord. Het boek zakt dan ook één doos. Je kunt de doeltijd aanpassen via Instellingen → Training → Algemeen → "Doeltijd per boek" (instelbaar tussen 2 en 30 seconden). Zet hem op 30 seconden als je liever zonder tijdsdruk oefent; zet hem op 2-5 seconden voor een echte uitdaging. Dezelfde instelling stuurt ook de timer in Quiz Modus.',
      },
      // ─── 5. Pace ────────────────────────────────────────────────────
      {
        q: 'Wat betekenen Flexibel, Ontspannen, Gebalanceerd en Intensief?',
        a: 'Dit bepaalt hoe snel boeken terugkomen voor herhaling — technisch gezegd: bij welk vergetingsrisico FSRS de volgende herhaling plant. Flexibel = lichtste schema (~20% vergetingsrisico bij elke herhaling), bedoeld voor mensen met wisselende vrije tijd; intervallen worden ongeveer dubbel zo lang als bij Gebalanceerd. Ontspannen = wat strakker (~15%). Gebalanceerd = standaard (~10%), de aanbevolen instelling voor de meeste mensen. Intensief = strakste schema (~5%), korte intervallen, snel leren maar dagelijks oefenen vereist. Je kunt het altijd wisselen in Instellingen; bestaande boekvoortgang blijft intact — alleen toekomstige herhalingen gebruiken de nieuwe instelling.',
      },
      // ─── 5b. Session size launcher ─────────────────────────────────
      {
        q: 'Wat zijn Snel, Normaal en Volledig op het startscherm?',
        a: 'Drie sessielengtes voor Quiz Modus. Snel = 5 boeken (1-2 min, voor korte momenten). Normaal = 10 boeken (3-4 min, een lekkere middenweg). Volledig = alle boeken die nu klaarstaan (alle vandaag te oefenen boeken in één keer). Welke knoppen verschijnen hangt af van hoeveel boeken klaarstaan: bij weinig boeken zie je alleen Volledig (de andere zouden hetzelfde resultaat geven), bij veel boeken alle drie. De algoritme-werking is identiek — Snel pakt gewoon de 5 meest dringende boeken, FSRS update normaal. De rest blijft "klaar" voor de volgende sessie. Bedoeld voor mensen met wisselende vrije tijd: een sessie van 5 boeken is een echte sessie, geen "halve sessie".',
      },
      // ─── 6. Streak ──────────────────────────────────────────────────
      {
        q: 'Wat is de "dagen op rij" met het vlammetje?',
        a: 'Je streak: het aantal opeenvolgende dagen waarop je minstens één quiz-sessie hebt gedaan. Eén dag overslaan breekt de streak; de dag erna terugkomen begint opnieuw bij 1. Dit is bedoeld als zachte aansporing tot dagelijkse consistentie — wat voor lange-termijngeheugen veel meer doet dan eens per week een uur trainen. De best-streak ernaast toont je langste streak ooit.',
      },
      // ─── 7. Six tiers ───────────────────────────────────────────────
      {
        q: 'Wat zijn de zes niveaus (Onbekend, Geleerd, Bekend, Geworteld, Verankerd, Permanent)?',
        a: 'De zes niveaus zijn de lange-termijn voortgangsmaat van het FSRS-algoritme. Onbekend = nog nooit gezien. Geleerd = voor het eerst geantwoord, maar nog onstabiel (uren tot een dag). Bekend = enkele keren correct, het algoritme begint je intervallen op te schalen. Geworteld = stabiel voor minstens een week. Verankerd = stabiel voor een maand of meer. Permanent = stabiel voor een half jaar of meer — verankerd in lange-termijngeheugen. Het halen van alle 66 boeken op Permanent duurt natuurlijk maanden. Dit niveau-systeem is afgekoppeld van de gouden lijn: gouden lijntjes verschijnen veel sneller (zie de volgende vraag).',
      },
      // ─── 8. Gold line — confident signal (v4) ────────────────────────
      {
        q: 'Wat is de gouden lijn onder sommige boeken en wanneer verschijnt die?',
        a: 'De gouden lijn verschijnt onder een boek zodra je laatste 3 antwoorden op dat boek allemaal correct én binnen je doeltijd waren. Eén fout antwoord of één te traag antwoord laat de lijn verdwijnen; drie nieuwe correct-en-snel antwoorden brengen hem terug. Dit is de "ik ben vertrouwd met dit boek" markering, los van het FSRS-niveau. Het maakt een race-naar-alle-66-goud in één sessie haalbaar voor gebruikers die de boekenrij al deels kennen. Het FSRS-niveau (Geworteld, Verankerd, Permanent) blijft daarnaast bestaan als lange-termijn maat — twee verschillende signalen, allebei nuttig. Je kunt de lijn helemaal uitschakelen via Instellingen → Training → Algemeen → "Vertrouwde boeken" als je liever zonder visuele voortgangshulp oefent.',
      },
      // ─── 9. Pause ──────────────────────────────────────────────────
      {
        q: 'Kan ik een quiz pauzeren?',
        a: 'Eigenlijk niet — maar dat is geen probleem. Tik op "← Terug" en je gaat direct naar het startscherm. Je gedane antwoorden zijn al opgeslagen (FSRS commit per antwoord), dus geen voortgang verloren. Wel wordt je sessie officieel afgesloten zodra je weggaat. Wil je later doorgaan, dan tik je opnieuw op "Start Quiz Mode" — de boeken die je nog niet had gedaan, komen vanzelf weer aan de beurt.',
      },

      // ─── Voortgang begrijpen — vervolg ──────────────────────────────
      // v6 commit 7: vragen over "Klaar om te oefenen" verwijderd —
      // dat label staat niet meer op het startscherm. De achterliggende
      // adviezen (waarom niet doortrainen als FSRS niets meer voor je
      // heeft, wachten als training) zitten nu in één samengevoegde
      // vraag hieronder.
      {
        q: 'Moet ik elke dag trainen?',
        a: 'Nee. Spaced repetition werkt juist door de wachttijd tussen herhalingen — je geheugen wordt sterker tijdens de pauze, niet door extra herhalingen op iets dat al zit. Eén dag overslaan is geen probleem. Meerdere dagen achter elkaar overslaan loopt op — wanneer je terugkomt zal "Te doen" in de quiz hoger staan, maar er is geen straf, je werkt het gewoon weer weg in je eigen tempo. Wanneer "Te doen" in de quiz op 0 staat heb je voor nu klaar; doortrainen helpt je geheugen niet meer (een stabiel boek opnieuw oefenen voegt geen nieuwe sterkte toe, het reset alleen de timer). Wil je toch verder oefenen, gebruik dan Doos Modus — die heeft geen invloed op je FSRS-schema.',
      },
      {
        q: 'Hoe wordt mijn trainingstijd bijgehouden?',
        a: 'Per beantwoorde vraag tellen we hoe lang je erover deed, met een maximum van 30 seconden per vraag. Als je weggaat of in slaap valt, telt enkel die 30 seconden mee — zo wordt je totaal niet kunstmatig opgeblazen. Je totale trainingstijd zie je in Instellingen → Data. "Quiz-voortgang wissen" zet ook de trainingstijd terug op nul.',
      },

      // ─── Tijdens een sessie ─────────────────────────────────────────
      {
        q: 'Maakt het uit hoe snel ik tik?',
        a: 'In Quiz Modus wel. Antwoorden binnen de doeltijd tellen mee voor je score en streak. Snellere antwoorden zorgen dat het boek minder snel terugkomt. Langzamere of foute antwoorden brengen het boek sneller terug.',
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
        q: 'Hoe bereid ik me voor op vergaderingen?',
        a: 'Selecteer in Doos Modus de groep die bij het wekelijkse Bijbelleesprogramma hoort (bijvoorbeeld "Pentateuch" of "Profeten"). Zo oefen je precies de boeken die aan bod komen, in een korte sessie zonder je FSRS-schema te beïnvloeden.',
      },
      {
        q: 'Welke boeken zijn het moeilijkst?',
        a: 'De 17 profetische boeken zijn voor de meesten het lastigst — ze liggen dicht bij elkaar in het rooster. Extra oefening op deze groep helpt het meest.',
      },
      {
        q: 'Wat als ik de app lang niet gebruik?',
        a: 'Geen probleem. Er is geen straf voor een pauze. Wanneer je terugkomt zal "Te doen" in de quiz hoger staan dan voorheen — een achterstand, geen schuld. Pak gewoon op waar je gebleven was, in je eigen tempo. Je streak resetset wel, maar je tier-vooruitgang en je beste-streak blijven bewaard.',
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
        a: 'Ja. Pas de doeltijd aan via Instellingen → Training → Algemeen → "Doeltijd per boek". Verlaag het als het te makkelijk is, verhoog het als je vaak correct bent maar als "te traag" wordt gemarkeerd.',
      },

      // ─── Data, opslag en delen ──────────────────────────────────────
      {
        q: 'Wordt mijn voortgang opgeslagen?',
        a: 'Ja, in de lokale opslag van je browser — apart per gebruiker. Maar alle voortgang gaat verloren als iemand de browserdata wist. Maak regelmatig een back-up via Instellingen → Data. Bij het herstellen van een back-up gaan je voortgang en persoonlijke voorkeuren (taal, leertempo, snelheid, vertrouwde-boeken-markering) mee, maar apparaat-specifieke instellingen (aantal kolommen, afkortingen, OT/NT layout) blijven van het toestel waarop je herstelt. Zo kan je dezelfde back-up gebruiken op je telefoon, tablet en pc zonder dat de schermafmetingen van het ene toestel die van het andere verstoren.',
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
        a: 'De Delen-knop deelt je voortgang als tekst met een link naar de app — bijvoorbeeld "Ik ben vertrouwd met 33 van 66 bijbelboeken (10s) in de Bijbelboek Zoeker quiz!". Op telefoon of tablet opent je systeem-deelmenu zodat je naar WhatsApp, e-mail enzovoort kunt sturen; op desktop wordt het bericht naar je klembord gekopieerd zodat je het zelf kunt plakken. De snelheid tussen haakjes (bijv. "(10s)") wordt alleen meegenomen als je de doeltijd niet hebt gewijzigd sinds je bent begonnen (of sinds je laatste reset). Als je halverwege bent overgestapt naar een andere doeltijd, wordt de snelheid weggelaten — anders zou het misleidend zijn, want je vertrouwde boeken zijn dan een mix van verschillende snelheden. Wil je de snelheid weer terug in je deelbericht? Dan moet je je Quiz-voortgang resetten via Instellingen → Data → "🗑️ Quiz-voortgang wissen". De reset koppelt je voortgang opnieuw aan je huidige doeltijd, dus alles wat je daarna leert telt voor die doeltijd.',
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
        text: 'The app has two modes: Quiz Mode and Box Mode. You can use both or just one — choose what works for you.',
      },
      {
        icon: '🚀',
        text: 'A good way to start: jump into Quiz Mode with all 66 books. The algorithm will automatically learn which books you find difficult. Begin with a generous target time (the default is 10 seconds). The default learning pace is Intensive — leave it there when starting out. Intensive means more repetition, which helps you learn faster — even if you don\'t practice every day.',
      },
      {
        icon: '🪜',
        text: 'Books climb through six tiers: Unseen → Learning → Familiar → Rooted → Anchored → Permanent. Getting a book to "Rooted" takes a few weeks; all 66 books to Anchored ~2-3 months; all 66 to Permanent about half a year. That\'s not slowness — that *is* the learning. The longer a book stays in memory between reviews without being forgotten, the deeper it\'s rooted.',
      },
      {
        icon: '⏸️',
        text: 'When "Due" inside the quiz reads 0: stop. Drilling stable books does not strengthen memory — waiting does. At the end of a session you\'ll get two choices: end the session, or use "Train ahead" to do a little extra. Train ahead is a bonus, not a routine.',
      },
      {
        icon: '⚙️',
        text: 'Experiment with the settings and find what works best for you. Some people are already fast without any training — they can start with a shorter target time right away.',
      },
    ],
    howItWorksTitle: 'How it works',
    howItWorks: [
      {
        heading: 'Two signals working together',
        body: `The app tracks your progress with two signals that work independently.

The gold line under a book (in both Quiz Mode and Box Mode) appears once your last three attempts on that book were all correct AND within your target time. This is your "I know this book right now" marker. One mistake or one too-slow answer and the line disappears; three more good answers bring it back. It's about your current form.

The tier (visible in the colored bar on the home screen) is based on a book's FSRS stability — an estimate of how long you'll keep it in memory without practicing. Tiers change slowly: you build them up over days, weeks and months. Tier doesn't change inside a single session.

Both are useful. The gold line gives immediate feedback; the tier shows your long-term progress.`,
      },
      {
        heading: 'The six tiers',
        body: `Each book moves through six tiers:

• Unseen — not yet answered
• Learning — answered at least once, but FSRS hasn't promoted it to stable yet
• Familiar — in the FSRS system, but stability < 7 days
• Rooted — stability > 7 days plus enough repetitions. The "I really know this" point.
• Anchored — stability > 30 days, typically 1-2 months in
• Permanent — stability > 180 days, the long-term goal

Rough timeline on the default "Intensive" learning pace: a few weeks to get one book to Rooted, 2-3 months to get all 66 to Anchored, about half a year for all 66 to Permanent.

This isn't slowness — it is the learning. The longer a book stays in memory between reviews without being forgotten, the more deeply it roots.`,
      },
      {
        heading: 'How your answers drive the schedule',
        body: `FSRS schedules each book individually based on your history with it. The principle: the longer your memory of a book has held up without forgetting, the longer it can wait before the next test.

Concretely in Quiz Mode:

• Fast correct — counts toward your score and streak. FSRS rating: Good. Book comes back later.
• Slow correct — counts toward the total but not toward "correct". Streak resets. FSRS: Hard. Book comes back sooner.
• Wrong — counts toward the total, not toward "correct". Streak resets. FSRS: Again. Book comes back very soon.
• Time-up — same as slow correct (you didn't pick a wrong book, the timer just ran out). FSRS: Hard.

Box Mode is simpler: correct increases the box number, wrong decreases it. Box Mode has no FSRS impact — it's a separate practice session with no schedule effect.

You don't have to think about this; just answer honestly. The schedule self-corrects.`,
      },
      {
        heading: 'The speed bar',
        body: `A thin orange bar ticks down above each question. It counts from the target time you've set in Settings → Training → Shared (default 10 seconds).

If the bar empties before you answer:

• The asked book lights up blue
• The prompt changes to "Time's up — look for the blue cell!"
• Other books are no longer tappable
• Tap the blue book to continue

In Quiz Mode the book gets a Hard rating and comes back sooner. In Box Mode it drops one box.

Don't want time pressure? Set the target speed to 30 seconds — in practice the timer is then no longer felt. Want it tougher? Set it to 2-5 seconds.`,
      },
      {
        heading: 'Why breaks are fine',
        body: `Spaced repetition works precisely because of the wait between reviews. During the pause, your memory does invisible work — that's what makes it stronger. Practicing a book you already know adds no new strength; it just resets the timer.

Long breaks add a backlog (more books show as "Due" when you come back) but no penalty. The schedule self-corrects: books you've truly forgotten will ask for more attention; books you still know just slot back into the rhythm.

No pressure to practice daily. Train when you have the time.`,
      },
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      // ─── 2. Box Mode introduction ───────────────────────────────────
      {
        q: 'What is Box Mode and what is it for?',
        a: 'Box Mode is a separate practice mode, independent of the regular schedule. Every selected book starts in box 1. A correct answer moves that book up one box; a wrong answer moves it down one box. Your session is finished when every selected book reaches box 5 (the "rooted" box). It\'s a quick, standalone session — typically 10-20 minutes — meant for moments when you simply feel like training without affecting your progress. Personal bests per selection (all 66, just Pentateuch, just Gospels, etc.) are tracked for time, mistakes, and longest streak. You can run as many sessions back-to-back as you want; only your best time counts.',
      },
      // ─── 3. Box Mode vs Quiz Mode ──────────────────────────────────
      {
        q: 'How is Box Mode different from Quiz Mode?',
        a: 'Quiz Mode follows the FSRS schedule — you work on books the algorithm decides are due now. Box Mode ignores the schedule entirely: you pick a selection (all 66 or a group), every book starts in box 1, and you work until everything reaches box 5. It\'s a cram mode with no schedule impact: your mastery levels, gold lines, streak, and review intervals don\'t change because of it. Use Quiz for long-term memory, Box Mode for a quick intensive session when you want to nail something down fast — for instance before a meeting where you\'ll need to look up books quickly.',
      },
      // ─── 4. Box Mode and the schedule ───────────────────────────────
      {
        q: 'Does Box Mode affect my FSRS schedule or my streak?',
        a: 'No. Box Mode is fully separate from the regular system. Books you answer in Box Mode — right or wrong — change nothing about their FSRS stability, retrievability, level, or scheduled interval. Your mastery status stays the same. Your daily streak only counts Quiz Mode sessions, so a Box Mode session alone won\'t defend your streak. The only data that persists is your personal best per selection (fastest time, fewest mistakes, longest streak).',
      },
      // ─── 7. Box Mode timer ──────────────────────────────────────────
      {
        q: 'How does the timer in Box Mode work?',
        a: 'By default you have 10 seconds per question in Box Mode, with a depleting bar at the top of the screen. If the timer expires before you answer, the asked book lights up blue and you must tap it to continue — same behavior as a wrong answer. The book also drops one box. You can adjust the target time via Settings → Training → Shared → "Target time per book" (settable between 2 and 30 seconds). Set it to 30 seconds if you prefer no time pressure; set it to 2-5 seconds for a real challenge. The same setting also drives the timer in Quiz Mode.',
      },
      // ─── 5. Pace ────────────────────────────────────────────────────
      {
        q: 'What do Flexible, Relaxed, Balanced, and Intensive mean?',
        a: 'This controls how often books come back for review — technically: at what forgetting risk FSRS schedules the next repetition. Flexible = lightest schedule (~20% forgetting risk at each repetition), designed for people with irregular practice time; intervals roughly double compared to Balanced. Relaxed = a bit tighter (~15%). Balanced = the standard (~10%), recommended for most people. Intensive = tightest schedule (~5%), short intervals, fast learning but requires daily practice. You can switch any time in Settings; existing book progress stays intact — only future repetitions use the new setting.',
      },
      // ─── 5b. Session size launcher ─────────────────────────────────
      {
        q: 'What are Quick, Standard, and Full on the home screen?',
        a: 'Three session lengths for Quiz Mode. Quick = 5 books (1-2 min, for short moments). Standard = 10 books (3-4 min, a comfortable middle ground). Full = all books currently ready (everything due today in one go). Which buttons appear depends on how many books are ready: when few are due you only see Full (the others would produce the same session), when many are due you see all three. The algorithm behaviour is identical — Quick simply picks the 5 most-urgent books, FSRS updates normally. The rest stays "ready" for next time. Designed for people with irregular practice time: a 5-book session is a real session, not a "half session".',
      },
      // ─── 6. Streak ──────────────────────────────────────────────────
      {
        q: 'What is the "day streak" with the flame?',
        a: 'Your streak: the number of consecutive days on which you\'ve done at least one quiz session. Skipping a day breaks the streak; coming back the day after starts at 1 again. It\'s a gentle nudge toward daily consistency — which does more for long-term memory than a one-hour session once a week. The "Best" next to it shows your longest streak ever.',
      },
      // ─── 7. Six tiers ───────────────────────────────────────────────
      {
        q: 'What are the six tiers (Unseen, Learning, Familiar, Rooted, Anchored, Permanent)?',
        a: 'The six tiers are the long-term progress measure tracked by the FSRS algorithm. Unseen = never answered. Learning = answered for the first time but still unstable (hours to a day). Familiar = a few correct answers, intervals are starting to stretch. Rooted = stable for at least a week. Anchored = stable for a month or more. Permanent = stable for half a year or more — what the algorithm considers rooted in long-term memory. Getting all 66 books to Permanent naturally takes months. This tier system is decoupled from the gold line: gold lines appear much sooner (see the next question).',
      },
      // ─── 8. Gold line — confident signal (v4) ───────────────────────
      {
        q: 'What is the gold line at the bottom of some book cells, and when does it appear?',
        a: 'The gold line appears under a book once your last 3 answers on that book were all correct AND within your target time. One wrong answer or one too-slow answer makes the line disappear; three more correct-and-fast answers bring it back. This is the "I know this book confidently" marker, decoupled from the FSRS tier. It makes a race-to-all-66-gold in a single session achievable for users who already partly know the layout. The FSRS tier (Rooted, Anchored, Permanent) still exists alongside as the long-term retention measure — two different signals, both useful. You can turn the line off entirely via Settings → Training → Shared → "Confident books" if you prefer practicing without the visual progress aid.',
      },
      // ─── 9. Pause ──────────────────────────────────────────────────
      {
        q: 'Can I pause a quiz session?',
        a: 'Not really — but that\'s fine. Tap "← Back" and you\'ll go straight to the home screen. Your answered questions are already saved (FSRS commits per answer), so no progress is lost. The session is officially closed when you leave, though. To continue later, tap "Start Quiz Mode" again — books you hadn\'t done yet will naturally come up again.',
      },

      // ─── Understanding progress — continued ─────────────────────────
      // v6 commit 7: questions about "Ready to practice" removed — that
      // label is no longer on the home screen. The underlying advice
      // (don't drill when FSRS has nothing scheduled; waiting *is* the
      // training) is now combined into the merged question below.
      {
        q: 'Do I need to train every day?',
        a: 'No. Spaced repetition works *because* of the wait between reviews — your memory strengthens during the pause, not from extra reps on things already stable. Skipping a day is fine. Skipping multiple days in a row piles up — when you come back the in-quiz "Due" counter will be higher, but there\'s no penalty, you just work it off at your own pace. When "Due" inside the quiz reads 0 you\'re done for now; extra reps don\'t help (re-drilling a stable book adds no new strength; it just resets the timer). If you want to keep practicing anyway, use Box Mode — it has no effect on your FSRS schedule.',
      },
      {
        q: 'How is my training time tracked?',
        a: 'For each answered question we count how long you took, capped at 30 seconds per question. If you walk away or fall asleep, only 30 seconds count for that question — so your total isn\'t artificially inflated. Your total training time appears in Settings → Data. "Reset Quiz progress" also wipes the training-time counter.',
      },

      // ─── During a session ───────────────────────────────────────────
      {
        q: 'Does it matter how fast I tap?',
        a: 'In Quiz Mode, yes. Answers within the target time count toward your score and streak. Faster answers make the book come back less often. Slower or wrong answers bring it back sooner.',
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
        q: 'How do I prepare for meetings?',
        a: 'In Box Mode, select the group that matches the weekly Bible reading program (e.g., "Pentateuch" or "Prophets"). That way you practice exactly the books that will come up, in a short session without affecting your FSRS schedule.',
      },
      {
        q: 'Which books are the hardest?',
        a: 'The 17 prophetic books are the toughest for most people — they sit close together in the grid. Extra practice on this group helps the most.',
      },
      {
        q: "What happens if I don't use the app for a while?",
        a: 'Nothing bad. There is no penalty for taking a break. When you come back the in-quiz "Due" counter will be higher than before — a backlog, not a debt. Just pick up where you left off, at your own pace. Your streak will reset, but your tier progress and best-streak record stay intact.',
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
        a: 'Yes. Adjust the target time via Settings → Training → Shared → "Target time per book". Lower it if too easy, raise it if you are often correct but marked as "too slow".',
      },

      // ─── Data, storage, sharing ─────────────────────────────────────
      {
        q: 'Is my progress saved?',
        a: "Yes, in your browser's local storage — separately per user. But all progress is lost if someone clears the browser data. Create regular backups via Settings → Data. When you restore a backup, your progress and personal preferences (language, learning pace, target speed, confident-book highlight) come with it, but device-specific settings (column counts, abbreviations, OT/NT layout) stay on the device you're restoring to. This way you can use the same backup on your phone, tablet, and PC without the screen-tuned settings of one device disturbing the others.",
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
        a: 'The Share button shares your progress as text with a link to the app — for example "I\'m confident on 33 out of 66 Bible books (10s) in the Bible Book Finder quiz!". On phone or tablet it opens your system share sheet so you can send to WhatsApp, email, etc.; on desktop it copies the message to your clipboard so you can paste it yourself. The speed in parentheses (e.g. "(10s)") is only included if you haven\'t changed your speed setting since you started (or since your last reset). If you switched to a different speed partway through, the speed is left out — otherwise it would be misleading, because your confident books are then a mix of different speeds. Want the speed back in your share message? Then reset your Quiz progress via Settings → Data → "🗑️ Reset Quiz progress". The reset re-couples your progress to your current speed, so everything you learn afterwards counts for that speed.',
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

      {/* v6 commit 8: "How it works" section. Explainer copy for the
          algorithm/UI concepts users were having to figure out on their
          own — gold line vs tier, the six tiers, what each answer does
          to FSRS scheduling, what the speed bar means, why breaks
          don't hurt. Five short sections, each with a heading and a
          body. Body strings use \\n\\n to separate paragraphs and lines
          starting with "• " are rendered as <ul> bullets. No accordion
          — the whole point is that users SEE this content rather than
          have it hidden behind a tap. */}
      <section className="help-section">
        <h3>{content.howItWorksTitle}</h3>
        <div className="how-it-works">
          {content.howItWorks.map((item, i) => (
            <div key={i} className="how-it-works-item">
              <h4 className="how-it-works-heading">{item.heading}</h4>
              {item.body.split('\n\n').map((chunk, j) => {
                if (chunk.trim().startsWith('• ')) {
                  return (
                    <ul key={j} className="how-it-works-list">
                      {chunk.split('\n').map((line, k) => (
                        <li key={k}>{line.replace(/^•\s*/, '')}</li>
                      ))}
                    </ul>
                  );
                }
                return <p key={j} className="how-it-works-body">{chunk}</p>;
              })}
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
