import React, { useState } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Info,
  Layers,
  Search,
} from 'lucide-react';

export default function AnomaliesView({
  anomalies = [],
  totalHistoryCount = 0,
  anomaliesSource,
  isLoading,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'critical' | 'moderate'

  // Anomaly rate calculation
  const anomalyRate = totalHistoryCount > 0
    ? ((anomalies.length / totalHistoryCount) * 100).toFixed(1)
    : '0.0';

  // Severity classification helper
  const getSeverity = (score) => {
    if (typeof score !== 'number') return { type: 'critical', label: 'CRITICAL ANOMALY', badge: 'badge-rose' };
    if (score < -0.3) return { type: 'critical', label: 'CRITICAL ANOMALY', badge: 'badge-rose' };
    return { type: 'moderate', label: 'MODERATE ANOMALY', badge: 'badge-amber' };
  };

  // Severity counts
  const criticalCount = anomalies.filter((a) => (typeof a.score === 'number' ? a.score < -0.3 : true)).length;
  const moderateCount = anomalies.length - criticalCount;

  // Filtered anomalies
  const filtered = anomalies.filter((a) => {
    const sev = getSeverity(a.score);
    if (severityFilter === 'critical' && sev.type !== 'critical') return false;
    if (severityFilter === 'moderate' && sev.type !== 'moderate') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        a.timestamp?.toLowerCase().includes(q) ||
        String(a.cpu_percent).includes(q) ||
        String(a.mem_percent).includes(q)
      );
    }
    return true;
  });

  return (
    <div className="anomalies-container">
      {/* Overview Cards */}
      <div className="anomalies-metrics-grid">
        <div className="glass-panel stat-card glow-rose">
          <div className="card-top">
            <span className="card-title">Total Anomalies</span>
            <div className="icon-wrapper rose">
              <AlertOctagon size={16} />
            </div>
          </div>
          <div className="card-val-row">
            <span className="big-stat text-rose">{anomalies.length}</span>
            <span className="stat-unit">events</span>
          </div>
          <span className="stat-desc">Identified across historical dataset</span>
        </div>

        <div className="glass-panel stat-card">
          <div className="card-top">
            <span className="card-title">Dataset Contamination Rate</span>
            <div className="icon-wrapper amber">
              <Sliders size={16} />
            </div>
          </div>
          <div className="card-val-row">
            <span className="big-stat text-amber">{anomalyRate}%</span>
            <span className="stat-unit">of {totalHistoryCount} total logs</span>
          </div>
          <span className="stat-desc">Isolation Forest empirical ratio</span>
        </div>

        <div className="glass-panel stat-card">
          <div className="card-top">
            <span className="card-title">Severity Breakdown</span>
            <div className="icon-wrapper cyan">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="severity-bar-group">
            <div className="sev-row">
              <span className="sev-label">Critical (Score &lt; -0.30):</span>
              <span className="sev-count text-rose font-bold">{criticalCount}</span>
            </div>
            <div className="sev-row">
              <span className="sev-label">Moderate (Score &ge; -0.30):</span>
              <span className="sev-count text-amber font-bold">{moderateCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Retrospective Context Notice */}
      <div className="glass-panel notice-panel">
        <Info size={18} className="text-cyan shrink-0" />
        <div className="notice-body">
          <h4 className="notice-title">MLOps Retrospective Classification</h4>
          <p className="notice-text">
            {anomaliesSource ||
              'These anomalies were classified retrospectively by executing the trained Isolation Forest model over the full historical CSV stream. They represent readings that deviate significantly from baseline system clusters.'}
          </p>
        </div>
      </div>

      {/* Filter and Table Panel */}
      <div className="glass-panel table-panel">
        <div className="filter-header">
          <div className="search-box">
            <Search size={15} className="text-muted" />
            <input
              type="text"
              placeholder="Search anomalies by timestamp or load..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-pill-group">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`pill-btn ${severityFilter === 'all' ? 'active' : ''}`}
            >
              All ({anomalies.length})
            </button>
            <button
              onClick={() => setSeverityFilter('critical')}
              className={`pill-btn ${severityFilter === 'critical' ? 'active' : ''}`}
            >
              Critical ({criticalCount})
            </button>
            <button
              onClick={() => setSeverityFilter('moderate')}
              className={`pill-btn ${severityFilter === 'moderate' ? 'active' : ''}`}
            >
              Moderate ({moderateCount})
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>CPU Utilization</th>
                <th>Memory Utilization</th>
                <th>Isolation Score</th>
                <th>Classification</th>
                <th>Model Inference Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    <CheckCircle2 size={32} className="text-emerald mb-2" />
                    <p className="text-primary font-medium">No anomaly records found</p>
                    <p className="text-muted text-xs">All records within normal parameters</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const sev = getSeverity(item.score);
                  const score = typeof item.score === 'number' ? item.score : parseFloat(item.score);
                  let note = 'Outlier observation';
                  if (score < -0.3) note = 'Severe divergence — readily partitioned by random trees';
                  else if (score < -0.1) note = 'Moderate divergence — outside dense baseline cluster';

                  return (
                    <tr key={idx} className="row-anomaly">
                      <td className="mono-cell text-primary font-medium">
                        {item.timestamp}
                      </td>
                      <td>
                        <span className="mono-cell font-bold text-rose">
                          {typeof item.cpu_percent === 'number' ? item.cpu_percent.toFixed(1) : item.cpu_percent}%
                        </span>
                      </td>
                      <td>
                        <span className="mono-cell font-bold text-amber">
                          {typeof item.mem_percent === 'number' ? item.mem_percent.toFixed(1) : item.mem_percent}%
                        </span>
                      </td>
                      <td>
                        <span className="mono-cell">
                          {typeof item.score === 'number' ? item.score.toFixed(4) : item.score || '--'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${sev.badge}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="text-secondary text-xs">
                        {note}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .anomalies-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .anomalies-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
        }

        .stat-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .card-title {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-wrapper.rose {
          background: rgba(244, 63, 94, 0.12);
          color: var(--color-rose);
        }

        .icon-wrapper.amber {
          background: rgba(245, 158, 11, 0.12);
          color: var(--color-amber);
        }

        .icon-wrapper.cyan {
          background: rgba(56, 189, 248, 0.12);
          color: var(--color-cyan);
        }

        .card-val-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin-bottom: 6px;
        }

        .big-stat {
          font-size: 2rem;
          font-weight: 700;
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
        }

        .stat-unit {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .stat-desc {
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .severity-bar-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 4px;
        }

        .sev-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .font-bold { font-weight: 700; }
        .text-rose { color: var(--color-rose); }
        .text-amber { color: var(--color-amber); }
        .text-cyan { color: var(--color-cyan); }
        .text-emerald { color: var(--color-emerald); }

        .notice-panel {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 20px;
          background: rgba(56, 189, 248, 0.05);
          border-color: rgba(56, 189, 248, 0.2);
        }

        .notice-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .notice-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-cyan);
        }

        .notice-text {
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .table-panel {
          padding: 0;
          overflow: hidden;
        }

        .filter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-subtle);
          flex-wrap: wrap;
          gap: 12px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          padding: 6px 12px;
          border-radius: var(--radius-md);
          width: 320px;
          max-width: 100%;
        }

        .search-input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 0.82rem;
          width: 100%;
        }

        .filter-pill-group {
          display: flex;
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          padding: 3px;
          border-radius: var(--radius-md);
          gap: 4px;
        }

        .pill-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 0.76rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .pill-btn:hover {
          color: var(--text-primary);
        }

        .pill-btn.active {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
          font-weight: 600;
        }

        .mono-cell {
          font-family: var(--font-mono);
          font-size: 0.8rem;
        }

        .text-xs {
          font-size: 0.72rem;
        }

        .empty-cell {
          text-align: center;
          padding: 40px 16px;
        }
      `}</style>
    </div>
  );
}
