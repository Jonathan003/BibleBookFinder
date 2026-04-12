import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { bibleBooks, translations } from './data';
import { getCurrentUser, getUser, updateUser, setCurrentUser as persistCurrentUser } from './users';
import { AvatarIcon } from './components/Icons';
import UserSelect from './components/UserSelect';
import StudyGrid from './components/StudyGrid';
import QuizGrid from './components/QuizGrid';
import Settings from './components/Settings';
import './App.css';

export const defaultConfig = {
  grid: { portrait: 6, landscape: 5, orientation: 'auto' },
  quiz: { masteryMs: 5000 },
  display: { lang: 'nl', highlightFound: true },
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
      }
    }
  }, []);

  const handleUserSelect = (user) => {
    setCurrentUserState(user);
    persistCurrentUser(user.id);
    const userConfig = mergeConfig(user.settings);
    setConfig(userConfig);
  };

  const updateUserData = useCallback((updates) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    updateUser(currentUser.id, updates);
    setCurrentUserState(updated);
  }, [currentUser]);

  const markFound = useCallback((bookId) => {
    if (!currentUser || currentUser.foundBooks?.includes(bookId)) return;
    const newFound = [...(currentUser.foundBooks || []), bookId];
    updateUserData({ foundBooks: newFound });
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

  const RECENT_SESSIONS = 5;
  const recentSessions = (currentUser?.quizHistory || []).slice(-RECENT_SESSIONS);
  const masteredBookIds = [...new Set(recentSessions.flatMap(s => s.masteredBookIds || []))];

  const resetProgress = () => {
    if (!currentUser) return;
    if (!window.confirm(lang === 'nl'
      ? 'Weet je zeker dat je je voortgang wilt wissen?'
      : 'Are you sure you want to reset your progress?')) return;
    updateUserData({ foundBooks: [], bestStreak: 0, quizHistory: [] });
  };

  const share = () => {
    if (!currentUser) return;
    const foundCount = (currentUser.foundBooks || []).length;
    const text = (lang === 'nl'
      ? `Ik heb ${foundCount} van 66 bijbelboeken gevonden in de Bijbelboek Zoeker quiz!`
      : `I found ${foundCount} out of 66 Bible books in the Bible Book Finder quiz!`
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
      name: userData.name || currentUser.name,
      avatar: userData.avatar || currentUser.avatar,
      foundBooks: userData.foundBooks || [],
      bestStreak: userData.bestStreak || 0,
      quizHistory: userData.quizHistory || [],
      settings: restoredConfig,
    });
    setConfig(restoredConfig);
  };

  if (!currentUser) {
    return (
      <ConfigContext.Provider value={{ config, lang, t }}>
        <div className="app">
          <UserSelect onSelect={handleUserSelect} />
        </div>
      </ConfigContext.Provider>
    );
  }

  return (
    <ConfigContext.Provider value={{ config, lang, t }}>
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <button className="user-btn" onClick={() => setView('settings')}>
              <span className="header-avatar">
                <AvatarIcon name={currentUser.avatar || 'book'} size={24} />
              </span>
              <span className="header-name">{currentUser.name}</span>
            </button>
            <p className="subtitle">{t.subtitle}</p>
          </div>
          <div className="header-right">
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
              <div className="stats">
                <div className="stat-card">
                  <span className="stat-number">{masteredBookIds.length}</span>
                  <span className="stat-label">{t.mastered} {t.of} 66</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{currentUser.bestStreak || 0}</span>
                  <span className="stat-label">{t.best} {t.streak}</span>
                </div>
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(masteredBookIds.length / 66) * 100}%` }} />
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
              quizHistory={currentUser?.quizHistory || []}
              onBack={() => setView('menu')}
            />
          )}

          {view === 'quiz' && (
            <QuizGrid
              foundBooks={currentUser.foundBooks || []}
              masteredBookIds={masteredBookIds}
              markFound={markFound}
              bestStreak={currentUser.bestStreak || 0}
              setBestStreak={updateBestStreak}
              addQuizSession={addQuizSession}
              onBack={() => setView('menu')}
            />
          )}

          {view === 'settings' && (
            <Settings
              config={{ grid: config.grid, quiz: config.quiz, display: config.display, t }}
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
