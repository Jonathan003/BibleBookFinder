import { useMemo } from 'react';
import { translations } from '../data';
import './Statistics.css';

// Compact statistics page: three headline numbers and an empty state.
// No charts or session lists — for a 66-item learning app the ambient
// "X of 66 mastered" indicator on the main menu already provides the
// primary progress signal.  This page exists to show cumulative effort.
export default function Statistics({ user, lang, onBack }) {
  const t = translations[lang];
  const history = user?.quizHistory || [];

  const metrics = useMemo(() => {
    const total = history.length;
    if (total === 0) {
      return { total: 0, avgScorePct: 0, bestStreak: user?.bestStreak || 0 };
    }
    const scoreSum = history.reduce((acc, s) => {
      return acc + (s.total > 0 ? s.correct / s.total : 0);
    }, 0);
    return {
      total,
      avgScorePct: Math.round((scoreSum / total) * 100),
      bestStreak: user?.bestStreak || 0,
    };
  }, [history, user]);

  return (
    <div className="stats-page">
      <header className="stats-header">
        <button className="stats-back-btn" onClick={onBack} aria-label={t.back}>
          ←
        </button>
        <h2>{t.statistics}</h2>
        <span className="stats-header-spacer" />
      </header>

      {history.length === 0 ? (
        <div className="stats-empty">
          <div className="stats-empty-icon">📊</div>
          <h3>{t.noStatsYet}</h3>
          <p>{t.noStatsHint}</p>
        </div>
      ) : (
        <div className="stats-content">
          <section className="stats-metrics">
            <div className="stats-metric">
              <span className="stats-metric-value">{metrics.total}</span>
              <span className="stats-metric-label">{t.totalSessions}</span>
            </div>
            <div className="stats-metric">
              <span className="stats-metric-value">{metrics.avgScorePct}%</span>
              <span className="stats-metric-label">{t.averageScore}</span>
            </div>
            <div className="stats-metric">
              <span className="stats-metric-value">{metrics.bestStreak}</span>
              <span className="stats-metric-label">{t.bestStreakLabel}</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
