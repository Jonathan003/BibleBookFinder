import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { bibleBooks, translations } from './data';
import { getCurrentUser, getUser, updateUser, addToTotalQuizMs, setCurrentUser as persistCurrentUser } from './users';
import { getBookStats, getTierStats, countCloseToMastery, TIERS } from './fsrs';
import { computeStreakInfo } from './streak';
import { applyDeviceScoped } from './settingsScope';
import { formatDuration } from './timeFormat';
import { getBoxModeBests } from './boxModeStorage';
import { defaultConfig, mergeConfig } from './appConfig';
import { InitialAvatar } from './components/Icons';
import UserSelect from './components/UserSelect';
import QuizGrid from './components/QuizGrid';
import BoxMode from './components/BoxMode';
import Settings from './components/Settings';
import Help from './components/Help';
import './App.css';

// defaultConfig and mergeConfig are imported from a separate module so
// App.jsx only contains React-component-shaped exports — that lets
// vite-plugin-react Fast Refresh hot-patch components instead of doing
// a full page reload on every save (the "consistent component exports"
// rule). See appConfig.js for the actual definitions.

const ConfigContext = createContext(null);

export function useAppConfig() {
  const ctx = useContext(ConfigContext);
  return ctx || { config: defaultConfig, lang: 'nl', t: translations.nl };
}

