// Shared config defaults and saved-config migration logic.
//
// Moved out of App.jsx so App.jsx only exports React components / hooks
// — that satisfies vite-plugin-react's "consistent component exports"
// rule and lets Fast Refresh hot-patch state instead of full-reloading
// on every save. (Earlier the warning was:
//   "Could not Fast Refresh ('defaultConfig' export is incompatible)"
// every save triggered a full page reload, which made the dev loop
// noticeably slower.)
//
// Nothing in this file is React-specific. It's just data + a pure
// migration function. Both can be safely imported anywhere.

// Auto-detect language: Dutch for nl-speaking browsers, English for everyone else
const detectedLang = typeof navigator !== 'undefined' && navigator.language?.startsWith('nl') ? 'nl' : 'en';

export const defaultConfig = {
  grid: {
    portrait: 6,
    landscape: 5,
    orientation: 'auto',
    // Used only when display.testamentsLayout === 'sideBySide' (landscape).
    // Defaults mirror JW Library Study Bible landscape: 4 OT columns, 3 NT.
    landscapeSideBySideOT: 4,
    landscapeSideBySideNT: 3,
  },
  // quiz.autoScroll is read-only legacy — see mergeConfig() for migration
  // to display.autoScroll. New writes always go to display.autoScroll.
  quiz: { masteryMs: 10000, learningPace: 'intensive' },
  // Box Mode (Doos Modus) settings — single-session Leitner cram.
  //   failMode:     'soft' (drop one box) | 'strict' (back to box 1)
  //   timePressure: 'off' | 'soft-Xs' | 'hard-Xs' where X is seconds
  //     'soft' = if timer expires, correct answer counts but doesn't
  //               advance the book (parallel to hint behavior)
  //     'hard' = if timer expires, treat as a wrong answer (auto-reveal
  //               correct + demote book)
  //   The default 'soft-10s' matches Quiz Mode's masteryMs threshold
  //   so users feel a consistent "fast = good" expectation across modes
  //   without the harshest punishment for slow correct answers.
  boxMode: { failMode: 'soft', timePressure: 'soft-10s' },
  display: {
    lang: detectedLang,
    highlightFound: true,
    abbreviationsPortrait: 'auto',
    abbreviationsLandscape: 'auto',
    // Auto-scroll the asked book into view in the grid. Used by Quiz
    // and Box Mode. Migrated from quiz.autoScroll — old saved values
    // are read by mergeConfig and copied here. New writes go here only.
    autoScroll: true,
    // 'stacked' (current behavior — OT above NT) or 'sideBySide' (JW Library
    // landscape look — OT and NT next to each other). Only meaningful in
    // landscape; portrait is always stacked because there's no horizontal
    // room for two halves.
    testamentsLayout: 'stacked',
  },
  // Study Mode was removed in v3, but the namespace is preserved here
  // (and in mergeConfig below) so users with old saved settings still
  // round-trip cleanly without losing other fields next to study.
  study: { selectedGroups: [], bookSelection: 'focused' },
};

// Deep merge saved settings with defaults so new keys are always present
export function mergeConfig(saved) {
  if (!saved) return { ...defaultConfig };
  // Handle legacy format where settings was just { lang: 'nl' }
  if (saved.lang && !saved.display) {
    return {
      ...defaultConfig,
      display: { ...defaultConfig.display, lang: saved.lang },
    };
  }
  // Migrate: old single `abbreviations` field → two orientation-specific
  // fields. If user had the old field set, apply it to both new fields
  // so their preference carries over without surprise.
  const display = { ...defaultConfig.display, ...(saved.display || {}) };
  if (saved.display && typeof saved.display.abbreviations === 'string') {
    if (saved.display.abbreviationsPortrait === undefined) {
      display.abbreviationsPortrait = saved.display.abbreviations;
    }
    if (saved.display.abbreviationsLandscape === undefined) {
      display.abbreviationsLandscape = saved.display.abbreviations;
    }
    delete display.abbreviations;
  }
  // Migrate: old 2-state values (auto/always/never) → new 4-state values
  // (auto/full/long/short). 'always' kept its visual meaning per orientation
  // (short in portrait, long in landscape), so we preserve that exact look:
  //   portrait  'always' → 'short'
  //   landscape 'always' → 'long'
  //   any       'never'  → 'full'   (force full names — same as before)
  // Already-new values pass through unchanged.
  const migrateAbbr = (value, orientation) => {
    if (value === 'always') return orientation === 'landscape' ? 'long' : 'short';
    if (value === 'never')  return 'full';
    return value;
  };
  display.abbreviationsPortrait  = migrateAbbr(display.abbreviationsPortrait,  'portrait');
  display.abbreviationsLandscape = migrateAbbr(display.abbreviationsLandscape, 'landscape');
  // Migrate: quiz.autoScroll → display.autoScroll. Auto-scroll has
  // always been a visual/display concern that happened to live in the
  // quiz namespace. We move it once and read the old field as fallback
  // so existing users don't lose their setting. New writes go to
  // display.autoScroll only.
  //
  // The check has to look at the SAVED data (not the merged display
  // object) because the spread-with-defaults on line above always
  // populates display.autoScroll = true from the default. We can only
  // distinguish "user explicitly set it" from "user never set it" by
  // looking at what was on disk.
  if (saved.display?.autoScroll === undefined) {
    display.autoScroll = saved.quiz?.autoScroll ?? true;
  }
  return {
    grid: { ...defaultConfig.grid, ...(saved.grid || {}) },
    quiz: { ...defaultConfig.quiz, ...(saved.quiz || {}) },
    boxMode: { ...defaultConfig.boxMode, ...(saved.boxMode || {}) },
    display,
    study: { ...defaultConfig.study, ...(saved.study || {}) },
  };
}
