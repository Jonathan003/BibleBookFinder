import { useState } from 'react';
import './Settings.css';

export default function Settings({ config, onSave, onBack }) {
  const [grid, setGrid] = useState(config.grid);
  const [quiz, setQuiz] = useState(config.quiz);
  const [display, setDisplay] = useState(config.display);
  const [activeTab, setActiveTab] = useState('grid');

  const t = config.t;

  const tabs = [
    { id: 'grid', icon: '⊞', label: t.gridTab || 'Raster' },
    { id: 'quiz', icon: '⏱', label: t.quizTab || 'Quiz' },
    { id: 'display', icon: '🎨', label: t.displayTab || 'Weergave' },
  ];

  const handleSave = () => {
    onSave({ grid, quiz, display });
  };

  const handleReset = () => {
    setGrid({ portrait: 6, landscape: 5, orientation: 'auto' });
    setQuiz({ alwaysGoodMs: 2000, beatRecordMs: 2000 });
    setDisplay({ lang: 'nl', highlightFound: true });
  };

  const renderTabContent = () => {
    if (activeTab === 'grid') {
      return (
        <>
          <h3>{t.gridTitle || 'Raster'}</h3>
          <p className="settings-desc">{t.gridDesc || 'Kolommen en schermstand.'}</p>
          <SettingRow label={t.portrait || 'Portret'} desc={t.portraitDesc || '(rechtop)'}>
            <NumberInput value={grid.portrait} min={3} max={11} onChange={v => setGrid(g => ({ ...g, portrait: v }))} />
          </SettingRow>
          <SettingRow label={t.landscape || 'Liggend'} desc={t.landscapeDesc || '(gedraaid)'}>
            <NumberInput value={grid.landscape} min={3} max={11} onChange={v => setGrid(g => ({ ...g, landscape: v }))} />
          </SettingRow>
          <SettingRow label={t.orientation || 'Schermstand'} desc={t.orientationDesc || '(forceer of auto)'}>
            <select value={grid.orientation} onChange={e => setGrid(g => ({ ...g, orientation: e.target.value }))} className="setting-select">
              <option value="auto">{t.auto || 'Automatisch'}</option>
              <option value="portrait">{t.portraitMode || 'Portret'}</option>
              <option value="landscape">{t.landscapeMode || 'Liggend'}</option>
            </select>
          </SettingRow>
        </>
      );
    }
    if (activeTab === 'quiz') {
      return (
        <>
          <h3>{t.quizTitle || 'Snelheid'}</h3>
          <p className="settings-desc">{t.quizDesc || 'Tijdslimieten in milliseconden.'}</p>
          <SettingRow label={t.alwaysGood || 'Altijd goed'} desc={t.alwaysGoodDesc || '(≤ deze tijd = goed)'}>
            <NumberInput value={quiz.alwaysGoodMs} min={500} max={10000} step={500} onChange={v => setQuiz(q => ({ ...q, alwaysGoodMs: v }))} />
          </SettingRow>
          <SettingRow label={t.beatRecord || 'Record verslaan'} desc={t.beatRecordDesc || '(tolerantie boven record)'}>
            <NumberInput value={quiz.beatRecordMs} min={500} max={10000} step={500} onChange={v => setQuiz(q => ({ ...q, beatRecordMs: v }))} />
          </SettingRow>
        </>
      );
    }
    return (
      <>
        <h3>{t.displayTitle || 'Weergave'}</h3>
        <p className="settings-desc">{t.displayDesc || 'Taal en kleuren.'}</p>
        <SettingRow label={t.language || 'Taal'}>
          <select value={display.lang} onChange={e => setDisplay(d => ({ ...d, lang: e.target.value }))} className="setting-select">
            <option value="nl">🇳🇱 NL</option>
            <option value="en">🇬 EN</option>
          </select>
        </SettingRow>
        <SettingRow label={t.highlightFound || 'Gevonden boeken'} desc={t.highlightFoundDesc || '(markeer gevonden boeken)'}>
          <Toggle value={display.highlightFound} onChange={v => setDisplay(d => ({ ...d, highlightFound: v }))} />
        </SettingRow>
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
        <div className="settings-actions">
          <button className="btn-save" onClick={handleSave}>{t.save || 'Opslaan'}</button>
          <button className="btn-reset" onClick={handleReset}>{t.resetDefaults || 'Standaard'}</button>
        </div>
      </div>

      <p className="version-info">Bible Book Finder v1.0</p>
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