function App() {
  const [currentUser, setCurrentUserState] = useState(null);
  const [view, setView] = useState('menu');
  const [previousView, setPreviousView] = useState(null);
  const [config, setConfig] = useState(defaultConfig);
  const [shareFeedback, setShareFeedback] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState(null); // '24h' | '7d' | null
  // Home-screen mode selection (the in-page tabs pattern). Picking a card
  // updates this state — it does NOT launch. The Start button below
  // launches whatever's selected. Defaults to lastUsedMode so returning
  // users land on what they were doing; 'quiz' for new users.
  const [selectedMode, setSelectedMode] = useState('quiz');

  // PWA update detection via vite-plugin-pwa.
  //
  // useRegisterSW returns a `needRefresh` state that becomes true when
  // a new service worker has been downloaded and is waiting to activate.
  // The user clicks "Update now" → updateServiceWorker(true) tells the
  // waiting SW to skipWaiting() and reloads the page.
  //
  // The setInterval in onRegisteredSW polls the server for SW updates
  // every 30 minutes (no full reload, just a quiet check). This is the
  // pattern recommended by vite-plugin-pwa docs ("Periodic Service
  // Worker Updates"). 30 minutes is a balance between freshness and
  // unnecessary network requests on always-open tabs.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setInterval(() => {
          // Don't update if we're offline — fetch will fail anyway and
          // log a misleading error.
          if (!navigator.onLine) return;
          registration.update();
        }, 30 * 60 * 1000); // 30 minutes
      }
    },
  });
  // Quiz phase: null = no active quiz, 'playing' = answering questions,
  // 'paused' = summary/pause screen shown. When non-null, QuizGrid is
  // kept mounted even across Settings/Help detours so its session state
  // (score, response times, best-streak progress) survives the round trip.
  const [quizPhase, setQuizPhase] = useState(null);

  // Session-size limit chosen on the home screen via the Quick/Standard/Full
  // launchers. `null` means no limit (Full / unlimited; legacy behaviour).
  // Captured into QuizGrid on mount; the user's choice for *this* launch
  // doesn't survive into the next session (returning to the menu and
  // launching again re-asks the question).
  const [quizSessionLimit, setQuizSessionLimit] = useState(null);

  const lang = config.display.lang;

  // "Focus mode" = the user is actively doing a task; the header should
  // show only the language toggle to reduce distraction. From the summary
  // screen (a deliberate pause) or from Settings/Help, full nav returns.
  // Box Mode's selecting/complete phases are pause-like, but the
  // component is self-contained — we keep focus-mode on for any
  // boxMode view to keep the header clean.
  const inFocusMode =
    (view === 'quiz' && quizPhase === 'playing') ||
    view === 'boxMode';

  // Keep <html lang> in sync with the active app language so screen
  // readers pronounce content correctly when the user toggles NL/EN.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  // Load current user on mount + migrate old global config if present
  useEffect(() => {
    const userId = getCurrentUser();
    if (userId) {
      const user = getUser(userId);
      if (user) {
        setCurrentUserState(user);
        // Sync home-screen selection to the user's last-used mode.
        // Migration: users with lastUsedMode='study' (Study Mode was
        // removed) fall back to 'quiz'. We don't write this back to
        // storage — it'll naturally update next time they pick a mode.
        const last = user.lastUsedMode;
        setSelectedMode(last === 'boxMode' ? 'boxMode' : 'quiz');
        let userConfig = mergeConfig(user.settings);

        // Migration: absorb old global config into this user's settings, then delete it
        const oldGlobal = localStorage.getItem('biblefinder_config');
        if (oldGlobal) {
          try {
            const parsed = JSON.parse(oldGlobal);
            userConfig = mergeConfig({ ...userConfig, ...parsed });
            updateUser(user.id, { settings: userConfig });
          } catch { /* ignore bad data */ }
          localStorage.removeItem('biblefinder_config');
        }

        setConfig(userConfig);

        // Welcome back detection
        const now = Date.now();
        const lastActive = user.lastActive || 0;
        if (lastActive) {
          const hoursSince = (now - lastActive) / (1000 * 60 * 60);
          if (hoursSince > 168) setWelcomeMessage('7d');
          else if (hoursSince > 24) setWelcomeMessage('24h');
        }
        // Update lastActive timestamp
        updateUser(user.id, { lastActive: now });
      }
    }
  }, []);

  const handleUserSelect = (user) => {
    setCurrentUserState(user);
    persistCurrentUser(user.id);
    // Sync home-screen selection (Study Mode no longer exists, so old
    // 'study' values fall back to 'quiz').
    const last = user.lastUsedMode;
    setSelectedMode(last === 'boxMode' ? 'boxMode' : 'quiz');
    // Always return to the menu on user switch. Without this, switching
    // user while Quiz/Settings was open would drop the new user
    // straight into that screen with the previous user's state.
    setView('menu');
    setPreviousView(null);
    setQuizPhase(null);

    // Fresh user with no settings yet: inherit whatever lang was active
    // on the UserSelect screen (the module-scope `detectedLang` would
    // otherwise snap things back to the browser default), then persist
    // so this never has to happen again.
    let userConfig;
    if (user.settings) {
      userConfig = mergeConfig(user.settings);
    } else {
      userConfig = mergeConfig({ display: { lang: config.display.lang } });
      updateUser(user.id, { settings: userConfig });
      user.settings = userConfig;
    }
    setConfig(userConfig);

    // Set masteryMsAtStart for fresh users (no FSRS data yet)
    if (user.masteryMsAtStart == null && (!user.fsrsCards || Object.keys(user.fsrsCards).length === 0)) {
      updateUser(user.id, { masteryMsAtStart: userConfig.quiz.masteryMs });
      user.masteryMsAtStart = userConfig.quiz.masteryMs;
    }

    // Legacy migration: users created before the totalQuizMs field
    // existed have no counter. Initialize to 0 once on load — they'll
    // start accumulating training time from this point forward without
    // any retroactive estimate (which would be a guess regardless).
    if (user.totalQuizMs == null) {
      updateUser(user.id, { totalQuizMs: 0 });
      user.totalQuizMs = 0;
    }

    // Welcome back detection
    const now = Date.now();
    const lastActive = user.lastActive || 0;
    if (lastActive) {
      const hoursSince = (now - lastActive) / (1000 * 60 * 60);
      if (hoursSince > 168) setWelcomeMessage('7d');
      else if (hoursSince > 24) setWelcomeMessage('24h');
    }
    updateUser(user.id, { lastActive: now });
  };

  // Stable functional updater. Accepts either an object of updates or a
  // function `prev => updates`. Returning `null` from the function signals
  // "no change" and skips the write entirely. This callback never changes
  // identity, which in turn keeps the downstream FSRS/streak/time
  // callbacks stable across the whole quiz session.
  const updateUserData = useCallback((updatesOrFn) => {
    setCurrentUserState(prev => {
      if (!prev) return prev;
      const updates = typeof updatesOrFn === 'function' ? updatesOrFn(prev) : updatesOrFn;
      if (!updates || Object.keys(updates).length === 0) return prev;
      updateUser(prev.id, updates);
      return { ...prev, ...updates };
    });
  }, []);

  // FSRS card management
  const updateFsrsCard = useCallback((bookId, cardData) => {
    updateUserData(prev => ({
      fsrsCards: { ...(prev.fsrsCards || {}), [bookId]: cardData }
    }));
  }, [updateUserData]);

  const updateBestStreak = useCallback((streak) => {
    updateUserData(prev => {
      const currentBest = prev.bestStreak || 0;
      return streak > currentBest ? { bestStreak: streak } : null;
    });
  }, [updateUserData]);

  // Add a quiz session to a specific user's history. Accepts an explicit
  // userId rather than relying on `currentUser` at call time, so that a
  // session saved during QuizGrid unmount is attributed to the user who
  // actually played it — not whoever is active after a mid-session switch.
  // Reads the target user fresh from localStorage to avoid racing with
  // any concurrent React state updates.
  const addQuizSession = useCallback((userId, session) => {
    if (!userId) return;
    const user = getUser(userId);
    if (!user) return;
    const newHistory = [...(user.quizHistory || []), { ...session, date: Date.now() }];
    updateUser(userId, { quizHistory: newHistory });
    // Mirror into local state only if the session owner is still active.
    setCurrentUserState(prev => {
      if (!prev || prev.id !== userId) return prev;
      return { ...prev, quizHistory: newHistory };
    });
  }, []);

  const updateBestTime = useCallback((bookId, ms) => {
    updateUserData(prev => ({
      bestTimes: { ...(prev.bestTimes || {}), [bookId]: ms }
    }));
  }, [updateUserData]);

  // FSRS-based stats
  const fsrsCards = currentUser?.fsrsCards || {};
  const stats = getBookStats(fsrsCards, bibleBooks);

  // Tier breakdown — discrete progression layer on top of FSRS state.
  // Memoized because it walks all 66 cards on every recompute and the
  // menu re-renders on every state change (welcome banner dismissal,
  // share feedback, etc.) where the cards themselves haven't changed.
  // No time dependency — the tier each card is in is a function of its
  // FSRS state, not the current clock.
  const tierStats = useMemo(() => getTierStats(fsrsCards, bibleBooks), [fsrsCards]);

  // Books one rep away from Mastered (see countCloseToMastery in fsrs.js
  // for the precise condition). Memoized on fsrsCards — no time
  // dependency: the rep count of a card doesn't drift with the clock.
  const closeToMasteryCount = useMemo(
    () => countCloseToMastery(fsrsCards, bibleBooks),
    [fsrsCards]
  );

  // Streak from quizHistory — purely derived, no separate state.
  const streakInfo = useMemo(
    () => computeStreakInfo(currentUser?.quizHistory || []),
    [currentUser?.quizHistory]
  );

  // Box Mode bests for the home-screen Box dashboard panel. Sorted by
  // most-recent completion so the user's recent work surfaces first.
  // Empty object if the user has never cleared a session.
  const boxBests = useMemo(() => {
    if (!currentUser) return [];
    const all = getBoxModeBests(currentUser.id) || {};
    return Object.entries(all)
      .map(([scope, data]) => ({ scope, ...data }))
      .sort((a, b) => (b.lastCompletedAt || 0) - (a.lastCompletedAt || 0));
    // Re-runs when boxModeBests on user changes. We watch a stable shape
    // since Box completions update the user object.
  }, [currentUser?.boxModeBests, currentUser?.id]);

  // Set the "last used" mode + navigate. Permissive: tap counts as use,
  // even if the user immediately backs out from a selection screen
  // (Box Mode). The opposite failure (user used Box Mode but the system
  // doesn't remember) is more frustrating than the alternative of one
  // accidental tap leaving a one-visit hint.
  const goToMode = useCallback((mode) => {
    if (currentUser) {
      updateUser(currentUser.id, { lastUsedMode: mode });
      setCurrentUserState({ ...currentUser, lastUsedMode: mode });
    }
    setView(mode);
  }, [currentUser]);

  // Reset Quiz Mode progress for the current user. Wipes the FSRS-driven
  // long-term data: card states, mastery, quiz history, streak, best
  // times, and the cumulative training-time counter. Box Mode personal
  // bests are NOT touched — Box Mode has its own reset.
  // Confirmation is owned by Settings.jsx (where the button now lives) —
  // this just performs the wipe when called. masteryMsAtStart is
  // re-snapshotted from the current setting so the next share message
  // reflects only post-reset training time.
  const doResetQuizProgress = () => {
    if (!currentUser) return;
    updateUserData({
      bestStreak: 0,
      quizHistory: [],
      fsrsCards: {},
      bestTimes: {},
      masteryMsAtStart: config.quiz.masteryMs,
      totalQuizMs: 0,
    });
  };

  // Reset Box Mode progress for the current user. Wipes per-scope
  // personal bests (fastestMs, fewestMistakes, longestStreak across all
  // scopes — All 66, Pentateuch, Gospels, etc.). Quiz Mode data is NOT
  // touched. Confirmation lives in Settings.jsx.
  const doResetBoxProgress = () => {
    if (!currentUser) return;
    updateUserData({ boxModeBests: {} });
  };

  // Add to the user's cumulative training-time counter. Called per
  // answered question by QuizGrid with a pre-capped delta. Uses an atomic
  // add (read-modify-write inside users.js) rather than a closure-based
  // `currentUser.totalQuizMs + ms` to avoid race conditions when
  // multiple answers arrive in quick succession.
  const addTrainingTime = useCallback((deltaMs) => {
    if (!currentUser) return;
    const next = addToTotalQuizMs(currentUser.id, deltaMs);
    if (next != null) {
      // Mirror to React state so the Stats screen shows up-to-date
      // values without forcing a re-fetch from localStorage.
      setCurrentUserState(prev => prev ? { ...prev, totalQuizMs: next } : prev);
    }
  }, [currentUser]);

  const share = async () => {
    if (!currentUser) return;

    // Build the share text based on which mode is currently selected on
    // the home screen. Quiz Mode shares mastery progress (the FSRS-driven
    // long-term metric); Box Mode shares the most-recent personal best
    // (a single-session achievement). Different headlines, same delivery
    // path (native share on mobile, clipboard fallback on desktop).
    let text;
    if (selectedMode === 'boxMode') {
      // Use the most recently completed scope as the share subject.
      // boxBests is already sorted by lastCompletedAt desc, so [0] is most
      // recent. If empty, share a generic invite — the app is the
      // headline, not the (nonexistent) personal best.
      const top = boxBests[0];
      const scopeLabel = (scope) => {
        if (scope === 'all') return lang === 'nl' ? 'alle 66 boeken' : 'all 66 books';
        // scope = 'group:law' etc. — use the group name.
        const groupId = scope.split(':')[1];
        const name = (translations[lang]?.groupNames?.[groupId]) || groupId;
        return name;
      };
      const fmtMs = (ms) => {
        const totalSec = Math.round(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
      };
      if (top) {
        const scopeName = scopeLabel(top.scope);
        const time = fmtMs(top.fastestMs);
        const mistakes = top.fewestMistakes;
        text = (lang === 'nl'
          ? `Box Modus: ${scopeName} uitgespeeld in ${time} met ${mistakes} fouten in Bijbelboek Zoeker!`
          : `Box Mode: cleared ${scopeName} in ${time} with ${mistakes} mistakes in Bible Book Finder!`);
      } else {
        text = (lang === 'nl'
          ? `Ik leer de bijbelboeken vinden met Bijbelboek Zoeker!`
          : `I'm learning to find the Bible books with Bible Book Finder!`);
      }
    } else {
      // Quiz Mode (default). Existing message: mastered count + cumulative
      // training time + speed setting if unchanged from start.
      const speedMs = config.quiz.masteryMs;
      const speedUnchanged = currentUser.masteryMsAtStart != null && currentUser.masteryMsAtStart === speedMs;
      const speedStr = speedUnchanged ? ` (${(speedMs / 1000).toFixed(speedMs % 1000 ? 1 : 0)}s)` : '';
      const totalMs = currentUser.totalQuizMs || 0;
      const timeStr = totalMs > 0 ? ` in ${formatDuration(totalMs)}` : '';
      text = (lang === 'nl'
        ? `Ik heb ${stats.mastered} van 66 bijbelboeken beheerst${timeStr}${speedStr} in de Bijbelboek Zoeker quiz!`
        : `I mastered ${stats.mastered} out of 66 Bible books${timeStr}${speedStr} in the Bible Book Finder quiz!`);
    }
    const fullText = text + ' ' + window.location.href;

    // Native share on mobile only (desktop share dialogs are clunky).
    // On success the OS share UI gives its own confirmation; no in-app
    // feedback needed.
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title: 'Bible Book Finder', text, url: window.location.href });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled
        // Share failed — fall through to clipboard
      }
    }

    // Clipboard fallback. Track whether it actually worked so we can
    // show honest feedback instead of always claiming success.
    let copied = false;
    try {
      await navigator.clipboard.writeText(fullText);
      copied = true;
    } catch {
      // Clipboard API blocked — legacy execCommand path
      const ta = document.createElement('textarea');
      ta.value = fullText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      document.body.removeChild(ta);
    }

    setShareFeedback(copied
      ? (lang === 'nl' ? 'Gekopieerd!' : 'Copied!')
      : (lang === 'nl' ? 'Kopiëren mislukt' : 'Copy failed'));
    setTimeout(() => setShareFeedback(''), 2500);
  };

  const t = translations[lang];

  // Save config per-user (no global localStorage)
  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    if (currentUser) {
      updateUserData({ settings: newConfig });
    }
  };

  const handleRestore = (userData) => {
    if (!currentUser || !userData) return;
    // Run incoming settings through mergeConfig so legacy field shapes get
    // migrated, then overlay device-scoped fields from the CURRENT device.
    // This is the "Anki-style" split: collection + user prefs come from the
    // backup; device prefs (column counts, abbreviation modes, OT/NT layout,
    // autoScroll) stay local. Same logic handles backups from this device,
    // backups from another device, and cross-user imports — the receiving
    // device always keeps its own screen-related settings.
    //
    // Confirmation happens in Settings.jsx (inline panel with diff display)
    // before this is called — no second modal here.
    const incoming = mergeConfig(userData.settings);
    const restoredConfig = applyDeviceScoped(incoming, config);
    updateUserData({
      bestStreak: userData.bestStreak || 0,
      quizHistory: userData.quizHistory || [],
      fsrsCards: userData.fsrsCards || {},
      bestTimes: userData.bestTimes || {},
      // Box Mode per-scope personal bests. Pre-v3 backups don't have
      // this field — `|| {}` means a legacy import resets to no-bests
      // rather than carrying over the current device's bests (which
      // would be misleading since they belong to the other user-state
      // we're about to overwrite).
      boxModeBests: userData.boxModeBests || {},
      lastActive: userData.lastActive || 0,
      // Legacy backups (pre-masteryMsAtStart) would otherwise restore as
      // null and the Share suffix would stay hidden. Fall back to the
      // current masteryMs so a restored user immediately behaves like a
      // freshly-reset user.
      masteryMsAtStart: userData.masteryMsAtStart ?? config.quiz.masteryMs,
      // Legacy (pre-_schemaVersion 2) backups have no totalQuizMs field.
      // `?? 0` means: if the field exists in backup, use it; otherwise
      // start at zero rather than carrying over the current device's
      // counter (which would be misleading).
      totalQuizMs: userData.totalQuizMs ?? 0,
      settings: restoredConfig,
    });
    setConfig(restoredConfig);
  };

  if (!currentUser) {
    return (
      <ConfigContext.Provider value={{ config, lang, t }}>
        <div className="app">
          <UserSelect onSelect={handleUserSelect} onToggleLang={() => {
            const newLang = lang === 'nl' ? 'en' : 'nl';
            setConfig(c => ({ ...c, display: { ...c.display, lang: newLang } }));
          }} />
        </div>
      </ConfigContext.Provider>
    );
  }

  return (
    <ConfigContext.Provider value={{ config, lang, t }}>
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <button className="user-btn" onClick={() => setCurrentUserState(null)}>
              <span className="header-avatar">
                <InitialAvatar name={currentUser.name} size={24} />
              </span>
              <span className="header-name">{currentUser.name}</span>
            </button>
            <p className="subtitle">{t.subtitle}</p>
          </div>
          <div className="header-right">
            {!inFocusMode && view !== 'help' && (
              <button className="help-btn" onClick={() => {
                // Smart back: only 'quiz' is remembered as referring view so
                // Back from Help/Settings returns there (for session continuity
                // with an active paused quiz). Menu-level chains like
                // Menu→Help→Settings keep previousView null, so Back always
                // goes straight home in one click — no back-stack stepping.
                if (view === 'quiz') setPreviousView('quiz');
                setView('help');
              }} title="Help">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </button>
            )}
            {!inFocusMode && view !== 'settings' && (
              <button className="settings-btn" onClick={() => {
                if (view === 'quiz') setPreviousView('quiz');
                setView('settings');
              }} title={t.settingsTitle || 'Settings'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </button>
            )}
            <button className="lang-btn" onClick={() => {
              const newLang = lang === 'nl' ? 'en' : 'nl';
              const newConfig = { ...config, display: { ...config.display, lang: newLang } };
              saveConfig(newConfig);
            }}>
              {lang === 'nl' ? 'NL' : 'EN'}
            </button>
          </div>
        </header>

        <main className="app-main">
          {/* PWA update banner — appears on the menu when a new service
              worker has been downloaded and is waiting to activate.
              "Later" dismisses for this session; full reload triggers the
              service worker swap via updateServiceWorker(true). */}
          {view === 'menu' && needRefresh && (
            <div className="update-banner">
              <span className="update-banner-text">⬆️ {t.updateAvailable}</span>
              <div className="update-banner-buttons">
                <button
                  className="update-banner-btn-primary"
                  onClick={() => updateServiceWorker(true)}
                >
                  {t.updateNow}
                </button>
                <button
                  className="update-banner-btn-secondary"
                  onClick={() => setNeedRefresh(false)}
                >
                  {t.updateDismiss}
                </button>
              </div>
            </div>
          )}
          {view === 'menu' && (
            <div className="menu">
              {welcomeMessage && (
                <div className="welcome-back-banner" onClick={() => setWelcomeMessage(null)}>
                  {welcomeMessage === '7d' ? t.welcomeBack7d : t.welcomeBack24h}
                </div>
              )}

              {/* The home screen now uses the in-page tabs pattern:
                  the mode-cards below act as SELECTORS (one tap = preview),
                  the Start button at the bottom LAUNCHES the selected
                  mode. The dashboard panel here adapts to whichever mode
                  is currently selected — Quiz shows FSRS metrics, Box
                  shows personal bests. The Share button lives inside the
                  active panel since the message it generates is
                  mode-specific. */}
              {selectedMode === 'quiz' && (
              <div className="dashboard-panel">
              <button
                className="share-icon-btn-panel"
                onClick={share}
                title={t.share}
                aria-label={t.share}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
              {/* Hero card. Two states based on whether there's anything
                  to do right now:
                    - dueNow > 0 → standard "X klaar om te oefenen" stats
                      with Quiz Mode prominent below.
                    - dueNow === 0 → "All caught up" celebration with
                      countdown to the next due book. */}
              {stats.dueNow > 0 ? (
                <div className="stats">
                  <div className="stat-card">
                    <span className="stat-number">{tierStats.mastered + tierStats.anchored + tierStats.permanent}</span>
                    <span className="stat-label">{t.mastered} {t.of} 66</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-number">{stats.dueNow}</span>
                    <span className="stat-label">{t.readyToPractice}</span>
                  </div>
                </div>
              ) : (
                // Flat "done for now" message — no countdown, no schedule
                // pressure. Practice happens when the user has time, not on
                // a calendar the algorithm projects for them.
                <div className="all-caught-up">
                  <div className="all-caught-up-title">{t.allCaughtUpTitle}</div>
                  <p className="all-caught-up-body">{t.allCaughtUpBody}</p>
                </div>
              )}

              {/* Tier-stack progress bar. Replaces the binary mastered/
                  not-mastered linear bar. Each segment is one tier, in
                  promotion order; segment width is proportional to that
                  tier's count. The 'unseen' tier is included so the bar
                  always sums to 66 and the user sees how much ground is
                  left to cover. Color tokens come from --tier-* CSS
                  variables in App.css. */}
              <div className="tier-section">
                <div className="tier-bar">
                  {TIERS.map(tier => (
                    tierStats[tier] > 0 && (
                      <div
                        key={tier}
                        className={`tier-segment tier-${tier}`}
                        style={{ width: `${(tierStats[tier] / 66) * 100}%` }}
                        title={`${t['tier' + tier.charAt(0).toUpperCase() + tier.slice(1)]}: ${tierStats[tier]}`}
                      >
                        {tierStats[tier] >= 5 && <span className="tier-segment-count">{tierStats[tier]}</span>}
                      </div>
                    )
                  ))}
                </div>
                <div className="tier-legend">
                  {/* Show only non-empty tiers in the legend to avoid clutter
                      on fresh accounts. Order is fixed (promotion order)
                      regardless of which tiers are populated. */}
                  {TIERS.filter(tier => tierStats[tier] > 0).map(tier => (
                    <span key={tier} className={`tier-chip tier-${tier}`}>
                      <span className="tier-chip-dot" />
                      <span className="tier-chip-label">
                        {t['tier' + tier.charAt(0).toUpperCase() + tier.slice(1)]}
                      </span>
                      <span className="tier-chip-count">{tierStats[tier]}</span>
                    </span>
                  ))}
                </div>
                {/* "X books close to Mastered" — surfaces the otherwise-
                    invisible MASTERY_MIN_REPS=3 rep gate. A book at 2/3
                    reps is visually still in Familiar tier but a single
                    correct answer away from promotion; without this
                    line, that progress is invisible to the user. */}
                {closeToMasteryCount > 0 && (
                  <div className="close-to-mastery">
                    {closeToMasteryCount === 1
                      ? t.closeToMasterySingle
                      : `${closeToMasteryCount} ${t.closeToMastery}`}
                  </div>
                )}
              </div>

              {/* Streak indicator. Hidden when zero to avoid scolding the
                  fresh user with "0 day streak". */}
              {streakInfo.current > 0 && (
                <div className="momentum-section">
                  <div className="streak-card">
                    <span className="streak-flame">🔥</span>
                    <span className="streak-number">{streakInfo.current}</span>
                    <span className="streak-label">
                      {streakInfo.current === 1 ? t.dayStreakSingle : t.dayStreak}
                      {streakInfo.longest > streakInfo.current && (
                        <span className="streak-best"> · {t.streakBest} {streakInfo.longest}</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              </div>
              )}

              {/* Box Mode dashboard panel — shown when the Box card is
                  the selected one. Surfaces personal bests across the
                  scopes the user has completed; falls back to a friendly
                  empty state for new users.
                  Same visual weight as the Quiz panel so the page
                  doesn't shift size when the user switches selection. */}
              {selectedMode === 'boxMode' && (
              <div className="dashboard-panel">
                <button
                  className="share-icon-btn-panel"
                  onClick={share}
                  title={t.share}
                  aria-label={t.share}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>
                <div className="boxmode-dashboard">
                  <h2 className="boxmode-dashboard-title">📦 {t.boxModeBtnLabel}</h2>
                  {/* Always render the "Personal bests" structure for
                      visual parallelism with the Quiz Mode panel —
                      Quiz shows zeros at empty state without a "no
                      sessions yet" wrapper, so Box does the same:
                      subtitle is always present, with a muted hint
                      below when the bests list is empty. */}
                  <div className="boxmode-dashboard-bests">
                    <p className="boxmode-dashboard-subtitle">
                      {lang === 'nl' ? 'Persoonlijke records' : 'Personal bests'}
                    </p>
                    {boxBests.length === 0 ? (
                      <p className="boxmode-bests-empty-hint">
                        {lang === 'nl'
                          ? 'Voltooi een sessie om je eerste tijd vast te leggen.'
                          : 'Complete a session to record your first time.'}
                      </p>
                    ) : (
                      boxBests.slice(0, 4).map((b) => {
                        const scopeName = b.scope === 'all'
                          ? (lang === 'nl' ? 'Alle 66 boeken' : 'All 66 books')
                          : (translations[lang]?.groupNames?.[b.scope.split(':')[1]] || b.scope.split(':')[1]);
                        const totalSec = Math.round(b.fastestMs / 1000);
                        const m = Math.floor(totalSec / 60);
                        const s = totalSec % 60;
                        const time = `${m}:${String(s).padStart(2, '0')}`;
                        return (
                          <div className="boxmode-best-row" key={b.scope}>
                            <span className="boxmode-best-scope">{scopeName}</span>
                            <span className="boxmode-best-stats">
                              <span className="boxmode-best-time">{time}</span>
                              <span className="boxmode-best-sep">·</span>
                              <span className="boxmode-best-mistakes">
                                {b.fewestMistakes} {b.fewestMistakes === 1
                                  ? (lang === 'nl' ? 'fout' : 'mistake')
                                  : (lang === 'nl' ? 'fouten' : 'mistakes')}
                              </span>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Mode selector — tap to select (NOT launch). The Start
                  button below launches whichever is selected. Box on the
                  left as the more visible/concrete option, Quiz on the
                  right as the more abstract scheduled-review one. */}
              <div className="mode-cards mode-cards-selectable">
                <button
                  className={`mode-card${selectedMode === 'boxMode' ? ' mode-card-selected' : ''}`}
                  aria-label={t.boxModeBtnLabel}
                  aria-pressed={selectedMode === 'boxMode'}
                  onClick={() => setSelectedMode('boxMode')}
                >
                  <span className="mode-card-icon" aria-hidden="true">📦</span>
                  <span className="mode-card-label">{t.boxModeBtnLabel}</span>
                </button>
                <button
                  className={`mode-card${selectedMode === 'quiz' ? ' mode-card-selected' : ''}`}
                  aria-label={t.quizMode}
                  aria-pressed={selectedMode === 'quiz'}
                  onClick={() => setSelectedMode('quiz')}
                >
                  <span className="mode-card-icon" aria-hidden="true">🎯</span>
                  <span className="mode-card-label">{t.quizMode}</span>
                </button>
              </div>

              {/* Launcher row. Quiz Mode shows up to 3 session-size
                  buttons (Quick / Standard / Full) that snap to the
                  user's actual due+unseen count to avoid showing
                  redundant options. Box Mode keeps its single Start
                  CTA — Box Mode's pre-launch choice is *scope* (which
                  group?), made on the dedicated scope-picker screen,
                  not session size. The asymmetry is deliberate: each
                  mode surfaces its own meaningful choice.

                  For Quiz Mode the visible buttons are computed from
                  stats.dueNow (which includes both unseen books and
                  truly-due cards — see fsrs.js getBookStats). Logic:
                    - 0 due:   show Full anyway. Clicking will jump
                               straight to the session-complete screen
                               (existing behaviour for empty queue).
                               No need to special-case here.
                    - 1-5:     show only Full (Quick would == Full).
                    - 6-10:    show Quick (5) + Full.
                    - 11+:     show Quick (5) + Standard (10) + Full.
                  This way the user never sees three buttons that all
                  produce the same session — Quick=3 / Standard=3 /
                  Full=3 would be just confusing. */}
              {/* Height-stable wrapper around the launcher region.
                  Box Mode produces a single button (~56px), Quiz Mode
                  can produce 1-3 stacked launchers (up to ~184px).
                  Without min-height reservation the streak footer
                  below would jump up/down when the user switches
                  between mode cards. The CSS class reserves enough
                  height on mobile and collapses on wider screens. */}
              <div className="home-launcher-area">
                {selectedMode === 'boxMode' ? (
                  <button
                    className="btn home-start-btn"
                    onClick={() => goToMode('boxMode')}
                  >
                    {`${t.homeStartBoxMode} →`}
                  </button>
                ) : (
                  <div className="home-quiz-launchers">
                    {(() => {
                      const total = stats.dueNow;
                      const launchers = [];
                      if (total > 5) {
                        launchers.push({ key: 'quick', label: t.sessionSizeQuick, limit: 5, count: 5 });
                      }
                      if (total > 10) {
                        launchers.push({ key: 'standard', label: t.sessionSizeStandard, limit: 10, count: 10 });
                      }
                      launchers.push({ key: 'full', label: t.sessionSizeFull, limit: null, count: total });
                      return launchers.map(opt => {
                        const booksLabel = opt.count === 1
                          ? t.sessionSizeBookSingle
                          : t.sessionSizeBooks;
                        // Standard-size button gets the primary highlight when
                        // present (it's the recommended middle ground). Otherwise
                        // Full takes primary. Quick (when shown alongside others)
                        // is always secondary.
                        const isPrimary = (opt.key === 'standard')
                          || (opt.key === 'full' && launchers.length < 2);
                        return (
                          <button
                            key={opt.key}
                            className={`btn home-launcher-btn${isPrimary ? ' home-launcher-primary' : ''}`}
                            onClick={() => {
                              setQuizSessionLimit(opt.limit);
                              setQuizPhase('playing');
                              goToMode('quiz');
                            }}
                          >
                            <span className="launcher-label">{opt.label}</span>
                            <span className="launcher-count">{opt.count} {booksLabel}</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Always-visible streak. Shown regardless of suggested
                  mode because daily-engagement signal is universally
                  motivating, not Quiz-specific. */}
              {streakInfo.current > 0 && (
                <div className="menu-streak-footer">
                  <span className="streak-flame" aria-hidden="true">🔥</span>
                  <span className="streak-number">{streakInfo.current}</span>
                  <span className="streak-label">
                    {streakInfo.current === 1 ? t.dayStreakSingle : t.dayStreak}
                    {streakInfo.longest > streakInfo.current && (
                      <span className="streak-best"> · {t.streakBest} {streakInfo.longest}</span>
                    )}
                  </span>
                </div>
              )}

              {shareFeedback && <p className="share-feedback">{shareFeedback}</p>}
            </div>
          )}

          {view === 'boxMode' && (
            <BoxMode
              ownerUserId={currentUser.id}
              onBack={() => setView('menu')}
            />
          )}

          {quizPhase !== null && (
            <div style={{ display: view === 'quiz' ? 'contents' : 'none' }}>
              <QuizGrid
                ownerUserId={currentUser.id}
                fsrsCards={fsrsCards}
                updateFsrsCard={updateFsrsCard}
                bestTimes={currentUser.bestTimes || {}}
                updateBestTime={updateBestTime}
                bestStreak={currentUser.bestStreak || 0}
                setBestStreak={updateBestStreak}
                addQuizSession={addQuizSession}
                addTrainingTime={addTrainingTime}
                totalQuizMs={currentUser.totalQuizMs || 0}
                quizHistory={currentUser.quizHistory || []}
                sessionLimit={quizSessionLimit}
                onBack={() => {
                  setQuizPhase(null);
                  setQuizSessionLimit(null);
                  setView('menu');
                }}
                onPhaseChange={setQuizPhase}
              />
            </div>
          )}

          {view === 'settings' && (
            <Settings
              config={{ grid: config.grid, quiz: config.quiz, display: config.display, study: config.study, t }}
              onSave={saveConfig}
              onBack={() => {
                const back = previousView || 'menu';
                setPreviousView(null);
                setView(back);
              }}
              currentUser={currentUser}
              onRestore={handleRestore}
              onResetQuizProgress={doResetQuizProgress}
              onResetBoxProgress={doResetBoxProgress}
            />
          )}

          {view === 'help' && (
            <Help onBack={() => {
              const back = previousView || 'menu';
              setPreviousView(null);
              setView(back);
            }} />
          )}
        </main>
      </div>
    </ConfigContext.Provider>
  );
}

export default App;
