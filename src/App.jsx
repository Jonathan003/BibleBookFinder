import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { bibleBooks, translations } from './data';
import { getCurrentUser, getUser, updateUser } from './users';
import { AvatarIcon } from './components/Icons';
import UserSelect from './components/UserSelect';
import StudyGrid from './components/StudyGrid';
import QuizGrid from './components/QuizGrid';
import Settings from './components/Settings';
import './App.css';

const defaultConfig = {
  grid: { portrait: 6, landscape: 5, orientation: 'auto' },
  quiz: { alwaysGoodMs: 2000, beatRecordMs: 2000 },
  display: { lang: 'nl', highlightFound: true },
};

function loadConfig() {
  try {
    const saved = localStorage.getItem('biblefinder_config');
    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

const ConfigContext = createContext(null);

export function useAppConfig() {
  const ctx = useContext(ConfigContext);
  return ctx || { config: defaultConfig, lang: 'nl', t: translations.nl };
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('menu');
  const [config, setConfig] = useState(loadConfig);
  const [shareFeedback, setShareFeedback] = useState('');

  const lang = config.display.lang;

  // Load current user on mount
  useEffect(() => {
    const userId = getCurrentUser();
    if (userId) {
      const user = getUser(userId);
      if (user) setCurrentUser(user);
    }
  }, []);

  const handleUserSelect = (user) => {
    setCurrentUser(user);
    if (user.settings?.lang) {
      setConfig(c => ({ ...c, display: { ...c.display, lang: user.settings.lang } }));
    }
  };

  const updateUserData = useCallback((updates) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    updateUser(currentUser.id, updates);
    setCurrentUser(updated);
  }, [currentUser]);

  const markFound = useCallback((bookId) => {
    if (!currentUser || currentUser.foundBooks?.includes(bookId)) return;
    const newFound = [...(currentUser.foundBooks || []), bookId];
    updateUserData({ foundBooks: newFound });
  }, [currentUser, updateUserData]);

  const updateBestStreak = useCallback((streak) => {
    if (!currentUser) return;
    const newBest = Math.max(currentUser.bestStreak || 0, streak);
    if (newBest > currentUser.bestStreak) {
      updateUserData({ bestStreak: newBest });
    }
  }, [currentUser, updateUserData]);

  const addQuizSession = useCallback((session) => {
    if (!currentUser) return;
    const history = [...(currentUser.quizHistory || []), { ...session, date: Date.now() }];
    updateUserData({ quizHistory: history });
  }, [currentUser, updateUserData]);

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

  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem('biblefinder_config', JSON.stringify(newConfig));
    setView('menu');
  };

  // Show user selection if no user
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
              setConfig(c => ({ ...c, display: { ...c.display, lang: newLang } }));
            }}>
              {lang === 'nl' ? '🇳🇱 NL' : '🇬🇧 EN'}
            </button>
          </div>
        </header>

        <main className="app-main">
          {view === 'menu' && (
            <div className="menu">
              <div className="stats">
                <div className="stat-card">
                  <span className="stat-number">{(currentUser.foundBooks || []).length}</span>
                  <span className="stat-label">{t.found} {t.of} 66</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{currentUser.bestStreak || 0}</span>
                  <span className="stat-label">{t.best} {t.streak}</span>
                </div>
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${((currentUser.foundBooks || []).length / 66) * 100}%` }} />
              </div>

              <div className="menu-buttons">
                <button className="btn primary" onClick={() => setView('study')}>{t.studyMode}</button>
                <button className="btn secondary" onClick={() => setView('quiz')}>{t.quizMode}</button>
                <button className="btn share" onClick={share}>{t.share}</button>
                {shareFeedback && <p className="share-feedback">{shareFeedback}</p>}
                <button className="btn reset" onClick={resetProgress}>{t.resetProgress}</button>
              </div>
            </div>
          )}

          {view === 'study' && (
            <StudyGrid
              foundBooks={currentUser.foundBooks || []}
              markFound={markFound}
              onBack={() => setView('menu')}
            />
          )}

          {view === 'quiz' && (
            <QuizGrid
              foundBooks={currentUser.foundBooks || []}
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
            />
          )}
        </main>
      </div>
    </ConfigContext.Provider>
  );
}

export default App;
