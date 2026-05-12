export const bibleBooks = [
  // HEBREEUWS-ARAMESE GESCHRIFTEN / HEBREW-ARAMAIC SCRIPTURES (39 books)
  // Each book has TWO abbreviations:
  //   - nlAbbr / enAbbr      = short (JW Library portrait style: "Ge", "1Sa")
  //   - nlAbbrLong / enAbbrLong = long  (JW Library landscape style: "Gen.", "1 Sam.")
  // useGridLayout selects the right one based on orientation.
  //
  // Pentateuch (5) — dark shade
  { id: 1, nl: 'Genesis', en: 'Genesis', nlAbbr: 'Ge', enAbbr: 'Ge', nlAbbrLong: 'Gen.', enAbbrLong: 'Gen.', testament: 'OT', group: 'law' },
  { id: 2, nl: 'Exodus', en: 'Exodus', nlAbbr: 'Ex', enAbbr: 'Ex', nlAbbrLong: 'Ex.', enAbbrLong: 'Ex.', testament: 'OT', group: 'law' },
  { id: 3, nl: 'Leviticus', en: 'Leviticus', nlAbbr: 'Le', enAbbr: 'Le', nlAbbrLong: 'Lev.', enAbbrLong: 'Lev.', testament: 'OT', group: 'law' },
  { id: 4, nl: 'Numeri', en: 'Numbers', nlAbbr: 'Nu', enAbbr: 'Nu', nlAbbrLong: 'Num.', enAbbrLong: 'Num.', testament: 'OT', group: 'law' },
  { id: 5, nl: 'Deuteronomium', en: 'Deuteronomy', nlAbbr: 'De', enAbbr: 'De', nlAbbrLong: 'Deut.', enAbbrLong: 'Deut.', testament: 'OT', group: 'law' },
  // Historical books (12) — light shade
  { id: 6, nl: 'Jozua', en: 'Joshua', nlAbbr: 'Joz', enAbbr: 'Jos', nlAbbrLong: 'Joz.', enAbbrLong: 'Josh.', testament: 'OT', group: 'history' },
  { id: 7, nl: 'Rechters', en: 'Judges', nlAbbr: 'Re', enAbbr: 'Jg', nlAbbrLong: 'Recht.', enAbbrLong: 'Judg.', testament: 'OT', group: 'history' },
  { id: 8, nl: 'Ruth', en: 'Ruth', nlAbbr: 'Ru', enAbbr: 'Ru', nlAbbrLong: 'Ruth', enAbbrLong: 'Ruth', testament: 'OT', group: 'history' },
  { id: 9, nl: '1 Samuël', en: '1 Samuel', nlAbbr: '1Sa', enAbbr: '1Sa', nlAbbrLong: '1 Sam.', enAbbrLong: '1 Sam.', testament: 'OT', group: 'history' },
  { id: 10, nl: '2 Samuël', en: '2 Samuel', nlAbbr: '2Sa', enAbbr: '2Sa', nlAbbrLong: '2 Sam.', enAbbrLong: '2 Sam.', testament: 'OT', group: 'history' },
  { id: 11, nl: '1 Koningen', en: '1 Kings', nlAbbr: '1Kon', enAbbr: '1Ki', nlAbbrLong: '1 Kon.', enAbbrLong: '1 Ki.', testament: 'OT', group: 'history' },
  { id: 12, nl: '2 Koningen', en: '2 Kings', nlAbbr: '2Kon', enAbbr: '2Ki', nlAbbrLong: '2 Kon.', enAbbrLong: '2 Ki.', testament: 'OT', group: 'history' },
  { id: 13, nl: '1 Kronieken', en: '1 Chronicles', nlAbbr: '1Kr', enAbbr: '1Ch', nlAbbrLong: '1 Kron.', enAbbrLong: '1 Chron.', testament: 'OT', group: 'history' },
  { id: 14, nl: '2 Kronieken', en: '2 Chronicles', nlAbbr: '2Kr', enAbbr: '2Ch', nlAbbrLong: '2 Kron.', enAbbrLong: '2 Chron.', testament: 'OT', group: 'history' },
  { id: 15, nl: 'Ezra', en: 'Ezra', nlAbbr: 'Ezr', enAbbr: 'Ezr', nlAbbrLong: 'Ezra', enAbbrLong: 'Ezra', testament: 'OT', group: 'history' },
  { id: 16, nl: 'Nehemia', en: 'Nehemiah', nlAbbr: 'Ne', enAbbr: 'Ne', nlAbbrLong: 'Neh.', enAbbrLong: 'Neh.', testament: 'OT', group: 'history' },
  { id: 17, nl: 'Esther', en: 'Esther', nlAbbr: 'Es', enAbbr: 'Es', nlAbbrLong: 'Esth.', enAbbrLong: 'Esther', testament: 'OT', group: 'history' },
  // Poetic books (5) — medium shade
  { id: 18, nl: 'Job', en: 'Job', nlAbbr: 'Job', enAbbr: 'Job', nlAbbrLong: 'Job', enAbbrLong: 'Job', testament: 'OT', group: 'poetry' },
  { id: 19, nl: 'Psalmen', en: 'Psalms', nlAbbr: 'Ps', enAbbr: 'Ps', nlAbbrLong: 'Ps.', enAbbrLong: 'Ps.', testament: 'OT', group: 'poetry' },
  { id: 20, nl: 'Spreuken', en: 'Proverbs', nlAbbr: 'Sp', enAbbr: 'Pr', nlAbbrLong: 'Spr.', enAbbrLong: 'Prov.', testament: 'OT', group: 'poetry' },
  { id: 21, nl: 'Prediker', en: 'Ecclesiastes', nlAbbr: 'Pr', enAbbr: 'Ec', nlAbbrLong: 'Pred.', enAbbrLong: 'Eccl.', testament: 'OT', group: 'poetry' },
  { id: 22, nl: 'Hooglied', en: 'Song of Solomon', nlAbbr: 'Hgl', enAbbr: 'Ca', nlAbbrLong: 'Hoogl.', enAbbrLong: 'Song of Sol.', testament: 'OT', group: 'poetry' },
  // Prophetic books (17) — darkest shade
  { id: 23, nl: 'Jesaja', en: 'Isaiah', nlAbbr: 'Jes', enAbbr: 'Isa', nlAbbrLong: 'Jes.', enAbbrLong: 'Isa.', testament: 'OT', group: 'prophets' },
  { id: 24, nl: 'Jeremia', en: 'Jeremiah', nlAbbr: 'Jer', enAbbr: 'Jer', nlAbbrLong: 'Jer.', enAbbrLong: 'Jer.', testament: 'OT', group: 'prophets' },
  { id: 25, nl: 'Klaagliederen', en: 'Lamentations', nlAbbr: 'Klg', enAbbr: 'La', nlAbbrLong: 'Klaagl.', enAbbrLong: 'Lam.', testament: 'OT', group: 'prophets' },
  { id: 26, nl: 'Ezechiël', en: 'Ezekiel', nlAbbr: 'Ez', enAbbr: 'Eze', nlAbbrLong: 'Ezech.', enAbbrLong: 'Ezek.', testament: 'OT', group: 'prophets' },
  { id: 27, nl: 'Daniël', en: 'Daniel', nlAbbr: 'Da', enAbbr: 'Da', nlAbbrLong: 'Dan.', enAbbrLong: 'Dan.', testament: 'OT', group: 'prophets' },
  { id: 28, nl: 'Hosea', en: 'Hosea', nlAbbr: 'Ho', enAbbr: 'Ho', nlAbbrLong: 'Hos.', enAbbrLong: 'Hos.', testament: 'OT', group: 'prophets' },
  { id: 29, nl: 'Joël', en: 'Joel', nlAbbr: 'Joë', enAbbr: 'Joe', nlAbbrLong: 'Joël', enAbbrLong: 'Joel', testament: 'OT', group: 'prophets' },
  { id: 30, nl: 'Amos', en: 'Amos', nlAbbr: 'Am', enAbbr: 'Am', nlAbbrLong: 'Amos', enAbbrLong: 'Amos', testament: 'OT', group: 'prophets' },
  { id: 31, nl: 'Obadja', en: 'Obadiah', nlAbbr: 'Ob', enAbbr: 'Ob', nlAbbrLong: 'Obad.', enAbbrLong: 'Obad.', testament: 'OT', group: 'prophets' },
  { id: 32, nl: 'Jona', en: 'Jonah', nlAbbr: 'Jon', enAbbr: 'Jon', nlAbbrLong: 'Jona', enAbbrLong: 'Jonah', testament: 'OT', group: 'prophets' },
  { id: 33, nl: 'Micha', en: 'Micah', nlAbbr: 'Mi', enAbbr: 'Mic', nlAbbrLong: 'Micha', enAbbrLong: 'Mic.', testament: 'OT', group: 'prophets' },
  { id: 34, nl: 'Nahum', en: 'Nahum', nlAbbr: 'Na', enAbbr: 'Na', nlAbbrLong: 'Nah.', enAbbrLong: 'Nah.', testament: 'OT', group: 'prophets' },
  { id: 35, nl: 'Habakuk', en: 'Habakkuk', nlAbbr: 'Hab', enAbbr: 'Hab', nlAbbrLong: 'Hab.', enAbbrLong: 'Hab.', testament: 'OT', group: 'prophets' },
  { id: 36, nl: 'Zefanja', en: 'Zephaniah', nlAbbr: 'Ze', enAbbr: 'Zep', nlAbbrLong: 'Zef.', enAbbrLong: 'Zeph.', testament: 'OT', group: 'prophets' },
  { id: 37, nl: 'Haggaï', en: 'Haggai', nlAbbr: 'Hag', enAbbr: 'Hag', nlAbbrLong: 'Hag.', enAbbrLong: 'Hag.', testament: 'OT', group: 'prophets' },
  { id: 38, nl: 'Zacharia', en: 'Zechariah', nlAbbr: 'Za', enAbbr: 'Zec', nlAbbrLong: 'Zach.', enAbbrLong: 'Zech.', testament: 'OT', group: 'prophets' },
  { id: 39, nl: 'Maleachi', en: 'Malachi', nlAbbr: 'Mal', enAbbr: 'Mal', nlAbbrLong: 'Mal.', enAbbrLong: 'Mal.', testament: 'OT', group: 'prophets' },
  // CHRISTELIJKE GRIEKSE GESCHRIFTEN / CHRISTIAN GREEK SCRIPTURES (27 books)
  // Gospels (4) — dark shade (same as law)
  { id: 40, nl: 'Mattheüs', en: 'Matthew', nlAbbr: 'Mt', enAbbr: 'Mt', nlAbbrLong: 'Matth.', enAbbrLong: 'Matt.', testament: 'NT', group: 'gospels' },
  { id: 41, nl: 'Markus', en: 'Mark', nlAbbr: 'Mr', enAbbr: 'Mr', nlAbbrLong: 'Mark.', enAbbrLong: 'Mark', testament: 'NT', group: 'gospels' },
  { id: 42, nl: 'Lukas', en: 'Luke', nlAbbr: 'Lu', enAbbr: 'Lu', nlAbbrLong: 'Luk.', enAbbrLong: 'Luke', testament: 'NT', group: 'gospels' },
  { id: 43, nl: 'Johannes', en: 'John', nlAbbr: 'Jo', enAbbr: 'Joh', nlAbbrLong: 'Joh.', enAbbrLong: 'John', testament: 'NT', group: 'gospels' },
  // Acts (1) — light shade (same as history)
  { id: 44, nl: 'Handelingen', en: 'Acts', nlAbbr: 'Han', enAbbr: 'Ac', nlAbbrLong: 'Hand.', enAbbrLong: 'Acts', testament: 'NT', group: 'acts' },
  // Letters (21) — medium shade (same as poetry)
  { id: 45, nl: 'Romeinen', en: 'Romans', nlAbbr: 'Ro', enAbbr: 'Ro', nlAbbrLong: 'Rom.', enAbbrLong: 'Rom.', testament: 'NT', group: 'epistles' },
  { id: 46, nl: '1 Korinthiërs', en: '1 Corinthians', nlAbbr: '1Kor', enAbbr: '1Co', nlAbbrLong: '1 Kor.', enAbbrLong: '1 Cor.', testament: 'NT', group: 'epistles' },
  { id: 47, nl: '2 Korinthiërs', en: '2 Corinthians', nlAbbr: '2Kor', enAbbr: '2Co', nlAbbrLong: '2 Kor.', enAbbrLong: '2 Cor.', testament: 'NT', group: 'epistles' },
  { id: 48, nl: 'Galaten', en: 'Galatians', nlAbbr: 'Ga', enAbbr: 'Ga', nlAbbrLong: 'Gal.', enAbbrLong: 'Gal.', testament: 'NT', group: 'epistles' },
  { id: 49, nl: 'Efeziërs', en: 'Ephesians', nlAbbr: 'Ef', enAbbr: 'Eph', nlAbbrLong: 'Ef.', enAbbrLong: 'Eph.', testament: 'NT', group: 'epistles' },
  { id: 50, nl: 'Filippenzen', en: 'Philippians', nlAbbr: 'Fil', enAbbr: 'Php', nlAbbrLong: 'Fil.', enAbbrLong: 'Phil.', testament: 'NT', group: 'epistles' },
  { id: 51, nl: 'Kolossenzen', en: 'Colossians', nlAbbr: 'Kol', enAbbr: 'Col', nlAbbrLong: 'Kol.', enAbbrLong: 'Col.', testament: 'NT', group: 'epistles' },
  { id: 52, nl: '1 Thessalonicenzen', en: '1 Thessalonians', nlAbbr: '1Th', enAbbr: '1Th', nlAbbrLong: '1 Thess.', enAbbrLong: '1 Thess.', testament: 'NT', group: 'epistles' },
  { id: 53, nl: '2 Thessalonicenzen', en: '2 Thessalonians', nlAbbr: '2Th', enAbbr: '2Th', nlAbbrLong: '2 Thess.', enAbbrLong: '2 Thess.', testament: 'NT', group: 'epistles' },
  { id: 54, nl: '1 Timotheüs', en: '1 Timothy', nlAbbr: '1Ti', enAbbr: '1Ti', nlAbbrLong: '1 Tim.', enAbbrLong: '1 Tim.', testament: 'NT', group: 'epistles' },
  { id: 55, nl: '2 Timotheüs', en: '2 Timothy', nlAbbr: '2Ti', enAbbr: '2Ti', nlAbbrLong: '2 Tim.', enAbbrLong: '2 Tim.', testament: 'NT', group: 'epistles' },
  { id: 56, nl: 'Titus', en: 'Titus', nlAbbr: 'Tit', enAbbr: 'Tit', nlAbbrLong: 'Tit.', enAbbrLong: 'Titus', testament: 'NT', group: 'epistles' },
  { id: 57, nl: 'Filemon', en: 'Philemon', nlAbbr: 'Flm', enAbbr: 'Phm', nlAbbrLong: 'Filem.', enAbbrLong: 'Philem.', testament: 'NT', group: 'epistles' },
  { id: 58, nl: 'Hebreeën', en: 'Hebrews', nlAbbr: 'Heb', enAbbr: 'Heb', nlAbbrLong: 'Hebr.', enAbbrLong: 'Heb.', testament: 'NT', group: 'epistles' },
  { id: 59, nl: 'Jakobus', en: 'James', nlAbbr: 'Jak', enAbbr: 'Jas', nlAbbrLong: 'Jak.', enAbbrLong: 'Jas.', testament: 'NT', group: 'epistles' },
  { id: 60, nl: '1 Petrus', en: '1 Peter', nlAbbr: '1Pe', enAbbr: '1Pe', nlAbbrLong: '1 Petr.', enAbbrLong: '1 Pet.', testament: 'NT', group: 'epistles' },
  { id: 61, nl: '2 Petrus', en: '2 Peter', nlAbbr: '2Pe', enAbbr: '2Pe', nlAbbrLong: '2 Petr.', enAbbrLong: '2 Pet.', testament: 'NT', group: 'epistles' },
  { id: 62, nl: '1 Johannes', en: '1 John', nlAbbr: '1Jo', enAbbr: '1Jo', nlAbbrLong: '1 Joh.', enAbbrLong: '1 John', testament: 'NT', group: 'epistles' },
  { id: 63, nl: '2 Johannes', en: '2 John', nlAbbr: '2Jo', enAbbr: '2Jo', nlAbbrLong: '2 Joh.', enAbbrLong: '2 John', testament: 'NT', group: 'epistles' },
  { id: 64, nl: '3 Johannes', en: '3 John', nlAbbr: '3Jo', enAbbr: '3Jo', nlAbbrLong: '3 Joh.', enAbbrLong: '3 John', testament: 'NT', group: 'epistles' },
  { id: 65, nl: 'Judas', en: 'Jude', nlAbbr: 'Ju', enAbbr: 'Jude', nlAbbrLong: 'Jud.', enAbbrLong: 'Jude', testament: 'NT', group: 'epistles' },
  // Revelation (1) — darkest shade (same as prophets)
  { id: 66, nl: 'Openbaring', en: 'Revelation', nlAbbr: 'Opb', enAbbr: 'Re', nlAbbrLong: 'Openb.', enAbbrLong: 'Rev.', testament: 'NT', group: 'revelation' },
];

