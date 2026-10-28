import React from 'react';
import { AlertOctagon, CheckCircle2, ExternalLink, ArrowRight } from 'lucide-react';

export default function RecentAnomaliesTable({
  anomalies = [],
  onNavigateToAnomalies,
  maxRows = 5,
  sourceNote,
}) {
  const displayRows = anomalies.slice(0, maxRows);

  const formatTimestamp = (ts) => {
    if (!ts) return '--';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } catch {
      return ts;
    }
  };

  const getScoreSeverity = (score) => {
    if (typeof score !== 'number') return { label: 'ANOMALY', className: 'badge-rose' };
    if (score < -0.3) return { label: 'CRITICAL ANOMALY', className: 'badge-rose' };
    return { label: 'MODERATE ANOMALY', className: 'badge-amber' };
  };

  return (
    <div className="glass-panel table-panel">
      <div className="table-header">
        <div className="title-group">
          <div className="icon-wrapper">
            <AlertOctagon size={16} />
          </div>
          <div>
            <h3 className="section-title">Detected System Anomalies</h3>
            <p className="section-subtitle">
              {sourceNote || 'Retrospective classification using trained Isolation Forest'}
            </p>
          </div>
        </div>

        {anomalies.length > maxRows && (
          <button
            onClick={onNavigateToAnomalies}
            className="btn-secondary view-all-btn"
          >
            <span>View All ({anomalies.length})</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {anomalies.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 size={36} className="text-emerald mb-2" />
          <h4 className="empty-title">Zero Anomalies Detected</h4>
          <p className="empty-desc">
            All historical metrics currently conform to typical baseline patterns.
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>CPU Usage</th>
                <th>Memory Usage</th>
                <th>Anomaly Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const severity = getScoreSeverity(row.score);
                return (
                  <tr key={i} className="row-anomaly">
                    <td className="mono-cell text-primary font-medium">
                      {formatTimestamp(row.timestamp)}
                    </td>
                    <td>
                      <span className="mono-cell font-semibold text-rose">
                        {typeof row.cpu_percent === 'number' ? row.cpu_percent.toFixed(1) : row.cpu_percent}%
                      </span>
                    </td>
                    <td>
                      <span className="mono-cell font-semibold text-amber">
                        {typeof row.mem_percent === 'number' ? row.mem_percent.toFixed(1) : row.mem_percent}%
                      </span>
                    </td>
                    <td>
                      <span className="mono-cell">
                        {typeof row.score === 'number' ? row.score.toFixed(3) : '--'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${severity.className}`}>
                        {severity.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .table-panel {
          padding: 20px;
          margin-bottom: 20px;
        }

        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background: rgba(244, 63, 94, 0.12);
          color: var(--color-rose);
          border: 1px solid rgba(244, 63, 94, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .section-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .section-subtitle {
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .view-all-btn {
          font-size: 0.75rem;
          padding: 5px 11px;
        }

        .empty-state {
          text-align: center;
          padding: 36px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .empty-title {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .empty-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .text-emerald {
          color: var(--color-emerald);
        }

        .text-rose {
          color: var(--color-rose);
        }

        .text-amber {
          color: var(--color-amber);
        }

        .mono-cell {
          font-family: var(--font-mono);
          font-size: 0.8rem;
        }

        .font-medium {
          font-weight: 500;
        }

        .font-semibold {
          font-weight: 600;
        }

        .mb-2 {
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
