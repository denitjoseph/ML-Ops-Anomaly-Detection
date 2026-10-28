import React from 'react';
import {
  Cpu,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  Database,
  ArrowUpRight,
  TrendingUp,
  Clock,
} from 'lucide-react';

export default function SummaryCards({
  currentMetrics,
  latestPrediction,
  historyCount = 0,
  isLoading,
}) {
  const latest = currentMetrics?.latest;
  const cpuVal = typeof latest?.cpu_percent === 'number' ? latest.cpu_percent : null;
  const memVal = typeof latest?.mem_percent === 'number' ? latest.mem_percent : null;

  // Format relative timestamp
  const formatTimestamp = (ts) => {
    if (!ts) return 'No data';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  // Threshold helpers
  const getThresholdColor = (val) => {
    if (val === null) return 'var(--text-muted)';
    if (val >= 85) return 'var(--color-rose)';
    if (val >= 70) return 'var(--color-amber)';
    return 'var(--color-emerald)';
  };

  const isAnomaly = latestPrediction?.is_anomaly ?? (latestPrediction?.label === 'ANOMALY');

  return (
    <div className="summary-grid">
      {/* 1. CPU Usage Card */}
      <div className="glass-panel summary-card glow-cyan">
        <div className="card-header">
          <span className="card-label">CPU Utilization</span>
          <div className="card-icon-wrapper cyan">
            <Cpu size={16} />
          </div>
        </div>

        <div className="card-body">
          {isLoading && cpuVal === null ? (
            <div className="skeleton value-skeleton" />
          ) : (
            <div className="value-group">
              <span className="metric-value">
                {cpuVal !== null ? cpuVal.toFixed(1) : '--'}
              </span>
              <span className="metric-unit">%</span>
            </div>
          )}

          <div className="progress-container">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, Math.max(0, cpuVal || 0))}%`,
                background: getThresholdColor(cpuVal),
              }}
            />
          </div>

          <div className="card-footer">
            <span className="footer-note">
              {cpuVal !== null && cpuVal > 80 ? (
                <span className="text-rose font-medium">High Load Threshold</span>
              ) : (
                <span className="text-secondary">Expected operating range</span>
              )}
            </span>
            <span className="badge badge-muted">Core Metrics</span>
          </div>
        </div>
      </div>

      {/* 2. Memory Usage Card */}
      <div className="glass-panel summary-card glow-cyan">
        <div className="card-header">
          <span className="card-label">Memory Utilization</span>
          <div className="card-icon-wrapper blue">
            <HardDrive size={16} />
          </div>
        </div>

        <div className="card-body">
          {isLoading && memVal === null ? (
            <div className="skeleton value-skeleton" />
          ) : (
            <div className="value-group">
              <span className="metric-value">
                {memVal !== null ? memVal.toFixed(1) : '--'}
              </span>
              <span className="metric-unit">%</span>
            </div>
          )}

          <div className="progress-container">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, Math.max(0, memVal || 0))}%`,
                background: getThresholdColor(memVal),
              }}
            />
          </div>

          <div className="card-footer">
            <span className="footer-note">
              {memVal !== null && memVal > 85 ? (
                <span className="text-amber font-medium">Memory Pressure High</span>
              ) : (
                <span className="text-secondary">System RAM utilization</span>
              )}
            </span>
            <span className="badge badge-muted">RAM Buffer</span>
          </div>
        </div>
      </div>

      {/* 3. Latest Anomaly Status Card */}
      <div className={`glass-panel summary-card ${isAnomaly ? 'glow-rose border-rose-active' : ''}`}>
        <div className="card-header">
          <span className="card-label">Anomaly Classification</span>
          <div className={`card-icon-wrapper ${isAnomaly ? 'rose' : 'emerald'}`}>
            {isAnomaly ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
          </div>
        </div>

        <div className="card-body">
          {isLoading && !latestPrediction ? (
            <div className="skeleton value-skeleton" />
          ) : (
            <div className="status-badge-container">
              {isAnomaly ? (
                <span className="badge badge-rose large-badge">
                  <AlertTriangle size={14} /> Anomaly Detected
                </span>
              ) : (
                <span className="badge badge-emerald large-badge">
                  <ShieldCheck size={14} /> Normal Behavior
                </span>
              )}
            </div>
          )}

          <div className="score-details">
            <span className="score-label">Isolation Score:</span>
            <span className="score-value">
              {typeof latestPrediction?.score === 'number'
                ? latestPrediction.score.toFixed(3)
                : 'Pending'}
            </span>
          </div>

          <div className="card-footer">
            <span className="footer-note truncate" title={latestPrediction?.score_note || 'Evaluated via Isolation Forest'}>
              {latestPrediction?.score_note || 'Isolation Forest Model'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Telemetry Stream Records Card */}
      <div className="glass-panel summary-card">
        <div className="card-header">
          <span className="card-label">Historical Samples</span>
          <div className="card-icon-wrapper violet">
            <Database size={16} />
          </div>
        </div>

        <div className="card-body">
          {isLoading && !currentMetrics ? (
            <div className="skeleton value-skeleton" />
          ) : (
            <div className="value-group">
              <span className="metric-value">
                {currentMetrics?.total_records ?? historyCount ?? 0}
              </span>
              <span className="metric-unit">points</span>
            </div>
          )}

          <div className="sample-meta">
            <div className="meta-row">
              <Clock size={12} className="text-muted" />
              <span className="meta-label">Latest Log:</span>
              <span className="meta-value">{formatTimestamp(latest?.timestamp)}</span>
            </div>
          </div>

          <div className="card-footer">
            <span className="footer-note text-secondary">
              Logged in <code className="mono-pill">data/metrics.csv</code>
            </span>
            <span className="badge badge-emerald">Online</span>
          </div>
        </div>
      </div>

      <style>{`
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .summary-card {
          padding: 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
        }

        .summary-card.border-rose-active {
          border-color: rgba(244, 63, 94, 0.4);
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.05) 0%, rgba(12, 18, 32, 0.85) 100%);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .card-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .card-icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-icon-wrapper.cyan {
          background: rgba(56, 189, 248, 0.12);
          color: var(--color-cyan);
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .card-icon-wrapper.blue {
          background: rgba(59, 130, 246, 0.12);
          color: var(--color-blue);
          border: 1px solid rgba(59, 130, 246, 0.25);
        }

        .card-icon-wrapper.emerald {
          background: rgba(16, 185, 129, 0.12);
          color: var(--color-emerald);
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .card-icon-wrapper.rose {
          background: rgba(244, 63, 94, 0.14);
          color: var(--color-rose);
          border: 1px solid rgba(244, 63, 94, 0.35);
        }

        .card-icon-wrapper.violet {
          background: rgba(139, 92, 246, 0.12);
          color: var(--color-violet);
          border: 1px solid rgba(139, 92, 246, 0.25);
        }

        .card-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .value-group {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .metric-value {
          font-size: 1.85rem;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
        }

        .metric-unit {
          font-size: 0.9rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .value-skeleton {
          height: 36px;
          width: 120px;
          margin-bottom: 4px;
        }

        .progress-container {
          height: 5px;
          width: 100%;
          background: rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .status-badge-container {
          margin-bottom: 2px;
        }

        .large-badge {
          padding: 6px 12px;
          font-size: 0.8rem;
        }

        .score-details {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .score-value {
          font-family: var(--font-mono);
          color: var(--text-primary);
          font-weight: 600;
        }

        .sample-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.76rem;
        }

        .meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
        }

        .meta-value {
          font-family: var(--font-mono);
          color: var(--text-secondary);
        }

        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid var(--border-subtle);
          font-size: 0.72rem;
        }

        .footer-note {
          color: var(--text-muted);
        }

        .truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }

        .text-rose { color: var(--color-rose); }
        .text-amber { color: var(--color-amber); }
        .text-secondary { color: var(--text-secondary); }
        .font-medium { font-weight: 600; }

        .mono-pill {
          font-family: var(--font-mono);
          background: rgba(255, 255, 255, 0.05);
          padding: 1px 4px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