// 4 color shades from JW Library Study Bible screenshots
// OT: law=dark, history=light, poetry=medium, prophets=darkest
// NT: gospels=dark, acts=light, epistles=medium, revelation=darkest
export const groupColors = {
  law:        { normal: '#3C384C', hover: '#2E2A3D', active: '#201C2E' },
  history:    { normal: '#847898', hover: '#6E6282', active: '#5A4E70' },
  poetry:     { normal: '#5E576E', hover: '#4A4358', active: '#3A3448' },
  prophets:   { normal: '#2E2840', hover: '#231D35', active: '#181228' },
  gospels:    { normal: '#3C384C', hover: '#2E2A3D', active: '#201C2E' },
  acts:       { normal: '#847898', hover: '#6E6282', active: '#5A4E70' },
  epistles:   { normal: '#5E576E', hover: '#4A4358', active: '#3A3448' },
  revelation: { normal: '#2E2840', hover: '#231D35', active: '#181228' },
};

// Descriptions sourced from NWT "The 66 Books of the Bible" (jw.org)
export const groupNames = {
  nl: {
    law: 'Pentateuch (5 boeken) — Van de schepping tot de vorming van de natie Israël',
    history: 'Historische boeken (12 boeken) — Israëls intocht in het beloofde land en de geschiedenis van de natie tot na de ballingschap',
    poetry: 'Poëtische boeken (5 boeken) — Wijze uitspraken en liederen',
    prophets: 'Profetische boeken (17 boeken) — Profetieën (voorspellingen) over Gods volk',
    gospels: 'De Evangeliën (4 boeken) — Jezus\' leven en dienst',
    acts: 'Handelingen van apostelen (1 boek) — De geschiedenis van het ontstaan van de christelijke gemeente en van het zendingswerk',
    epistles: 'Brieven (21 boeken) — Brieven aan christelijke gemeenten en aan afzonderlijke christenen',
    revelation: 'Openbaring (1 boek) — Profetische visioenen die aan de apostel Johannes werden gegeven',
  },
  en: {
    law: 'Pentateuch (5 books) — From creation to the founding of the ancient nation of Israel',
    history: 'Historical books (12 books) — Israel\'s entry into the Promised Land and the history of the nation through and after the exile',
    poetry: 'Poetic books (5 books) — Collections of wise sayings and songs',
    prophets: 'Prophetic books (17 books) — Prophecies, or predictions, concerning God\'s people',
    gospels: 'The four Gospels (4 books) — History of Jesus\' life and ministry',
    acts: 'Acts of Apostles (1 book) — History of the start of the Christian congregation and missionary activity',
    epistles: 'Letters (21 books) — Letters to Christian congregations and to individual Christians',
    revelation: 'Revelation (1 book) — Series of prophetic visions given to the apostle John',
  }
};

