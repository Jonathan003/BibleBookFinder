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

// v6.3: schema version. Bump whenever the saved config shape changes in
// a way that requires migration. mergeConfig() reads the saved.version
// (or its absence) and runs the right migration chain to bring it up
// to CURRENT_CONFIG_VERSION. The version field itself isn't user-facing
// — it's purely for migration bookkeeping.
//
// Current migrations:
//   (no version)  → v2: unify quiz.masteryMs + boxMode.timePressure
//                       into top-level targetSpeedMs; drop both old
//                       fields. Floor 2000ms (animation-safe), ceiling
//                       30000ms (effectively "no pressure"). See the
//                       v6.3 design discussion in CHANGES.md for the
//                       full rationale.
export const CURRENT_CONFIG_VERSION = 2;

export const defaultConfig = {
  // v6.3: schema version — see CURRENT_CONFIG_VERSION above.
  version: CURRENT_CONFIG_VERSION,
  // v6.3: unified speed target. Used by BOTH Quiz Mode and Box Mode as
  // the "fluency threshold" — answers within this time count as fast
  // (Easy/Good FSRS rating + confident-buffer credit in Quiz, no
  // demotion + visible timer-bar in Box). Default 10s matches the
  // pre-6.3 quiz.masteryMs default. Range enforced by the Settings
  // slider: [2000, 30000]ms.
  //
  // The old config.quiz.masteryMs and config.boxMode.timePressure are
  // dropped from new saves; migrateToV2() in mergeConfig() handles
  // existing users.
  targetSpeedMs: 10000,
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
  //
  // v6.3: quiz.masteryMs removed — superseded by top-level targetSpeedMs.
  // The 'quiz' namespace still hosts learningPace (FSRS request_retention).
  quiz: { learningPace: 'intensive' },
  // Box Mode (Doos Modus) settings — single-session Leitner cram.
  //   failMode: 'soft' (drop one box) | 'strict' (back to box 1)
  //
  // v6.3: boxMode.timePressure removed — superseded by top-level
  // targetSpeedMs. The pre-6.3 'off' | 'soft-Xs' | 'hard-Xs' modes
  // collapsed into a single "always-on timer with informational expiry
  // in Quiz / consequence-bearing expiry in Box" model. See migration
  // in mergeConfig().
  boxMode: { failMode: 'soft' },
  display: {
    lang: detectedLang,
    // v4 theme: 'auto' follows the OS/browser prefers-color-scheme,
    // 'light' or 'dark' override it. Wired in App.jsx by setting
    // <html data-theme="..."> for the explicit values; for 'auto'
    // the attribute is removed and the @media query in index.css
    // takes over.
    theme: 'auto',
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
  // v6.3 (config schema v2): unify the old quiz.masteryMs and
  // boxMode.timePressure into a single top-level targetSpeedMs.
  //
  // Migration rules (per the v6.3 design conversation):
  //   - If saved.targetSpeedMs is already set, trust it (the user has
  //     already migrated or arrived on a fresh install).
  //   - Otherwise compute candidates from the two old fields:
  //       quiz.masteryMs   → straight ms value (default if absent: 10000)
  //       boxMode.timePressure:
  //         'off'           → 30000ms (treat as "no effective pressure")
  //         'soft-Xs'/      → X * 1000ms (extract the configured time;
  //         'hard-Xs'         the soft/hard distinction is dropped in v6.3
  //                           — Box Mode now always uses the hard flow)
  //   - Take the HIGHER candidate (more conservative — preserves the
  //     more lenient of the user's two prior settings rather than
  //     surprising them with a tighter target).
  //   - Clamp into [2000, 30000] (the new picker range).
  //
  // The old fields are intentionally NOT preserved in the merged result
  // — keeping them around would let stale code paths accidentally read
  // them. The schema-v2 result has only targetSpeedMs.
  const migratedTargetSpeedMs = (() => {
    if (typeof saved.targetSpeedMs === 'number') {
      return Math.max(2000, Math.min(30000, saved.targetSpeedMs));
    }
    const candidates = [];
    if (typeof saved.quiz?.masteryMs === 'number') {
      candidates.push(saved.quiz.masteryMs);
    }
    if (typeof saved.boxMode?.timePressure === 'string') {
      if (saved.boxMode.timePressure === 'off') {
        candidates.push(30000);
      } else {
        const m = /^(?:soft|hard)-(\d+)s$/.exec(saved.boxMode.timePressure);
        if (m) candidates.push(Number(m[1]) * 1000);
      }
    }
    if (candidates.length === 0) return defaultConfig.targetSpeedMs;
    return Math.max(2000, Math.min(30000, Math.max(...candidates)));
  })();
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
  // v6.3: build the merged quiz/boxMode namespaces explicitly so we
  // drop the now-superseded masteryMs and timePressure fields. Spreading
  // defaultConfig.quiz first means we get learningPace; spreading saved
  // values second lets a user keep their non-default learningPace.
  // masteryMs (if present in saved) is silently discarded — its value
  // already contributed to migratedTargetSpeedMs above.
  const { masteryMs: _droppedMasteryMs, ...savedQuizRest } = saved.quiz || {};
  const { timePressure: _droppedTimePressure, ...savedBoxModeRest } = saved.boxMode || {};
  return {
    version: CURRENT_CONFIG_VERSION,
    targetSpeedMs: migratedTargetSpeedMs,
    grid: { ...defaultConfig.grid, ...(saved.grid || {}) },
    quiz: { ...defaultConfig.quiz, ...savedQuizRest },
    boxMode: { ...defaultConfig.boxMode, ...savedBoxModeRest },
    display,
    study: { ...defaultConfig.study, ...(saved.study || {}) },
  };
}
