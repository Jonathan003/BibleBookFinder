import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { bibleBooks, translations } from './data';
import { getCurrentUser, getUser, updateUser, addToTotalQuizMs, setCurrentUser as persistCurrentUser } from './users';
import { getBookStats } from './fsrs';
import { applyDeviceScoped } from './settingsScope';
import { formatDuration } from './timeFormat';
import { InitialAvatar } from './components/Icons';
import UserSelect from './components/UserSelect';
import StudyGrid from './components/StudyGrid';
import QuizGrid from './components/QuizGrid';
import Settings from './components/Settings';
import Help from './components/Help';
import './App.css';

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
  quiz: { masteryMs: 10000, learningPace: 'intensive', autoScroll: true },
  display: {
    lang: detectedLang,
    highlightFound: true,
    abbreviationsPortrait: 'auto',
    abbreviationsLandscape: 'auto',
    // 'stacked' (current behavior — OT above NT) or 'sideBySide' (JW Library
    // landscape look — OT and NT next to each other). Only meaningful in
    // landscape; portrait is always stacked because there's no horizontal
    // room for two halves.
    testamentsLayout: 'stacked',
  },
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
  return {
    grid: { ...defaultConfig.grid, ...(saved.grid || {}) },
    quiz: { ...defaultConfig.quiz, ...(saved.quiz || {}) },
    display,
    study: { ...defaultConfig.study, ...(saved.study || {}) },
  };
}

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
  const [confirmReset, setConfirmReset] = useState(false);

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

  const lang = config.display.lang;

  // "Focus mode" = the user is actively doing a task; the header should
  // show only the language toggle to reduce distraction. From the summary
  // screen (a deliberate pause) or from Settings/Help, full nav returns.
  const inFocusMode =
    (view === 'quiz' && quizPhase === 'playing') ||
    view === 'study';

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
    // Always return to the menu on user switch. Without this, switching
    // user while Quiz/Study/Settings was open would drop the new user
    // straight into that screen with the previous user's state.
    setView('menu');
    setPreviousView(null);
    setQuizPhase(null);
    setConfirmReset(false);

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

  // Open the inline confirm panel instead of the default browser dialog.
  // The panel appears below the menu buttons and matches the style used
  // for user deletion confirmation in UserSelect.
  const resetProgress = () => {
    if (!currentUser) return;
    setConfirmReset(true);
  };

  const doResetProgress = () => {
    setConfirmReset(false);
    if (!currentUser) return;
    // Reset wipes everything earned by quiz activity, including the
    // cumulative training-time counter. After reset, the next share
    // message reflects only post-reset training time.
    updateUserData({ bestStreak: 0, quizHistory: [], fsrsCards: {}, bestTimes: {}, masteryMsAtStart: config.quiz.masteryMs, totalQuizMs: 0 });
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
    const speedMs = config.quiz.masteryMs;
    const speedUnchanged = currentUser.masteryMsAtStart != null && currentUser.masteryMsAtStart === speedMs;
    const speedStr = speedUnchanged ? ` (${(speedMs / 1000).toFixed(speedMs % 1000 ? 1 : 0)}s)` : '';

    // Include training time in the share when there's any to show.
    // Earlier design gated this behind `mastered >= 1`, but in practice
    // that just hid the counter inexplicably for users with real time
    // invested but no mastery yet. Two simpler rules instead:
    //   - If totalMs is 0 (legacy account or just-imported backup with
    //     no time tracked), the suffix is omitted — nothing to show.
    //   - Otherwise show it. The `(10s)` speed suffix already serves
    //     as the "this was earned legitimately" signal; an extra gate
    //     here is redundant.
    // The format string is the same in both NL and EN messages because
    // "8h 32m" reads naturally to a Dutch audience too.
    const totalMs = currentUser.totalQuizMs || 0;
    const timeStr = totalMs > 0 ? ` in ${formatDuration(totalMs)}` : '';

    const text = (lang === 'nl'
      ? `Ik heb ${stats.mastered} van 66 bijbelboeken beheerst${timeStr}${speedStr} in de Bijbelboek Zoeker quiz!`
      : `I mastered ${stats.mastered} out of 66 Bible books${timeStr}${speedStr} in the Bible Book Finder quiz!`
    );
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
              <div className="stats">
                <div className="stat-card">
                  <span className="stat-number">{stats.mastered}</span>
                  <span className="stat-label">{t.mastered} {t.of} 66</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{stats.dueNow}</span>
                  <span className="stat-label">{t.readyToPractice}</span>
                </div>
              </div>

              <div className="progress-section">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(stats.mastered / 66) * 100}%` }}>
                    {stats.mastered > 0 && (
                      <span className="progress-text">{Math.round((stats.mastered / 66) * 100)}%</span>
                    )}
                  </div>
                </div>
                <span className="progress-label">{stats.mastered}/66 {t.mastered?.toLowerCase()}</span>
              </div>

              <div className="menu-buttons">
                <button className="btn study-btn" onClick={() => setView('study')}>
                  <span className="btn-icon">📖</span>
                  <span>{t.studyMode}</span>
                </button>
                <button className="btn quiz-btn" onClick={() => {
                  setQuizPhase('playing');
                  setView('quiz');
                }}>
                  <span className="btn-icon">🎯</span>
                  <span>{t.quizMode}</span>
                </button>
                <button className="btn share-btn" onClick={share}>
                  <span className="btn-icon">🔗</span>
                  <span>{t.share}</span>
                </button>
                <button className="btn reset-btn" onClick={resetProgress}>
                  <span className="btn-icon">🗑️</span>
                  <span>{t.resetProgress}</span>
                </button>
                {confirmReset && (
                  <div className="reset-confirm-panel">
                    <span className="reset-confirm-msg">{t.confirmResetMsg}</span>
                    <div className="reset-confirm-buttons">
                      <button className="btn-confirm-reset" onClick={doResetProgress}>{t.confirmReset}</button>
                      <button className="btn-cancel-reset" onClick={() => setConfirmReset(false)}>{t.cancelReset}</button>
                    </div>
                  </div>
                )}
                {shareFeedback && <p className="share-feedback">{shareFeedback}</p>}
              </div>
            </div>
          )}

          {view === 'study' && (
            <StudyGrid
              fsrsCards={fsrsCards}
              savedGroups={config.study.selectedGroups}
              onSaveGroups={(groups) => saveConfig({
                ...config,
                study: { ...config.study, selectedGroups: groups }
              })}
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
                onBack={() => {
                  setQuizPhase(null);
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