// Pick the right book name string for a given displayMode + language.
// Modes:
//   'full'  → full localized name (e.g. 'Genesis', 'Numeri')
//   'long'  → long abbreviation  (e.g. 'Gen.', '1 Sam.')
//   'short' → short abbreviation (e.g. 'Ge', '1Sa')
// Falls back to full name if displayMode is unknown.
export function getBookDisplayName(book, displayMode, lang) {
  if (displayMode === 'short') return lang === 'nl' ? book.nlAbbr     : book.enAbbr;
  if (displayMode === 'long')  return lang === 'nl' ? book.nlAbbrLong : book.enAbbrLong;
  return lang === 'nl' ? book.nl : book.en;
}

export const translations = {
  nl: {
    title: 'Bijbelboek Zoeker',
    subtitle: 'Leer waar de boeken zich bevinden',
    // UserSelect screen
    noUsers: 'Nog geen gebruikers. Voeg jezelf toe!',
    namePlaceholder: 'Je naam...',
    addBtn: 'Toevoegen',
    addUser: 'Gebruiker toevoegen',
    deleteTitle: 'Verwijderen',
    confirmDelete: 'Verwijder',
    confirmDeleteMsg: '{name} en alle voortgang verwijderen?',
    cancelDelete: 'Annuleer',
    confirmReset: 'Wissen',
    confirmResetMsg: 'Weet je zeker dat je je voortgang wilt wissen? Dit kan niet ongedaan worden gemaakt.',
    confirmResetQuizMsg: 'Weet je zeker dat je Quiz-voortgang wilt wissen? Mastery, intervallen, streak, persoonlijke records en geschiedenis worden gewist. Doos-records blijven staan. Dit kan niet ongedaan worden gemaakt.',
    confirmResetBoxMsg: 'Weet je zeker dat je Doos-voortgang wilt wissen? Alle persoonlijke records per selectie worden gewist. Quiz-voortgang blijft staan. Dit kan niet ongedaan worden gemaakt.',
    cancelReset: 'Annuleer',
    // Reset section in Settings → Data (where the Reset buttons live now)
    resetSectionTitle: 'Voortgang resetten',
    resetSectionDesc: 'Wis je voortgang per modus. Dit kan niet ongedaan worden gemaakt.',
    confirmImport: 'Herstel',
    cancelImport: 'Annuleer',
    confirmImportMsg: 'Dit overschrijft jouw huidige voortgang en voorkeuren. Apparaat-specifieke instellingen (kolommen, afkortingen, OT/NT layout) blijven van dit toestel.',
    confirmImportCrossMsg: '⚠️ Deze back-up is van "{backup}", je bent ingelogd als "{current}". Dit overschrijft {current}\'s voortgang en voorkeuren met die van {backup}. Apparaat-specifieke instellingen blijven van dit toestel.',
    errorMaxUsers: 'Maximum 10 gebruikers bereikt',
    errorDuplicate: 'Deze naam bestaat al',
    quizMode: 'Quiz Modus',
    // v4.8: subtitles shown on the home-screen mode-cards under the
    // emoji + label. Give each card content that justifies the wider
    // container at desktop sizes, AND tell newcomers what each mode
    // actually does so they can pick the right one without playing
    // both first.
    boxModeSubtitle: 'Snel sorteren tegen de klok',
    quizModeSubtitle: 'Lange-termijn herhaling',
    score: 'Score',
    streak: 'Streak',
    of: 'van',
    tooSlow: 'Te traag',
    hebrewSection: 'HEBREEUWS-ARAMESE GESCHRIFTEN',
    greekSection: 'CHRISTELIJKE GRIEKSE GESCHRIFTEN',
    correct: 'Goed!',
    wrong: 'Verkeerd',
    share: 'Delen',
    resetQuizProgress: 'Quiz-voortgang wissen',
    resetBoxProgress: 'Doos-voortgang wissen',
    back: 'Terug',
    settingsTitle: 'Instellingen',
    gridTab: 'Raster',
    quizTab: 'Training',
    gridTitle: 'Raster',
    gridDesc: 'Kolommen en schermstand.',
    portrait: 'Portret',
    portraitDesc: '(rechtop)',
    landscape: 'Liggend',
    landscapeDesc: '(gedraaid)',
    orientation: 'Schermstand',
    orientationDesc: '(forceer of automatisch)',
    testamentsLayout: 'OT/NT layout (liggend)',
    testamentsLayoutDesc: '(naast of onder elkaar)',
    layoutStacked: 'Onder elkaar',
    layoutSideBySide: 'Naast elkaar',
    landscapeOT: 'Liggend OT',
    landscapeOTDesc: '(kolommen voor Hebreeuws-Aramees)',
    landscapeNT: 'Liggend NT',
    landscapeNTDesc: '(kolommen voor Christelijk Grieks)',
    auto: 'Automatisch',
    portraitMode: 'Portret',
    landscapeMode: 'Liggend',
    masterySpeed: 'Meesterschapssnelheid',
    masterySpeedDesc: '(antwoord binnen deze tijd = beheerst)',
    fast: 'Snel',
    slow: 'Rustig',
    highlightFound: 'Beheerste boeken',
    highlightFoundDesc: '(markeer boeken die je beheerst)',
    autoScroll: 'Automatisch scrollen',
    autoScrollDesc: '(scroll naar het gevraagde boek bij elke vraag)',
    theme: 'Thema',
    themeDesc: '(licht of donker)',
    themeAuto: 'Auto (systeem)',
    themeLight: 'Licht',
    themeDark: 'Donker',
    dataTab: 'Data',
    dataTitle: 'Back-up',
    dataDesc: 'Maak of herstel een back-up van je voortgang en instellingen.',
    exportBtn: '📥 Maak back-up',
    importBtn: '📤 Herstel back-up',
    exportSuccess: 'Back-up gedownload!',
    importSuccess: 'Back-up hersteld!',
    importError: 'Ongeldig bestand.',
    importWarning: '⚠️ Herstellen overschrijft jouw voortgang en voorkeuren. Apparaat-specifieke instellingen (kolommen, afkortingen, OT/NT layout) blijven van dit toestel.',
    hintReveal: 'Hint:',
    // Dashboard stat label. v4 renamed from "Beheerst" (FSRS-mastery) to
    // "Zeker" (the in-session confident gold-line signal). `mastered` is
    // kept as a backward-compat alias for any remaining call sites and
    // for backup imports that still reference the old word.
    confident: 'Zeker',
    mastered: 'Beheerst',
    abbreviationsPortrait: 'Afkortingen (portret)',
    abbreviationsPortraitDesc: '(rechtop)',
    abbreviationsLandscape: 'Afkortingen (liggend)',
    abbreviationsLandscapeDesc: '(gedraaid)',
    abbrAuto: 'Automatisch',
    abbrFull: 'Volle namen',
    abbrLong: 'Lange afkortingen',
    abbrShort: 'Korte afkortingen',
    learningPace: 'Leertempo',
    learningPaceDesc: '',
    paceFlexible: 'Flexibel',
    paceRelaxed: 'Ontspannen',
    paceBalanced: 'Gebalanceerd',
    paceIntensive: 'Intensief',
    paceFlexibleHint: 'Lichtste schema — kom wanneer je tijd hebt, geen dagelijkse druk',
    paceRelaxedHint: 'Boeken komen minder vaak terug — ideaal als je af en toe oefent',
    paceBalancedHint: 'Aanbevolen — goede balans tussen inspanning en voortgang',
    paceIntensiveHint: 'Boeken komen vaak terug — ideaal als je regelmatig oefent',
    // Session-size keys for the Quiz Mode home-screen launcher.
    // The user picks how many books they want to practice now:
    //   sessionSizeQuick    — 5 most-overdue (capped at remaining)
    //   sessionSizeStandard — 10 most-overdue (capped at remaining)
    //   sessionSizeFull     — all currently due, no cap
    // The number after the dot is filled in at render time from the
    // actual due-list size, so the user sees the real commitment up
    // front rather than an abstract "Quick" label.
    sessionSizeQuick: 'Snel',
    sessionSizeStandard: 'Normaal',
    sessionSizeFull: 'Volledig',
    sessionSizeBooks: 'boeken',
    sessionSizeBookSingle: 'boek',
    sessionSizeMinutes: 'min',
    // Two keys exist for the same FSRS due-count by design — this is
    // intentional and should NOT be unified:
    //   - readyToPractice ("Klaar om te oefenen") is the home-menu label.
    //     It frames the count as a preparation invitation: "here's what's
    //     waiting for you when you start a session".
    //   - due ("Te doen") is the in-quiz / Train-Ahead label. It frames
    //     the same count as a session countdown: "this is how many books
    //     remain in the current run". "Klaar om te oefenen" inside the
    //     quiz would read oddly — you ARE practicing.
    // Help.jsx has a dedicated FAQ entry explaining both terms refer to
    // the same number, just in different contexts.
    due: 'Te doen',
    readyToPractice: 'Klaar om te oefenen',
    practiced: 'Geoefend',
    allBooks: 'Alle boeken',
    book: 'boek',
    books: 'boeken',
    wrongShowCorrect: 'Fout — kijk naar het blauwe vakje!',
    // Total training time label (shared across Settings, Stats screen, share)
    totalTrainingTime: 'Totale trainingstijd',
    // ─── All-66 celebration screen (v4) ───────────────────────────────
    // Shown on the home screen when confidentCount === 66 — the
    // race-to-all-gold goal of the v4 model. Replaces the 2.5s overlay
    // banner with a persistent finishing screen.
    celebration66Title: 'Alle 66 boeken zeker! 🎉',
    celebration66Body: 'Je kent alle bijbelboeken vlot uit het hoofd. Top resultaat!',
    celebrationTimeLabel: 'Totale tijd:',
    celebration66Reset: 'Start een nieuwe ronde',
    celebration66ResetConfirm: 'Tik nogmaals om voortgang te wissen',
    // ─── Pause / resume + dashboard remaining-to-gold (v4 commit 4) ───
    // Resume CTA on the home screen when a paused session exists. The
    // user tapped "← Back" mid-session; we kept the snapshot. Discard
    // wipes it without starting a new run. "Naar goud" = the dashboard
    // counter showing how many books still need a gold line.
    resumeSession: 'Sessie hervatten',
    resumeSessionDesc: 'Ga verder waar je gebleven was',
    discardPausedSession: 'Onderbroken sessie weggooien',
    toGold: 'naar goud',
    // ─── Box Mode dashboard (v4.1, labels improved v4.4) ────────
    // Stat-card labels for the redesigned Box panel. Renamed in v4.4
    // because "1 cleared of 9, 8 to go" wasn't clear — "cleared" is
    // jargon and "to go" doesn't say what's being gone to. The new
    // "X of 9 played" / "Y left to play" is self-explanatory.
    // allScopesCleared celebration appears when all 9 scopes have at
    // least one recorded completion.
    scopesCleared: 'voltooid',
    scopesToGo: 'nog te doen',
    scopesPlayedOf: 'van {total} gespeeld',
    scopesLeftToPlay: 'nog te spelen',
    boxBestTimesHeader: 'Beste tijden',
    boxNotYetPlayed: 'Nog niet gespeeld',
    boxAllScopesClearedTitle: 'Alle groepen voltooid! 🎉',
    boxAllScopesClearedBody: 'Je hebt elke groep minstens één keer uitgespeeld.',
    // Restore confirmation dialog
    restoreTitle: 'Back-up herstellen',
    restoreWarning: 'Dit vervangt je huidige voortgang. Deze actie kan niet ongedaan gemaakt worden.',
    restoreCurrent: 'Huidig',
    restoreIncoming: 'Back-up',
    restoreMastered: 'beheerst',
    restoreContinue: 'Doorgaan',
    restoreCancel: 'Annuleren',
    // Update banner
    updateAvailable: 'Nieuwe versie beschikbaar',
    updateNow: 'Nu vernieuwen',
    updateDismiss: 'Later',
    // Personal best
    newBest: 'Nieuw record!',
    // Tiers — discrete progression labels derived from FSRS card state
    // (see src/fsrs.js getTier). Names chosen to read as a natural
    // ladder for Dutch speakers. v4 renamed the old 'beheerst' tier to
    // 'geworteld' so the word 'beheerst' could be retired in favor of
    // 'zeker' (the new in-session confident signal that drives the gold
    // line). The FSRS-based long-term tier still exists; it's just no
    // longer the gold-line trigger.
    tierUnseen: 'Onbekend',
    tierLearned: 'Geleerd',
    tierFamiliar: 'Vertrouwd',
    tierRooted: 'Geworteld',
    tierAnchored: 'Verankerd',
    tierPermanent: 'Permanent',
    tierLegendTitle: 'Voortgang per niveau',
    // v4 commit 4: the "all caught up — no schedule" rest message was
    // removed from the home screen because it (a) contradicted the
    // user's expressed goal of training continuously toward all-66
    // gold, and (b) ironically *was* a schedule shape (telling them
    // to stop). Replaced by an always-visible "X confident · Y to
    // gold" dashboard. Keys allCaughtUpTitle / allCaughtUpBody /
    // nothingScheduled / extraPracticeHint are intentionally absent.
    // Streak — consecutive days with at least one quiz session.
    // "Streak" is also used for in-quiz consecutive-correct count;
    // dayStreak / dayStreakSingle distinguish them in display.
    dayStreak: 'dagen op rij',
    dayStreakSingle: 'dag',
    streakBest: 'Beste',
    // Milestones
    milestone10: 'Goed zo! 10 boeken beheerst! 🎉',
    milestone20: 'Geweldig! 20 boeken beheerst! 🎉',
    milestone33: 'Halverwege! 33 van 66 boeken! 🎉',
    milestone39: 'Alle Hebreeuwse-Aramese Geschriften beheerst! 🎉',
    milestoneNT: 'Alle Christelijke Griekse Geschriften beheerst! 🎉',
    milestone50: 'Fantastisch! 50 boeken beheerst! 🎉',
    milestone66: 'Alle 66 boeken beheerst! 🏆',
    // Welcome back
    welcomeBack24h: 'Welkom terug! Laten we kijken wat je nog weet.',
    welcomeBack7d: 'Welkom terug! Ga verder waar je gebleven was — geen druk.',
    // ─── Session-complete screen ──────────────────────────────────────
    // Shown when DUE=0 with no unseen books, or when the user hits their
    // Quick/Standard pick-count limit. The user has genuinely finished;
    // any further training is a deliberate choice (Box Mode).
    sessionCompleteTitle: '✨ Sessie compleet',
    sessionCompleteRestTitle: '🧠 Stoppen versterkt je geheugen meer dan doortrainen.',
    sessionCompleteRestBody: 'Wachten is geen pauze — het is wanneer je geheugen het werk doet.',
    // Today's totals line. {N} {M} {T} are filled in by the component.
    // "boeken" here counts unique book IDs seen today (sessions saved
    // with seenBookIds). For legacy entries without that field the
    // component falls back to total questions answered.
    sessionCompleteTodayLabel: 'Vandaag',
    sessionCompleteBooks: 'boeken',
    sessionCompleteSessions: 'sessies',
    sessionCompleteSessionSingle: 'sessie',
    sessionCompleteMinutes: 'minuten getraind',
    sessionCompleteFinish: 'Sessie afsluiten',

    // ─── Box Mode (Doos Modus) ─────────────────────────────────────
    // Cram-style training. All selected books start in box 1; correct
    // answers move them up, wrong answers move them down. Goal: get
    // every book to box 5. Personal-best tracked per scope, no FSRS
    // impact. See research notes in transcript for design rationale.
    boxModeTitle: 'Doos Modus',
    boxModeIntro: 'Een snelle, op zichzelf staande oefensessie. Alle gekozen boeken beginnen in doos 1. Goede antwoorden gaan een doos hoger, foute antwoorden een doos lager. Klaar als alles in doos 5 staat.',
    boxModeScopeAll: 'Alle 66 boeken',
    boxModeStart: 'Start sessie',
    boxModeDisclaimer: 'Doos Modus heeft geen invloed op je gewone schema. Het is puur extra oefening.',
    boxModeInProgress: 'Doos Modus',
    boxModeHintMarker: 'hint gebruikt',
    boxModeHintCost: '(Boek blijft staan op deze beurt)',
    // {count} = aantal boeken, {scope} = scope-naam (bijv. "Pentateuch")
    boxModeCompleteTitle: 'Alle {count} in doos 5! 🎯',
    boxModeFirstClear: 'Eerste keer geklaard!',
    boxModeStatTime: 'Tijd',
    boxModeStatMistakes: 'Fouten',
    boxModeStatStreak: 'Langste reeks',
    boxModeNewRecord: 'Nieuw record',
    boxModePrevBest: 'Vorige beste',
    boxModeAnotherSelection: 'Andere selectie',
    boxModeAgain: 'Opnieuw',
    boxModeFinish: 'Sluiten',
    // Home-screen button label
    boxModeBtnLabel: 'Doos Modus',

    // ─── v2 home screen (Up Next panel) ──────────────────────────
    upNextEyebrow: 'Volgende',
    homeStartQuiz: 'Start Quiz Modus',
    homeStartBoxMode: 'Start Doos Modus',
    upNextQuizDue: '{n} boek(en) klaar om te oefenen',
    upNextStudyWeak: 'Focus op je zwakste boeken — {n} hebben nog aandacht nodig',
    upNextStudyAll: 'Vrij oefenen — geen schema-druk',
    upNextStudyLastGroups: 'Laatste sessie',
    upNextBoxModeNoHistory: 'Nog geen score — kies een selectie en start je eerste sessie',
    upNextBoxModeResume: 'Ga verder waar je stopte',
    upNextBoxModeBestFor: 'Beste',

    // ─── v2 settings subsections ─────────────────────────────────
    trainingTab: 'Training',
    settingsSubsectionShared: 'Algemeen',
    settingsSubsectionQuiz: 'Quiz Modus',
    settingsSubsectionBoxMode: 'Doos Modus',
    settingsAdvanced: 'Geavanceerd',

    // ─── v2 Box Mode time pressure setting ───────────────────────
    boxModeFailModeLabel: 'Bij fout antwoord',
    boxModeFailModeDesc: '',
    boxModeFailModeSoft: 'Eén doos terug',
    boxModeFailModeStrict: 'Terug naar doos 1',
    boxModeTimePressureLabel: 'Tijdsdruk',
    boxModeTimePressureDesc: '(tijdslimiet per vraag)',
    boxModeTimePressureOff: 'Uit',
    boxModeTimePressureSoft5:  'Zacht, 5s',
    boxModeTimePressureSoft8:  'Zacht, 8s',
    boxModeTimePressureSoft10: 'Zacht, 10s (standaard)',
    boxModeTimePressureSoft15: 'Zacht, 15s',
    boxModeTimePressureSoft20: 'Zacht, 20s',
    boxModeTimePressureHard5:  'Streng, 5s',
    boxModeTimePressureHard8:  'Streng, 8s',
    boxModeTimePressureHard10: 'Streng, 10s',
    boxModeTimePressureHard15: 'Streng, 15s',
    boxModeTimePressureHard20: 'Streng, 20s',
    boxModeTimePressureSoftHint: 'Te traag = correct, maar geen vooruitgang',
    boxModeTimePressureHardHint: 'Te traag = fout (toon antwoord + zak één doos)',
    boxModeTimePressureSlowMarker: 'te traag',
  },
  en: {
    title: 'Bible Book Finder',
    subtitle: 'Learn where the books are located',
    // UserSelect screen
    noUsers: 'No users yet. Add yourself!',
    namePlaceholder: 'Your name...',
    addBtn: 'Add',
    addUser: 'Add user',
    deleteTitle: 'Delete',
    confirmDelete: 'Delete',
    confirmDeleteMsg: 'Delete {name} and all progress?',
    cancelDelete: 'Cancel',
    confirmReset: 'Reset',
    confirmResetMsg: 'Are you sure you want to reset your progress? This cannot be undone.',
    confirmResetQuizMsg: 'Are you sure you want to reset Quiz Mode progress? Mastery, intervals, streak, personal bests, and history will be cleared. Box Mode records stay. This cannot be undone.',
    confirmResetBoxMsg: 'Are you sure you want to reset Box Mode progress? All per-scope personal bests will be cleared. Quiz Mode progress stays. This cannot be undone.',
    cancelReset: 'Cancel',
    // Reset section in Settings → Data (where the Reset buttons live now)
    resetSectionTitle: 'Reset progress',
    resetSectionDesc: 'Wipe your progress per mode. This cannot be undone.',
    confirmImport: 'Restore',
    cancelImport: 'Cancel',
    confirmImportMsg: 'This will overwrite your current progress and preferences. Device-specific settings (columns, abbreviations, OT/NT layout) stay on this device.',
    confirmImportCrossMsg: '⚠️ This backup is from "{backup}", you are logged in as "{current}". This will overwrite {current}\'s progress and preferences with {backup}\'s. Device-specific settings stay on this device.',
    errorMaxUsers: 'Maximum 10 users reached',
    errorDuplicate: 'This name already exists',
    quizMode: 'Quiz Mode',
    // See NL section for design rationale (v4.8).
    boxModeSubtitle: 'Speed-sort against the clock',
    quizModeSubtitle: 'Long-term spaced review',
    score: 'Score',
    streak: 'Streak',
    of: 'of',
    tooSlow: 'Too slow',
    hebrewSection: 'HEBREW-ARAMAIC SCRIPTURES',
    greekSection: 'CHRISTIAN GREEK SCRIPTURES',
    correct: 'Correct!',
    wrong: 'Wrong',
    share: 'Share',
    resetQuizProgress: 'Reset Quiz progress',
    resetBoxProgress: 'Reset Box progress',
    back: 'Back',
    settingsTitle: 'Settings',
    gridTab: 'Grid',
    quizTab: 'Training',
    gridTitle: 'Grid',
    gridDesc: 'Columns and orientation.',
    portrait: 'Portrait',
    portraitDesc: '(upright)',
    landscape: 'Landscape',
    landscapeDesc: '(rotated)',
    orientation: 'Orientation',
    orientationDesc: '(force or auto)',
    testamentsLayout: 'OT/NT layout (landscape)',
    testamentsLayoutDesc: '(side by side or stacked)',
    layoutStacked: 'Stacked',
    layoutSideBySide: 'Side by side',
    landscapeOT: 'Landscape OT',
    landscapeOTDesc: '(columns for Hebrew-Aramaic)',
    landscapeNT: 'Landscape NT',
    landscapeNTDesc: '(columns for Christian Greek)',
    auto: 'Auto',
    portraitMode: 'Portrait',
    landscapeMode: 'Landscape',
    masterySpeed: 'Mastery Speed',
    masterySpeedDesc: '(answer within this time = mastered)',
    fast: 'Fast',
    slow: 'Relaxed',
    highlightFound: 'Mastered books',
    highlightFoundDesc: '(highlight mastered books)',
    autoScroll: 'Auto-scroll',
    autoScrollDesc: '(scroll to the asked book on each question)',
    theme: 'Theme',
    themeDesc: '(light or dark)',
    themeAuto: 'Auto (system)',
    themeLight: 'Light',
    themeDark: 'Dark',
    dataTab: 'Data',
    dataTitle: 'Backup',
    dataDesc: 'Create or restore a backup of your progress and settings.',
    exportBtn: '📥 Create Backup',
    importBtn: '📤 Restore Backup',
    exportSuccess: 'Backup downloaded!',
    importSuccess: 'Backup restored!',
    importError: 'Invalid file.',
    importWarning: '⚠️ Restoring will overwrite your progress and preferences. Device-specific settings (columns, abbreviations, OT/NT layout) stay on this device.',
    hintReveal: 'Hint:',
    // See NL section for design rationale.
    confident: 'Confident',
    mastered: 'Mastered',
    abbreviationsPortrait: 'Abbreviations (portrait)',
    abbreviationsPortraitDesc: '(upright)',
    abbreviationsLandscape: 'Abbreviations (landscape)',
    abbreviationsLandscapeDesc: '(rotated)',
    abbrAuto: 'Automatic',
    abbrFull: 'Full names',
    abbrLong: 'Long abbreviations',
    abbrShort: 'Short abbreviations',
    learningPace: 'Learning pace',
    learningPaceDesc: '',
    paceFlexible: 'Flexible',
    paceRelaxed: 'Relaxed',
    paceBalanced: 'Balanced',
    paceIntensive: 'Intensive',
    paceFlexibleHint: 'Lightest schedule — come when you have time, no daily pressure',
    paceRelaxedHint: 'Books come back less often — best if you practice occasionally',
    paceBalancedHint: 'Recommended — good balance between effort and progress',
    paceIntensiveHint: 'Books come back frequently — best if you practice often',
    // Session-size keys for the Quiz Mode home-screen launcher.
    // See NL section for design rationale.
    sessionSizeQuick: 'Quick',
    sessionSizeStandard: 'Standard',
    sessionSizeFull: 'Full',
    sessionSizeBooks: 'books',
    sessionSizeBookSingle: 'book',
    sessionSizeMinutes: 'min',
    // Two keys exist for the same FSRS due-count by design — this is
    // intentional and should NOT be unified. See the corresponding NL
    // block for the full rationale; in short:
    //   - readyToPractice ("Ready to practice") frames the menu count
    //     as a preparation invitation.
    //   - due ("Due") frames the same count inside the quiz / Train
    //     Ahead as a session countdown.
    // Help.jsx has a dedicated FAQ entry explaining both terms refer to
    // the same number.
    due: 'Due',
    readyToPractice: 'Ready to practice',
    practiced: 'Practiced',
    allBooks: 'All Books',
    book: 'book',
    books: 'books',
    wrongShowCorrect: 'Wrong — look for the blue cell!',
    // Total training time label (shared across Settings, Stats screen, share)
    totalTrainingTime: 'Total training time',
    // See NL section for design rationale.
    celebration66Title: 'All 66 books confident! 🎉',
    celebration66Body: 'You know all the Bible books fluently. Outstanding!',
    celebrationTimeLabel: 'Total time:',
    celebration66Reset: 'Start a new run',
    celebration66ResetConfirm: 'Tap again to wipe progress',
    // See NL section for design rationale (v4 commit 4).
    resumeSession: 'Resume session',
    resumeSessionDesc: 'Pick up where you left off',
    discardPausedSession: 'Discard paused session',
    toGold: 'to gold',
    // See NL section for design rationale (v4.1; labels improved v4.4).
    scopesCleared: 'cleared',
    scopesToGo: 'to go',
    scopesPlayedOf: 'of {total} played',
    scopesLeftToPlay: 'left to play',
    boxBestTimesHeader: 'Best times',
    boxNotYetPlayed: 'Not yet played',
    boxAllScopesClearedTitle: 'All scopes cleared! 🎉',
    boxAllScopesClearedBody: 'You\'ve completed every grouping at least once.',
    // Restore confirmation dialog
    restoreTitle: 'Restore backup',
    restoreWarning: 'This will replace your current progress. This action cannot be undone.',
    restoreCurrent: 'Current',
    restoreIncoming: 'Backup',
    restoreMastered: 'mastered',
    restoreContinue: 'Continue',
    restoreCancel: 'Cancel',
    // Update banner
    updateAvailable: 'New version available',
    updateNow: 'Update now',
    updateDismiss: 'Later',
    // Personal best
    newBest: 'New record!',
    // Tiers — see Dutch section for rationale
    tierUnseen: 'Unseen',
    tierLearned: 'Learning',
    tierFamiliar: 'Familiar',
    tierRooted: 'Rooted',
    tierAnchored: 'Anchored',
    tierPermanent: 'Permanent',
    tierLegendTitle: 'Progress by tier',
    // See NL section for v4 commit 4 rationale on the removed
    // allCaughtUp* / nothingScheduled / extraPracticeHint keys.
    dayStreak: 'day streak',
    dayStreakSingle: 'day',
    streakBest: 'Best',
    // Milestones
    milestone10: 'Nice! 10 books mastered! 🎉',
    milestone20: 'Great! 20 books mastered! 🎉',
    milestone33: 'Halfway! 33 of 66 books! 🎉',
    milestone39: 'All Hebrew-Aramaic Scriptures mastered! 🎉',
    milestoneNT: 'All Christian Greek Scriptures mastered! 🎉',
    milestone50: 'Fantastic! 50 books mastered! 🎉',
    milestone66: 'All 66 books mastered! 🏆',
    // Welcome back
    welcomeBack24h: 'Welcome back! Let\'s see what you remember.',
    welcomeBack7d: 'Welcome back! Pick up where you left off — no pressure.',
    // ─── Session-complete screen ──────────────────────────────────────
    // See NL section for design rationale.
    sessionCompleteTitle: '✨ Session complete',
    sessionCompleteRestTitle: '🧠 Stopping strengthens your memory more than pushing through.',
    sessionCompleteRestBody: 'The wait is not a pause — it\'s when your memory does the work.',
    sessionCompleteTodayLabel: 'Today',
    sessionCompleteBooks: 'books',
    sessionCompleteSessions: 'sessions',
    sessionCompleteSessionSingle: 'session',
    sessionCompleteMinutes: 'minutes trained',
    sessionCompleteFinish: 'End session',

    // ─── Box Mode ──────────────────────────────────────────────────
    boxModeTitle: 'Box Mode',
    boxModeIntro: 'A quick, standalone practice session. Every selected book starts in box 1. Correct answers move a book up, wrong answers move it down. You\'re done when everything reaches box 5.',
    boxModeScopeAll: 'All 66 books',
    boxModeStart: 'Start session',
    boxModeDisclaimer: 'Box Mode does not affect your regular schedule. It\'s pure extra practice.',
    boxModeInProgress: 'Box Mode',
    boxModeHintMarker: 'hint used',
    boxModeHintCost: '(Book stays put on this turn)',
    boxModeCompleteTitle: 'All {count} in box 5! 🎯',
    boxModeFirstClear: 'First clear!',
    boxModeStatTime: 'Time',
    boxModeStatMistakes: 'Mistakes',
    boxModeStatStreak: 'Longest streak',
    boxModeNewRecord: 'New record',
    boxModePrevBest: 'Previous best',
    boxModeAnotherSelection: 'Other selection',
    boxModeAgain: 'Again',
    boxModeFinish: 'Close',
    boxModeBtnLabel: 'Box Mode',

    // ─── v2 home screen (Up Next panel) ──────────────────────────
    upNextEyebrow: 'Up next',
    homeStartQuiz: 'Start Quiz Mode',
    homeStartBoxMode: 'Start Box Mode',
    upNextQuizDue: '{n} book(s) ready to practice',
    upNextStudyWeak: 'Focus on your weakest books — {n} still need attention',
    upNextStudyAll: 'Practice freely — no schedule pressure',
    upNextStudyLastGroups: 'Last session',
    upNextBoxModeNoHistory: 'No best yet — pick a selection and start your first session',
    upNextBoxModeResume: 'Pick up where you left off',
    upNextBoxModeBestFor: 'Best',

    // ─── v2 settings subsections ─────────────────────────────────
    trainingTab: 'Training',
    settingsSubsectionShared: 'Shared',
    settingsSubsectionQuiz: 'Quiz Mode',
    settingsSubsectionBoxMode: 'Box Mode',
    settingsAdvanced: 'Advanced',

    // ─── v2 Box Mode time pressure setting ───────────────────────
    boxModeFailModeLabel: 'On wrong answer',
    boxModeFailModeDesc: '',
    boxModeFailModeSoft: 'Drop one box',
    boxModeFailModeStrict: 'Back to box 1',
    boxModeTimePressureLabel: 'Time pressure',
    boxModeTimePressureDesc: '(time limit per question)',
    boxModeTimePressureOff: 'Off',
    boxModeTimePressureSoft5:  'Soft, 5s',
    boxModeTimePressureSoft8:  'Soft, 8s',
    boxModeTimePressureSoft10: 'Soft, 10s (default)',
    boxModeTimePressureSoft15: 'Soft, 15s',
    boxModeTimePressureSoft20: 'Soft, 20s',
    boxModeTimePressureHard5:  'Hard, 5s',
    boxModeTimePressureHard8:  'Hard, 8s',
    boxModeTimePressureHard10: 'Hard, 10s',
    boxModeTimePressureHard15: 'Hard, 15s',
    boxModeTimePressureHard20: 'Hard, 20s',
    boxModeTimePressureSoftHint: 'Slow correct = no advancement',
    boxModeTimePressureHardHint: 'Slow = wrong (auto-reveal + demote)',
    boxModeTimePressureSlowMarker: 'too slow',
  }
};
