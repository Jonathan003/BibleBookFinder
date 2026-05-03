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
        icon: '🔄',
        text: 'Als je alle 66 boeken beheerst: reset je voortgang en begin opnieuw met een kortere snelheidslimiet (bijv. 7 seconden). Zo bouw je stap voor stap op.',
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
      // ─── Beginnen / Modi ────────────────────────────────────────────
      {
        q: 'Wat is het verschil tussen Studie Modus en Quiz Modus?',
        a: 'Studie Modus is om te leren zonder druk — kies groepen, oefen op je eigen tempo. Bij een fout antwoord licht het juiste boek blauw op. Quiz Modus test je snelheid en houdt je voortgang bij met herhaalritmes. Gebruik Studie om te leren, Quiz om te beheersen. Je kunt ook maar één modus gebruiken.',
      },
      {
        q: 'Wat betekenen Ontspannen, Gebalanceerd en Intensief?',
        a: 'Dit bepaalt hoe snel boeken terugkomen voor herhaling. Ontspannen = langere intervallen, kortere sessies. Intensief = kortere intervallen, vaker oefenen maar sneller leren. Je kunt dit altijd wijzigen via Instellingen.',
      },
      {
        q: 'Wat is het verschil tussen Gericht en Willekeurig?',
        a: 'Met Gericht (de standaard) verschijnen boeken waar je moeite mee hebt vaker in Studie Modus. Met Willekeurig heeft elk boek een gelijke kans. Te wijzigen via Instellingen.',
      },
      {
        q: 'Hoe bereid ik me voor op vergaderingen?',
        a: 'Selecteer in Studie Modus de groep(en) die bij het wekelijkse Bijbelleesprogramma horen. Zo oefen je precies de boeken die aan bod komen.',
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
        q: 'Kan ik een quiz pauzeren?',
        a: 'Ja. Tik op "← Terug" om je sessie-samenvatting te zien. Van daaruit kun je doorgaan, instellingen wijzigen, of de sessie beëindigen. Je score en streak blijven bewaard.',
      },
      {
        q: 'Hoe wordt mijn trainingstijd bijgehouden?',
        a: 'Per beantwoorde vraag tellen we hoe lang je erover deed, met een maximum van 30 seconden per vraag. Als je weggaat of in slaap valt, telt enkel die 30 seconden mee — zo wordt je totaal niet kunstmatig opgeblazen. Je totale trainingstijd zie je op het Tussenstand-scherm en in Instellingen → Data. "Voortgang resetten" zet ook de trainingstijd terug op nul.',
      },
      {
        q: 'Waarom komen mijn laatste paar boeken zo vaak terug?',
        a: 'Wanneer je nog 10 of minder boeken te beheersen hebt, schakelt de quiz over naar een eindfase-modus: 80% van de tijd krijg je een nog niet beheerst boek, 20% van de tijd een beheerst boek (voor onderhoud en variatie). Zo verdringen de tientallen reeds beheerste boeken die voor onderhoud terugkomen je laatste paar boeken niet voortdurend. Dezelfde aanpak gebruiken Anki-gebruikers handmatig met "Custom Study"-decks.',
      },
      {
        q: 'Wat betekent het "Nieuwe versie beschikbaar" balkje?',
        a: 'Wanneer er een nieuwere versie van de app is, verschijnt dit balkje op het startscherm. Tap "Nu vernieuwen" om de nieuwste versie te laden — je voortgang blijft gewoon bewaard. "Later" sluit het balkje voor deze sessie. De app controleert automatisch elk half uur of er een update is. In Instellingen → Data zie je onderaan welke versie en datum je momenteel gebruikt.',
      },

      // ─── Voortgang begrijpen ────────────────────────────────────────
      {
        q: 'Welke boeken zijn het moeilijkst?',
        a: 'De 17 profetische boeken zijn voor de meesten het lastigst — ze liggen dicht bij elkaar in het rooster. Extra oefening op deze groep helpt het meest.',
      },
      {
        q: 'Wat betekent "Klaar om te oefenen" op het startscherm?',
        a: 'Het toont hoeveel boeken het algoritme voorstelt om nu te herhalen — boeken die je nog niet hebt gezien en boeken waarvan het herhaalinterval is verlopen. Een handig richtgetal voor regelmaat. Maar of je vandaag eindigt op 0 of op 11 maakt voor je langetermijngeheugen niet uit; één dag uitstellen is geen probleem. Wel goed om niet meerdere dagen achter elkaar over te slaan, anders loopt het op.',
      },
      {
        q: 'Wat is de gouden lijn onder sommige boeken?',
        a: 'Dat geeft aan dat je het boek beheerst — het algoritme beschouwt het als stabiel in je geheugen. Aan of uit te zetten via Instellingen.',
      },
      {
        q: 'Wat als ik de app lang niet gebruik?',
        a: 'Geen probleem. Er is geen straf voor een pauze. Wanneer je terugkomt staan er meer boeken als "Klaar om te oefenen". Pak gewoon op waar je gebleven was.',
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
        a: 'De Delen-knop deelt je voortgang als tekst met een link naar de app — bijvoorbeeld "Ik heb 33 van 66 bijbelboeken beheerst (10s) in de Bijbelboek Zoeker quiz!". Op telefoon of tablet opent je systeem-deelmenu zodat je naar WhatsApp, e-mail enzovoort kunt sturen; op desktop wordt het bericht naar je klembord gekopieerd zodat je het zelf kunt plakken. De snelheid tussen haakjes (bijv. "(10s)") wordt alleen meegenomen als je de snelheidslimiet niet hebt gewijzigd sinds je bent begonnen (of sinds je laatste reset). Als je halverwege bent overgestapt naar een andere snelheid, wordt de snelheid weggelaten — anders zou het misleidend zijn, want je beheerste boeken zijn dan een mix van verschillende snelheden. Wil je de snelheid weer terug in je deelbericht? Dan moet je je voortgang resetten via "🗑️ Voortgang wissen". De reset koppelt je voortgang opnieuw aan je huidige snelheid, dus alles wat je daarna beheerst telt voor die snelheid.',
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
        icon: '🔄',
        text: 'Once you\'ve mastered all 66 books: reset your progress and start again with a shorter mastery speed (e.g. 7 seconds). This way you build up step by step.',
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
      // ─── Getting started / Modes ────────────────────────────────────
      {
        q: 'What is the difference between Study Mode and Quiz Mode?',
        a: 'Study Mode is for learning without pressure — pick groups, practice at your own pace. When you tap wrong, the correct book lights up blue. Quiz Mode tests your speed and tracks progress with spaced repetition. Use Study to learn, Quiz to master. You can also use just one mode.',
      },
      {
        q: 'What do Relaxed, Balanced, and Intensive mean?',
        a: 'This controls how often books come back for review. Relaxed means longer intervals and shorter sessions. Intensive means shorter intervals — you practice more often but learn faster. You can change this anytime in Settings.',
      },
      {
        q: 'What is the difference between Focused and Random?',
        a: 'With Focused (the default), books you struggle with appear more often in Study Mode. With Random, every book has an equal chance. You can change this in Settings.',
      },
      {
        q: 'How do I prepare for meetings?',
        a: 'In Study Mode, select the group(s) that match the weekly Bible reading program. This way you practice exactly the books that will come up.',
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
        q: 'Can I pause a quiz session?',
        a: 'Yes. Tap "← Back" to see your session summary. From there you can resume, change settings, or end the session. Your score and streak are preserved.',
      },
      {
        q: 'How is my training time tracked?',
        a: 'For each answered question we count how long you took, capped at 30 seconds per question. If you walk away or fall asleep, only 30 seconds count for that question — so your total isn\'t artificially inflated. Your total training time appears on the Stats so far screen and in Settings → Data. "Reset progress" also wipes the training-time counter.',
      },
      {
        q: 'Why are my last few books showing up so often?',
        a: 'Once you have 10 or fewer books left to master, the quiz switches into a finish-line mode: 80% of the time you\'ll get a not-yet-mastered book, 20% of the time a mastered book (for maintenance and variety). This keeps the dozens of already-mastered books coming up for maintenance reviews from constantly burying your last few unmastered books. This is the same pattern Anki users apply manually with "Custom Study" filtered decks.',
      },
      {
        q: 'What does the "New version available" banner mean?',
        a: 'When a newer version of the app is available, this banner appears on the home screen. Tap "Update now" to load the latest version — your progress stays intact. "Later" dismisses the banner for this session. The app automatically checks for updates every half hour. In Settings → Data, the bottom shows which version and date you\'re currently running.',
      },

      // ─── Understanding progress ─────────────────────────────────────
      {
        q: 'Which books are the hardest?',
        a: 'The 17 prophetic books are the toughest for most people — they sit close together in the grid. Extra practice on this group helps the most.',
      },
      {
        q: 'What does "Ready to practice" mean on the home screen?',
        a: 'It shows how many books the algorithm suggests you review now — unseen books and books whose review interval has passed. A useful number for keeping a regular rhythm. But whether you finish today on 0 or on 11 doesn\'t matter for your long-term memory; postponing one day is no problem. Just don\'t skip many days in a row, otherwise it piles up.',
      },
      {
        q: 'What is the gold line at the bottom of some book cells?',
        a: 'That indicates a mastered book — the algorithm considers it stable in your memory. Toggle it on or off in Settings.',
      },
      {
        q: "What happens if I don't use the app for a while?",
        a: 'Nothing bad. There is no penalty for taking a break. When you come back, more books will show as "Ready to practice". Just pick up where you left off.',
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
        a: 'The Share button shares your progress as text with a link to the app — for example "I mastered 33 out of 66 Bible books (10s) in the Bible Book Finder quiz!". On phone or tablet it opens your system share sheet so you can send to WhatsApp, email, etc.; on desktop it copies the message to your clipboard so you can paste it yourself. The speed in parentheses (e.g. "(10s)") is only included if you haven\'t changed your mastery speed since you started (or since your last reset). If you switched to a different speed partway through, the speed is left out — otherwise it would be misleading, because your mastered books are then a mix of different speeds. Want the speed back in your share message? Then reset your progress via "🗑️ Reset Progress". The reset re-couples your progress to your current speed, so everything you master afterwards counts for that speed.',
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
