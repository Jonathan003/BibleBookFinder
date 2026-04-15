import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { bibleBooks, translations } from './data';
import { getCurrentUser, getUser, updateUser, setCurrentUser as persistCurrentUser } from './users';
import { getBookStats } from './fsrs';
import { InitialAvatar } from './components/Icons';
import UserSelect from './components/UserSelect';
import StudyGrid from './components/StudyGrid';
import QuizGrid from './components/QuizGrid';
import Settings from './components/Settings';
import './App.css';

export const defaultConfig = {
  grid: { portrait: 6, landscape: 5, orientation: 'auto' },
  quiz: { masteryMs: 5000, learningPace: 'balanced', autoScroll: true },
  display: { lang: 'nl', highlightFound: true, abbreviations: 'auto' },
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
  return {
    grid: { ...defaultConfig.grid, ...(saved.grid || {}) },
    quiz: { ...defaultConfig.quiz, ...(saved.quiz || {}) },
    display: { ...defaultConfig.display, ...(saved.display || {}) },
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
  const [config, setConfig] = useState(defaultConfig);
  const [shareFeedback, setShareFeedback] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState(null); // '24h' | '7d' | null

  const lang = config.display.lang;

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
    const userConfig = mergeConfig(user.settings);
    setConfig(userConfig);

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

  const updateUserData = useCallback((updates) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    updateUser(currentUser.id, updates);
    setCurrentUserState(updated);
  }, [currentUser]);

  // FSRS card management
  const updateFsrsCard = useCallback((bookId, cardData) => {
    if (!currentUser) return;
    const fsrsCards = { ...(currentUser.fsrsCards || {}), [bookId]: cardData };
    updateUserData({ fsrsCards });
  }, [currentUser, updateUserData]);

  const updateBestStreak = useCallback((streak) => {
    if (!currentUser) return;
    const newBest = Math.max(currentUser.bestStreak || 0, streak);
    if (newBest > (currentUser.bestStreak || 0)) {
      updateUserData({ bestStreak: newBest });
    }
  }, [currentUser, updateUserData]);

  const addQuizSession = useCallback((session) => {
    if (!currentUser) return;
    const history = [...(currentUser.quizHistory || []), { ...session, date: Date.now() }];
    updateUserData({ quizHistory: history });
  }, [currentUser, updateUserData]);

  const updateBestTime = useCallback((bookId, ms) => {
    if (!currentUser) return;
    const bestTimes = { ...(currentUser.bestTimes || {}), [bookId]: ms };
    updateUserData({ bestTimes });
  }, [currentUser, updateUserData]);

  // FSRS-based stats
  const fsrsCards = currentUser?.fsrsCards || {};
  const stats = getBookStats(fsrsCards, bibleBooks);

  const resetProgress = () => {
    if (!currentUser) return;
    if (!window.confirm(lang === 'nl'
      ? 'Weet je zeker dat je je voortgang wilt wissen?'
      : 'Are you sure you want to reset your progress?')) return;
    updateUserData({ foundBooks: [], bestStreak: 0, quizHistory: [], fsrsCards: {} });
  };

  const share = () => {
    if (!currentUser) return;
    const text = (lang === 'nl'
      ? `Ik heb ${stats.mastered} van 66 bijbelboeken beheerst in de Bijbelboek Zoeker quiz!`
      : `I mastered ${stats.mastered} out of 66 Bible books in the Bible Book Finder quiz!`
    );
    if (navigator.share) {
      navigator.share({ title: 'Bible Book Finder', text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(text + ' ' + window.location.href);
      setShareFeedback(lang === 'nl' ? 'Gekopieerd!' : 'Copied!');
      setTimeout(() => setShareFeedback(''), 2500);
    }
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
    const restoredConfig = mergeConfig(userData.settings);
    updateUserData({
      foundBooks: userData.foundBooks || [],
      bestStreak: userData.bestStreak || 0,
      quizHistory: userData.quizHistory || [],
      fsrsCards: userData.fsrsCards || {},
      bestTimes: userData.bestTimes || {},
      lastActive: userData.lastActive || 0,
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
            {view === 'menu' && (
              <button className="settings-btn" onClick={() => setView('settings')} title="Instellingen">
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

              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(stats.mastered / 66) * 100}%` }} />
              </div>

              <div className="menu-buttons">
                <button className="btn study-btn" onClick={() => setView('study')}>
                  <span className="btn-icon">📖</span>
                  <span>{t.studyMode}</span>
                </button>
                <button className="btn quiz-btn" onClick={() => setView('quiz')}>
                  <span className="btn-icon">🎯</span>
                  <span>{t.quizMode}</span>
                </button>
                <button className="btn share-btn" onClick={share}>
                  <span className="btn-icon">🔗</span>
                  <span>{t.share}</span>
                </button>
                {shareFeedback && <p className="share-feedback">{shareFeedback}</p>}
                <button className="btn reset-btn" onClick={resetProgress}>
                  <span className="btn-icon">🗑️</span>
                  <span>{t.resetProgress}</span>
                </button>
              </div>
            </div>
          )}

          {view === 'study' && (
            <StudyGrid
              fsrsCards={fsrsCards}
              savedGroups={config.study?.selectedGroups || []}
              onSaveGroups={(groups) => saveConfig({
                ...config,
                study: { ...config.study, selectedGroups: groups }
              })}
              onBack={() => setView('menu')}
            />
          )}

          {view === 'quiz' && (
            <QuizGrid
              fsrsCards={fsrsCards}
              updateFsrsCard={updateFsrsCard}
              bestTimes={currentUser.bestTimes || {}}
              updateBestTime={updateBestTime}
              bestStreak={currentUser.bestStreak || 0}
              setBestStreak={updateBestStreak}
              addQuizSession={addQuizSession}
              onBack={() => setView('menu')}
            />
          )}

          {view === 'settings' && (
            <Settings
              config={{ grid: config.grid, quiz: config.quiz, display: config.display, study: config.study, t }}
              onSave={saveConfig}
              onBack={() => setView('menu')}
              currentUser={currentUser}
              onRestore={handleRestore}
            />
          )}
        </main>
      </div>
    </ConfigContext.Provider>
  );
}

export default App;
