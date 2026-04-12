import { useState } from 'react';
import './Settings.css';

export default function Settings({ config, onSave, onBack, currentUser, onRestore }) {
  const [grid, setGrid] = useState(config.grid);
  const [quiz, setQuiz] = useState(config.quiz);
  const [display, setDisplay] = useState(config.display);
  const [activeTab, setActiveTab] = useState('grid');
  const [feedback, setFeedback] = useState('');

  const t = config.t;

  const tabs = [
    { id: 'grid', icon: '⊞', label: t.gridTab || 'Raster' },
    { id: 'quiz', icon: '⏱', label: t.quizTab || 'Quiz' },
    { id: 'data', icon: '👤', label: t.dataTab || 'Data' },
  ];

  const handleSave = (newConfig) => {
    onSave(newConfig);
  };

  const handleExport = async () => {
    if (!currentUser) return;
    const exportData = {
      app: 'BibleBookFinder',
      version: '2.0',
      exportDate: new Date().toISOString(),
      user: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar || 'book',
        foundBooks: currentUser.foundBooks || [],
        bestStreak: currentUser.bestStreak || 0,
        quizHistory: currentUser.quizHistory || [],
        fsrsCards: currentUser.fsrsCards || {},
        settings: {
          grid: config.grid,
          quiz: config.quiz,
          display: config.display,
        },
      }
    };
    const filename = `biblefinder-${currentUser.name.replace(/\s+/g, '-').toLowerCase()}-backup.json`;
    const json = JSON.stringify(exportData, null, 2);
    const file = new File([json], filename, { type: 'application/json' });

    // Mobile: use native share sheet (reliable on iOS Safari / PWA)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        setFeedback(t.exportSuccess || 'Exported!');
        setTimeout(() => setFeedback(''), 2500);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled
      }
    }

    // Desktop fallback: blob download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback(t.exportSuccess || 'Exported!');
    setTimeout(() => setFeedback(''), 2500);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.user || data.app !== 'BibleBookFinder') throw new Error('Invalid');
        
        const confirmImport = window.confirm(
          (config.display?.lang || 'nl') === 'nl' 
            ? 'Dit overschrijft jouw huidige voortgang en instellingen. Doorgaan?' 
            : 'This will overwrite your current progress and settings. Continue?'
        );
        if (confirmImport) {
          onRestore(data.user);
          // Update local state to reflect restored settings
          if (data.user.settings) {
            if (data.user.settings.grid) setGrid(data.user.settings.grid);
            if (data.user.settings.quiz) setQuiz(data.user.settings.quiz);
            if (data.user.settings.display) setDisplay(data.user.settings.display);
          }
          setFeedback(t.importSuccess || 'Restored!');
          setTimeout(() => { setFeedback(''); onBack(); }, 1500);
        }
      } catch {
        setFeedback(t.importError || 'Invalid file');
        setTimeout(() => setFeedback(''), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderTabContent = () => {
    if (activeTab === 'grid') {
      return (
        <>
          <h3>{t.gridTitle || 'Raster'}</h3>
          <p className="settings-desc">{t.gridDesc || 'Kolommen en schermstand.'}</p>
          <SettingRow label={t.portrait || 'Portret'} desc={t.portraitDesc || '(rechtop)'}>
            <NumberInput value={grid.portrait} min={3} max={11} onChange={v => {
              setGrid(g => ({ ...g, portrait: v }));
              handleSave({ grid: { ...grid, portrait: v }, quiz, display });
            }} />
          </SettingRow>
          <SettingRow label={t.landscape || 'Liggend'} desc={t.landscapeDesc || '(gedraaid)'}>
            <NumberInput value={grid.landscape} min={3} max={11} onChange={v => {
              setGrid(g => ({ ...g, landscape: v }));
              handleSave({ grid: { ...grid, landscape: v }, quiz, display });
            }} />
          </SettingRow>
          <SettingRow label={t.orientation || 'Schermstand'} desc={t.orientationDesc || '(forceer of auto)'}>
            <select value={grid.orientation} onChange={e => {
              setGrid(g => ({ ...g, orientation: e.target.value }));
              handleSave({ grid: { ...grid, orientation: e.target.value }, quiz, display });
            }} className="setting-select">
              <option value="auto">{t.auto || 'Automatisch'}</option>
              <option value="portrait">{t.portraitMode || 'Portret'}</option>
              <option value="landscape">{t.landscapeMode || 'Liggend'}</option>
            </select>
          </SettingRow>
          <SettingRow label={t.abbreviations || 'Afkortingen'} desc={t.abbreviationsDesc || '(portretmodus)'}>
            <select value={display.abbreviations || 'auto'} onChange={e => {
              setDisplay(d => ({ ...d, abbreviations: e.target.value }));
              handleSave({ grid, quiz, display: { ...display, abbreviations: e.target.value } });
            }} className="setting-select">
              <option value="auto">{t.abbrAuto || 'Auto'}</option>
              <option value="always">{t.abbrAlways || 'Altijd'}</option>
              <option value="never">{t.abbrNever || 'Nooit'}</option>
            </select>
          </SettingRow>
        </>
      );
    }
    if (activeTab === 'quiz') {
      return (
        <>
          <h3>{t.quizTitle || 'Snelheid'}</h3>
          <p className="settings-desc">{t.quizDesc || 'Tijdslimiet voor beheersing.'}</p>
          <SettingRow label={t.masterySpeed || 'Meesterschapssnelheid'} desc={t.masterySpeedDesc || '(antwoord binnen deze tijd = beheerst)'}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>{t.fast || 'Snel'}</span>
                <span>{t.slow || 'Relaxed'}</span>
              </div>
              <input
                type="range"
                min={1000}
                max={10000}
                step={250}
                value={quiz.masteryMs}
                onChange={e => {
                  const val = Number(e.target.value);
                  setQuiz(q => ({ ...q, masteryMs: val }));
                  handleSave({ grid, quiz: { ...quiz, masteryMs: val }, display });
                }}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                {quiz.masteryMs} ms
              </div>
            </div>
          </SettingRow>
          <SettingRow label={t.highlightFound || 'Mastered books'} desc={t.highlightFoundDesc || '(highlight mastered books)'}>
            <Toggle value={display.highlightFound} onChange={v => {
              setDisplay(d => ({ ...d, highlightFound: v }));
              handleSave({ grid, quiz, display: { ...display, highlightFound: v } });
            }} />
          </SettingRow>
          <SettingRow label={t.learningPace || 'Learning pace'} desc={t.learningPaceDesc || ''}>
            <select value={quiz.learningPace || 'balanced'} onChange={e => {
              setQuiz(q => ({ ...q, learningPace: e.target.value }));
              handleSave({ grid, quiz: { ...quiz, learningPace: e.target.value }, display });
            }} className="setting-select">
              <option value="relaxed">{t.paceRelaxed || 'Relaxed'}</option>
              <option value="balanced">{t.paceBalanced || 'Balanced'}</option>
              <option value="intensive">{t.paceIntensive || 'Intensive'}</option>
            </select>
          </SettingRow>
          {quiz.learningPace && (
            <div className="pace-hint">
              {quiz.learningPace === 'relaxed' && (t.paceRelaxedHint || '~5-10 min/day, master all books in ~6-8 weeks')}
              {(quiz.learningPace === 'balanced' || !quiz.learningPace) && (t.paceBalancedHint || '~10-20 min/day, master all books in ~3-4 weeks')}
              {quiz.learningPace === 'intensive' && (t.paceIntensiveHint || '~20-30 min/day, master all books in ~1-2 weeks')}
            </div>
          )}
        </>
      );
    }
    // DATA TAB
    return (
      <>
        <h3>{t.dataTitle || 'Voortgang beheren'}</h3>
        <p className="settings-desc">{t.dataDesc || 'Exporteer of importeer jouw persoonlijke voortgang en instellingen.'}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="btn-data btn-export" onClick={handleExport}>{t.exportBtn || 'Exporteer voortgang'}</button>
          <label className="btn-data btn-import">
            {t.importBtn || 'Importeer voortgang'}
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          {feedback && <p className="data-feedback">{feedback}</p>}
          <p className="data-warning">{t.importWarning || '⚠️ Importeren overschrijft jouw huidige voortgang en instellingen.'}</p>
        </div>
      </>
    );
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>← {t?.back || 'Terug'}</button>
        <h2>{t.settingsTitle || 'Instellingen'}</h2>
        <div style={{ width: 80 }} />
      </div>

      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-card">
        {renderTabContent()}
      </div>

      <p className="version-info">Bible Book Finder v2.0</p>
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        <div>
          <strong>{label}</strong>
          {desc && <span>{desc}</span>}
        </div>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function NumberInput({ value, min, max, step = 1, onChange }) {
  return (
    <div className="number-input">
      <button onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span className="setting-value">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button className={`toggle ${value ? 'on' : 'off'}`} onClick={() => onChange(!value)}>
      <span className="toggle-thumb" />
    </button>
  );
}
