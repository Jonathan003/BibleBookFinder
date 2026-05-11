import { useState, useEffect, useRef } from 'react';
import { stripDeviceScoped } from '../settingsScope';
import { formatDuration } from '../timeFormat';
import { getBookStats } from '../fsrs';
import { bibleBooks } from '../data';
import { APP_COMMIT, APP_BUILD_DATE } from '../version';
import './Settings.css';

export default function Settings({ config, onSave, onBack, currentUser, onRestore, onResetQuizProgress, onResetBoxProgress }) {
  // All settings held in a single atomic object. A functional updater on
  // one state makes field changes race-free by construction: React's
  // reducer semantics guarantee each update sees the result of the
  // previous one, so no "closure-stale" rebuild is possible.
  const [settings, setSettings] = useState({
    grid: config.grid,
    quiz: config.quiz,
    display: config.display,
    study: config.study || {},
    boxMode: config.boxMode || { failMode: 'soft', timePressure: 'soft-10s' },
  });
  const { grid, quiz, display, boxMode } = settings;

  const [activeTab, setActiveTab] = useState('grid');
  const [feedback, setFeedback] = useState('');
  // Backup import confirmation.  Instead of a browser window.confirm, we
  // stash the parsed backup data here and render an in-app panel that
  // matches the Reset Progress dialog styling.  Cross-user imports get
  // an extra warning line.
  const [pendingImport, setPendingImport] = useState(null);
  // Reset Progress confirmation. A single state holds which reset is
  // mid-confirmation: 'quiz' for Quiz Mode reset, 'box' for Box Mode
  // reset, null when no confirmation is open. Single state instead of
  // two booleans because the two confirms are mutually exclusive — only
  // one can be open at a time, and using a single string makes that
  // invariant explicit and unbreakable.
  const [confirmReset, setConfirmReset] = useState(null);

  // Hidden <input type="file"> ref. Used by the import flow as a fallback
  // when showOpenFilePicker is unavailable (Safari, Firefox) or fails.
  const fileInputRef = useRef(null);

  // Persist on settings change, without coupling state updates to side
  // effects (which would double-fire under strict mode). `shouldSaveRef`
  // marks updates that came from user interaction; mount and import-
  // driven updates leave it false so we don't re-persist data that the
  // parent already persisted.
  const shouldSaveRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  useEffect(() => {
    if (!shouldSaveRef.current) return;
    shouldSaveRef.current = false;
    onSaveRef.current(settings);
  }, [settings]);

  const t = config.t;

  const tabs = [
    { id: 'grid', icon: '⊞', label: t.gridTab || 'Raster' },
    // Tab id stays 'quiz' for backwards compatibility with URL state /
    // saved-tab persistence, but the visible label is now 'Training'
    // since the tab covers Quiz + Study + Box Mode settings.
    { id: 'quiz', icon: '⏱', label: t.trainingTab || t.quizTab || 'Training' },
    { id: 'data', icon: '👤', label: t.dataTab || 'Data' },
  ];

  // Atomic field update. Pure functional update — no side effects here.
  // The persistence effect above picks up the change via `settings` dep.
  const updateField = (section, field, value) => {
    shouldSaveRef.current = true;
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const handleExport = async () => {
    if (!currentUser) return;
    // Strip device-scoped settings (column counts, abbreviation modes,
    // OT/NT layout, autoScroll) so the backup is portable across devices.
    // Each device keeps its own screen-related preferences. See
    // src/settingsScope.js for the canonical list.
    const portableSettings = stripDeviceScoped({
      grid: config.grid,
      quiz: config.quiz,
      display: config.display,
      study: config.study,
      // Box Mode settings (failMode, timePressure) — without this,
      // a backup/restore round-trip silently reverted the user's Box
      // Mode preferences to defaults. Bug fix in v3 schema.
      boxMode: config.boxMode,
    });
    const exportData = {
      app: 'BibleBookFinder',
      version: '3.0',
      // Internal schema version for the user-data shape inside `user`.
      // Bump this when adding/removing tracked fields. Restore code uses
      // `?? defaultValue` for graceful handling of older backups, so a
      // missing field never crashes — but explicit versioning lets us
      // add real migrations later if a field's shape ever changes.
      // v2 added: totalQuizMs (cumulative active-quiz time, in ms).
      // v3 added: boxModeBests (per-scope Box Mode personal records)
      //          and config.boxMode in settings.
      _schemaVersion: 3,
      exportDate: new Date().toISOString(),
      user: {
        id: currentUser.id,
        name: currentUser.name,
        bestStreak: currentUser.bestStreak || 0,
        quizHistory: currentUser.quizHistory || [],
        fsrsCards: currentUser.fsrsCards || {},
        settings: portableSettings,
        bestTimes: currentUser.bestTimes || {},
        // Box Mode personal bests per scope ('all', 'group:law', etc).
        // Live on the user record (per boxModeStorage.js) but were
        // previously omitted from the export shape. Bug fix in v3.
        boxModeBests: currentUser.boxModeBests || {},
        lastActive: currentUser.lastActive || 0,
        masteryMsAtStart: currentUser.masteryMsAtStart || null,
        totalQuizMs: currentUser.totalQuizMs || 0,
      }
    };
    const filename = `biblebookfinder-${currentUser.name.replace(/\s+/g, '-')}-backup.json`;
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    // Three-tier export, in order of UX quality:
    //
    //   1. File System Access API (Chrome/Edge desktop, Chrome Android)
    //      — best UX: native Save As dialog where the user navigates freely
    //      to any folder (incl. OneDrive, Google Drive Desktop, Dropbox if
    //      installed locally). Browser handles overwrite confirmation. No
    //      "(1)" duplicates.
    //
    //   2. Web Share API with files (Safari iOS/iPadOS, Chrome Android as
    //      alternative path) — opens the system share sheet, where the user
    //      picks "Save to Files" / "Save to Drive" / "Save to OneDrive" /
    //      etc. depending on installed apps. Each app handles overwrite.
    //
    //   3. Anchor download (Firefox, older browsers, fallback) — file goes
    //      to the browser's default Downloads folder. Browser may auto-
    //      append "(1)" on duplicates; not under our control.
    //
    // Each tier honours user cancellation (AbortError) without falling
    // through — falling through would surprise the user with a download
    // they explicitly cancelled. Only technical failures fall through.

    // Tier 1: File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'BibleBookFinder backup',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setFeedback(t.exportSuccess || 'Exported!');
        setTimeout(() => setFeedback(''), 2500);
        return;
      } catch (err) {
        // User cancelled the Save As dialog — respect that, do nothing.
        if (err.name === 'AbortError') return;
        // Other errors (e.g. permission denied, write failure) fall through
        // to the next tier so the user still gets their backup somehow.
      }
    }

    // Tier 2: Web Share API with files
    //
    // Some Android Chrome builds (notably on older/budget Samsung tablets
    // like the Tab A8) reject `application/json` in canShare's allowlist
    // even though the same browser version on a flagship phone accepts it.
    // The Chromium whitelist of shareable MIME types varies by build and
    // OS-level share-target registration. As a fallback we retry with
    // `text/plain`, which is universally accepted across all Chromium
    // builds. The file contents are identical (still valid JSON); only
    // the MIME label differs. Import validates on extension + parsed
    // content, not on MIME, so this is fully transparent to restore.
    for (const mime of ['application/json', 'text/plain']) {
      const file = new File([json], filename, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          setFeedback(t.exportSuccess || 'Exported!');
          setTimeout(() => setFeedback(''), 2500);
          return;
        } catch (err) {
          if (err.name === 'AbortError') return; // user cancelled
          // Other errors fall through to the universal fallback.
          break; // don't retry with text/plain after a real share failure
        }
      }
    }

    // Tier 3: Anchor download (universal fallback)
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

  // Parse and stage a backup file for import. Used by both the modern
  // showOpenFilePicker path and the legacy <input type="file"> path.
  const stagePendingImport = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.user || data.app !== 'BibleBookFinder') throw new Error('Invalid');

        // Stash the parsed backup and let the inline confirm panel take over.
        // Cross-user flag drives the extra warning line in the panel.
        const backupName  = data.user.name || '?';
        const currentName = currentUser?.name || '?';
        setPendingImport({
          userData:   data.user,
          backupName,
          currentName,
          crossUser:  backupName !== currentName,
        });
      } catch {
        setFeedback(t.importError || 'Invalid file');
        setTimeout(() => setFeedback(''), 3000);
      }
    };
    reader.readAsText(file);
  };

  // Two-tier import, mirroring the export's three-tier structure:
  //
  //   1. File System Access API (Chrome/Edge desktop, Chrome Android)
  //      — opens a native Open dialog where the user navigates freely
  //      to any folder, including cloud-synced ones. Same UX as desktop
  //      software.
  //
  //   2. <input type="file"> (universal fallback) — works in every
  //      browser including Safari iOS, Firefox, etc. The OS handles
  //      navigation through its own file picker.
  //
  // Note: there is no "Web Share API" tier for import, because Web Share
  // is one-way (sharing OUT, not reading IN). Mobile users go through
  // the legacy <input type="file"> path, which on iOS opens the Files
  // app and on Android opens the storage access framework — both fine.
  const handleImportClick = async () => {
    // Tier 1: File System Access API
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'BibleBookFinder backup',
            accept: { 'application/json': ['.json'] },
          }],
          multiple: false,
        });
        const file = await handle.getFile();
        stagePendingImport(file);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled
        // Other errors fall through to the legacy path.
      }
    }

    // Tier 2: programmatically click the hidden <input type="file">.
    fileInputRef.current?.click();
  };

  // Legacy <input type="file"> change handler — used when the modern
  // API is unavailable or fails. Reads the chosen file and stages it
  // for import via the same code path as the modern API.
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) stagePendingImport(file);
    e.target.value = '';
  };

  const doImport = () => {
    if (!pendingImport) return;
    const { userData } = pendingImport;
    setPendingImport(null);
    onRestore(userData);
    if (userData.settings) {
      // onRestore already persisted everything; we just need to sync our
      // local UI state. Leave shouldSaveRef false so the persistence
      // effect doesn't write the same data back again.
      setSettings(prev => ({
        grid:    userData.settings.grid    || prev.grid,
        quiz:    userData.settings.quiz    || prev.quiz,
        display: userData.settings.display || prev.display,
        study:   userData.settings.study   || prev.study,
        boxMode: userData.settings.boxMode || prev.boxMode,
      }));
    }
    setFeedback(t.importSuccess || 'Restored!');
    setTimeout(() => { setFeedback(''); onBack(); }, 1500);
  };

  const renderTabContent = () => {
    if (activeTab === 'grid') {
      const isSideBySide = display.testamentsLayout === 'sideBySide';
      return (
        <>
          <h3>{t.gridTitle || 'Raster'}</h3>
          <p className="settings-desc">{t.gridDesc || 'Kolommen en schermstand.'}</p>
          <SettingRow label={t.portrait || 'Portret'} desc={t.portraitDesc || '(rechtop)'}>
            <NumberInput value={grid.portrait} min={3} max={11} onChange={v => updateField('grid', 'portrait', v)} />
          </SettingRow>
          <SettingRow label={t.testamentsLayout || 'OT/NT layout (liggend)'} desc={t.testamentsLayoutDesc || '(naast of onder elkaar)'}>
            <select value={display.testamentsLayout || 'stacked'} onChange={e => updateField('display', 'testamentsLayout', e.target.value)} className="setting-select">
              <option value="stacked">{t.layoutStacked || 'Onder elkaar'}</option>
              <option value="sideBySide">{t.layoutSideBySide || 'Naast elkaar'}</option>
            </select>
          </SettingRow>
          {!isSideBySide && (
            <SettingRow label={t.landscape || 'Liggend'} desc={t.landscapeDesc || '(gedraaid)'}>
              <NumberInput value={grid.landscape} min={3} max={11} onChange={v => updateField('grid', 'landscape', v)} />
            </SettingRow>
          )}
          {isSideBySide && (
            <>
              <SettingRow label={t.landscapeOT || 'Liggend OT'} desc={t.landscapeOTDesc || '(kolommen voor Hebreeuws-Aramees)'}>
                <NumberInput value={grid.landscapeSideBySideOT ?? 4} min={2} max={8} onChange={v => updateField('grid', 'landscapeSideBySideOT', v)} />
              </SettingRow>
              <SettingRow label={t.landscapeNT || 'Liggend NT'} desc={t.landscapeNTDesc || '(kolommen voor Christelijk Grieks)'}>
                <NumberInput value={grid.landscapeSideBySideNT ?? 3} min={2} max={8} onChange={v => updateField('grid', 'landscapeSideBySideNT', v)} />
              </SettingRow>
            </>
          )}
          <SettingRow label={t.orientation || 'Schermstand'} desc={t.orientationDesc || '(forceer of auto)'}>
            <select value={grid.orientation} onChange={e => updateField('grid', 'orientation', e.target.value)} className="setting-select">
              <option value="auto">{t.auto || 'Automatisch'}</option>
              <option value="portrait">{t.portraitMode || 'Portret'}</option>
              <option value="landscape">{t.landscapeMode || 'Liggend'}</option>
            </select>
          </SettingRow>
          <SettingRow label={t.abbreviationsPortrait || 'Afkortingen (portret)'} desc={t.abbreviationsPortraitDesc || '(rechtop)'}>
            <select value={display.abbreviationsPortrait || 'auto'} onChange={e => updateField('display', 'abbreviationsPortrait', e.target.value)} className="setting-select">
              <option value="auto">{t.abbrAuto || 'Automatisch'}</option>
              <option value="full">{t.abbrFull || 'Volle namen'}</option>
              <option value="long">{t.abbrLong || 'Lange afkortingen'}</option>
              <option value="short">{t.abbrShort || 'Korte afkortingen'}</option>
            </select>
          </SettingRow>
          <SettingRow label={t.abbreviationsLandscape || 'Afkortingen (liggend)'} desc={t.abbreviationsLandscapeDesc || '(gedraaid)'}>
            <select value={display.abbreviationsLandscape || 'auto'} onChange={e => updateField('display', 'abbreviationsLandscape', e.target.value)} className="setting-select">
              <option value="auto">{t.abbrAuto || 'Automatisch'}</option>
              <option value="full">{t.abbrFull || 'Volle namen'}</option>
              <option value="long">{t.abbrLong || 'Lange afkortingen'}</option>
              <option value="short">{t.abbrShort || 'Korte afkortingen'}</option>
            </select>
          </SettingRow>
        </>
      );
    }
    if (activeTab === 'quiz') {
      return (
        <>
          {/* ─── Shared ───────────────────────────────────────────── */}
          {/* Settings that apply across multiple modes (Quiz, Study,
              Box Mode where relevant). Mastery speed governs both Quiz
              Mode's mastery threshold AND Box Mode's default soft-timer
              budget when "Match Quiz" is the timePressure choice (future
              enhancement); auto-scroll is universal. */}
          <h4 className="settings-subsection">{t.settingsSubsectionShared || 'Shared'}</h4>
          <SettingRow label={t.masterySpeed || 'Meesterschapssnelheid'} desc={t.masterySpeedDesc || '(antwoord binnen deze tijd = beheerst)'} fullWidth>
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
                onChange={e => updateField('quiz', 'masteryMs', Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                {quiz.masteryMs} ms
              </div>
            </div>
          </SettingRow>
          <SettingRow label={t.autoScroll || 'Auto-scroll'} desc={t.autoScrollDesc || '(scroll to the asked book on each question)'}>
            <Toggle value={display.autoScroll !== false} onChange={v => updateField('display', 'autoScroll', v)} />
          </SettingRow>
          <SettingRow label={t.highlightFound || 'Mastered books'} desc={t.highlightFoundDesc || '(highlight mastered books)'}>
            <Toggle value={display.highlightFound} onChange={v => updateField('display', 'highlightFound', v)} />
          </SettingRow>

          {/* ─── Quiz ────────────────────────────────────────────── */}
          <h4 className="settings-subsection">{t.settingsSubsectionQuiz || 'Quiz Mode'}</h4>
          <SettingRow label={t.learningPace || 'Learning pace'} desc={t.learningPaceDesc || ''}>
            <select value={quiz.learningPace || 'balanced'} onChange={e => updateField('quiz', 'learningPace', e.target.value)} className="setting-select">
              <option value="flexible">{t.paceFlexible || 'Flexible'}</option>
              <option value="relaxed">{t.paceRelaxed || 'Relaxed'}</option>
              <option value="balanced">{t.paceBalanced || 'Balanced'}</option>
              <option value="intensive">{t.paceIntensive || 'Intensive'}</option>
            </select>
          </SettingRow>
          {quiz.learningPace && (
            <div className="pace-hint">
              {quiz.learningPace === 'flexible' && (t.paceFlexibleHint || 'Lightest schedule — come when you have time, no daily pressure')}
              {quiz.learningPace === 'relaxed' && (t.paceRelaxedHint || '~5-10 min/day, master all books in ~6-8 weeks')}
              {(quiz.learningPace === 'balanced' || !quiz.learningPace) && (t.paceBalancedHint || '~10-20 min/day, master all books in ~3-4 weeks')}
              {quiz.learningPace === 'intensive' && (t.paceIntensiveHint || '~20-30 min/day, master all books in ~1-2 weeks')}
            </div>
          )}

          {/* ─── Box Mode ─────────────────────────────────────────── */}
          {/* failMode = behavior on wrong answer.
                'soft' (default) drops one box; 'strict' resets to box 1.
              timePressure = whether (and how strictly) to enforce a
                per-question time budget.
                'off'      = no timer; user can take as long as they want
                'soft-Xs'  = X-second soft threshold; if it expires before
                             a correct answer, the book counts correct
                             but does NOT advance to the next box (same
                             pattern as a hint). Default 'soft-10s'.
                'hard-Xs'  = X-second hard deadline; if it expires, treat
                             as a wrong answer (auto-reveal correct +
                             demote box).
              The two-mode design follows what RemNote users requested
              and Crammfly ships, with Quiz-Mode-style "soft threshold"
              as the default for consistency with mastery scoring. */}
          <h4 className="settings-subsection">{t.settingsSubsectionBoxMode || 'Box Mode'}</h4>
          <SettingRow label={t.boxModeFailModeLabel || 'On wrong answer'} desc={t.boxModeFailModeDesc || ''}>
            <select value={boxMode.failMode || 'soft'} onChange={e => updateField('boxMode', 'failMode', e.target.value)} className="setting-select">
              <option value="soft">{t.boxModeFailModeSoft || 'Drop one box'}</option>
              <option value="strict">{t.boxModeFailModeStrict || 'Back to box 1'}</option>
            </select>
          </SettingRow>
          <SettingRow label={t.boxModeTimePressureLabel || 'Time pressure'} desc={t.boxModeTimePressureDesc || ''}>
            <select value={boxMode.timePressure || 'soft-10s'} onChange={e => updateField('boxMode', 'timePressure', e.target.value)} className="setting-select">
              <option value="off">{t.boxModeTimePressureOff || 'Off'}</option>
              <option value="soft-5s">{t.boxModeTimePressureSoft5  || 'Soft, 5s'}</option>
              <option value="soft-8s">{t.boxModeTimePressureSoft8  || 'Soft, 8s'}</option>
              <option value="soft-10s">{t.boxModeTimePressureSoft10 || 'Soft, 10s (default)'}</option>
              <option value="soft-15s">{t.boxModeTimePressureSoft15 || 'Soft, 15s'}</option>
              <option value="soft-20s">{t.boxModeTimePressureSoft20 || 'Soft, 20s'}</option>
              <option value="hard-5s">{t.boxModeTimePressureHard5  || 'Hard, 5s'}</option>
              <option value="hard-8s">{t.boxModeTimePressureHard8  || 'Hard, 8s'}</option>
              <option value="hard-10s">{t.boxModeTimePressureHard10 || 'Hard, 10s'}</option>
              <option value="hard-15s">{t.boxModeTimePressureHard15 || 'Hard, 15s'}</option>
              <option value="hard-20s">{t.boxModeTimePressureHard20 || 'Hard, 20s'}</option>
            </select>
          </SettingRow>
          {boxMode.timePressure && boxMode.timePressure !== 'off' && (
            <div className="pace-hint">
              {boxMode.timePressure.startsWith('soft-')
                ? (t.boxModeTimePressureSoftHint || 'Slow correct answer = no advancement')
                : (t.boxModeTimePressureHardHint || 'Slow answer = wrong (auto-reveal + demote)')}
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
        <div className="data-stat-row">
          <span className="data-stat-label">{t.totalTrainingTime}</span>
          <span className="data-stat-value">{formatDuration(currentUser?.totalQuizMs || 0)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="btn-data btn-export" onClick={handleExport}>{t.exportBtn || 'Exporteer voortgang'}</button>
          <button className="btn-data btn-import" onClick={handleImportClick}>
            {t.importBtn || 'Importeer voortgang'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
          {feedback && <p className="data-feedback">{feedback}</p>}
          {!pendingImport && (
            <p className="data-warning">{t.importWarning || '⚠️ Importeren overschrijft jouw huidige voortgang en instellingen.'}</p>
          )}
          {pendingImport && (
            <div className="reset-confirm-panel">
              <span className="reset-confirm-msg">
                {pendingImport.crossUser
                  ? (t.confirmImportCrossMsg || '⚠️ Deze back-up is van "{backup}", je bent ingelogd als "{current}". Dit overschrijft {current}\'s voortgang en instellingen met die van {backup}.')
                      .replaceAll('{backup}',  pendingImport.backupName)
                      .replaceAll('{current}', pendingImport.currentName)
                  : (t.confirmImportMsg || 'Dit overschrijft jouw huidige voortgang en instellingen.')}
              </span>
              {/* Diff display: shows current vs incoming state side-by-side
                  so the user can spot accidentally importing an OLDER backup
                  over freshly-earned progress (the most common dataloss
                  footgun for backup/restore systems). Mastered/66 + total
                  training time are the two metrics that capture meaningful
                  progress at a glance. */}
              <div className="restore-diff">
                <div className="restore-diff-row">
                  <span className="restore-diff-label">{t.restoreCurrent}</span>
                  <span className="restore-diff-value">
                    {getBookStats(currentUser?.fsrsCards || {}, bibleBooks).mastered}/66 {t.restoreMastered}
                    {(currentUser?.totalQuizMs || 0) > 0 && ` · ${formatDuration(currentUser?.totalQuizMs || 0)}`}
                  </span>
                </div>
                <div className="restore-diff-row">
                  <span className="restore-diff-label">{t.restoreIncoming}</span>
                  <span className="restore-diff-value">
                    {getBookStats(pendingImport.userData?.fsrsCards || {}, bibleBooks).mastered}/66 {t.restoreMastered}
                    {(pendingImport.userData?.totalQuizMs || 0) > 0 && ` · ${formatDuration(pendingImport.userData?.totalQuizMs || 0)}`}
                  </span>
                </div>
              </div>
              <div className="reset-confirm-buttons">
                <button className="btn-confirm-reset" onClick={doImport}>{t.confirmImport || 'Herstel'}</button>
                <button className="btn-cancel-reset" onClick={() => setPendingImport(null)}>{t.cancelImport || 'Annuleer'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Reset Progress — moved here from the home menu so the menu
            stays focused on practice (Quiz/Study/Share). Reset is a
            data-management action that belongs alongside backup/restore.
            Visually separated by a divider and the destructive red-tinted
            button styling so it can't be tapped accidentally. */}
        <div className="settings-divider" />
        <h3 className="data-section-heading">{t.resetSectionTitle || 'Voortgang resetten'}</h3>
        <p className="settings-desc">{t.resetSectionDesc || 'Wis je voortgang per modus. Dit kan niet ongedaan worden gemaakt.'}</p>

        {/* Reset Quiz Mode — wipes FSRS, mastery, streak, best times,
            quiz history, totalQuizMs. Box Mode bests untouched. */}
        <button
          className="btn-data btn-reset-progress"
          onClick={() => setConfirmReset('quiz')}
          disabled={confirmReset !== null}
        >
          🗑️ {t.resetQuizProgress || 'Quiz-voortgang wissen'}
        </button>
        {confirmReset === 'quiz' && (
          <div className="reset-confirm-panel">
            <span className="reset-confirm-msg">{t.confirmResetQuizMsg || t.confirmResetMsg}</span>
            <div className="reset-confirm-buttons">
              <button
                className="btn-confirm-reset"
                onClick={() => {
                  setConfirmReset(null);
                  if (onResetQuizProgress) onResetQuizProgress();
                }}
              >
                {t.confirmReset}
              </button>
              <button className="btn-cancel-reset" onClick={() => setConfirmReset(null)}>{t.cancelReset}</button>
            </div>
          </div>
        )}

        {/* Reset Box Mode — wipes per-scope personal bests only.
            FSRS / Quiz data untouched. */}
        <button
          className="btn-data btn-reset-progress"
          onClick={() => setConfirmReset('box')}
          disabled={confirmReset !== null}
        >
          🗑️ {t.resetBoxProgress || 'Doos-voortgang wissen'}
        </button>
        {confirmReset === 'box' && (
          <div className="reset-confirm-panel">
            <span className="reset-confirm-msg">{t.confirmResetBoxMsg || t.confirmResetMsg}</span>
            <div className="reset-confirm-buttons">
              <button
                className="btn-confirm-reset"
                onClick={() => {
                  setConfirmReset(null);
                  if (onResetBoxProgress) onResetBoxProgress();
                }}
              >
                {t.confirmReset}
              </button>
              <button className="btn-cancel-reset" onClick={() => setConfirmReset(null)}>{t.cancelReset}</button>
            </div>
          </div>
        )}
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

      <p className="version-info">
        Bible Book Finder v2.0
        {APP_COMMIT !== 'unknown' && (
          <>
            <br />
            <span className="version-build">{APP_BUILD_DATE} ({APP_COMMIT})</span>
          </>
        )}
      </p>
    </div>
  );
}

function SettingRow({ label, desc, children, fullWidth }) {
  return (
    <div className={`setting-row${fullWidth ? ' setting-row-full' : ''}`}>
      <div className="setting-label">
        <div>
          <strong>{label}</strong>
          {desc && <span>{desc}</span>}
        </div>
      </div>
      <div className={fullWidth ? 'setting-control-full' : 'setting-control'}>{children}</div>
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
