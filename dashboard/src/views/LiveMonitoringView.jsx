import React from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Radio,
  Play,
  Pause,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export default function LiveMonitoringView({
  currentMetrics,
  latestPrediction,
  historyRecords = [],
  autoRefresh,
  setAutoRefresh,
  onRefresh,
  isRefreshing,
  refreshInterval,
  setRefreshInterval,
}) {
  const latest = currentMetrics?.latest;
  const cpu = typeof latest?.cpu_percent === 'number' ? latest.cpu_percent : 0;
  const mem = typeof latest?.mem_percent === 'number' ? latest.mem_percent : 0;

  // Stream of recent 10 records
  const recentStream = historyRecords.slice(-10).reverse();

  // Meter color logic
  const getColor = (val) => {
    if (val >= 85) return '#f43f5e';
    if (val >= 70) return '#f59e0b';
    return '#10b981';
  };

  const isAnomaly = latestPrediction?.is_anomaly ?? (latestPrediction?.label === 'ANOMALY');

  return (
    <div className="live-view-container">
      {/* Live Header & Polling Controls */}
      <div className="glass-panel live-control-panel">
        <div className="control-left">
          <div className="pulse-icon-container">
            <Radio size={18} className="text-cyan animate-pulse-slow" />
          </div>
          <div>
            <h2 className="live-title">Real-Time Telemetry Stream</h2>
            <p className="live-subtitle">
              Live CPU & memory polling loop directly hooked into the collector CSV log.
            </p>
          </div>
        </div>

        <div className="control-right">
          <div className="interval-selector">
            <span className="selector-label">Cadence:</span>
            {[2, 5, 10, 30].map((sec) => (
              <button
                key={sec}
                onClick={() => setRefreshInterval(sec)}
                className={`interval-btn ${refreshInterval === sec ? 'active' : ''}`}
              >
                {sec}s
              </button>
            ))}
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn-secondary ${autoRefresh ? 'stream-active' : ''}`}
          >
            {autoRefresh ? <Pause size={14} /> : <Play size={14} />}
            <span>{autoRefresh ? 'Pause Stream' : 'Resume Stream'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn-primary"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Poll Now</span>
          </button>
        </div>
      </div>

      {/* Radial / Arc Gauges Section */}
      <div className="meters-grid">
        {/* CPU Gauge Card */}
        <div className="glass-panel meter-card">
          <div className="meter-header">
            <div className="meter-badge-cyan">
              <Cpu size={16} />
            </div>
            <div>
              <h3 className="meter-name">CPU Core Workload</h3>
              <span className="meter-sub">Dynamic processor load</span>
            </div>
            <span className="badge badge-muted ml-auto">Core 0</span>
          </div>

          <div className="gauge-display">
            <div className="radial-meter">
              <svg viewBox="0 0 100 100" className="gauge-svg">
                <circle
                  className="gauge-bg"
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                />
                <circle
                  className="gauge-val"
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                  stroke={getColor(cpu)}
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * cpu) / 100}
                />
              </svg>
              <div className="gauge-center-text">
                <span className="gauge-val-text">{cpu.toFixed(1)}</span>
                <span className="gauge-unit">%</span>
              </div>
            </div>
          </div>

          <div className="meter-footer">
            <div className="footer-stat">
              <span className="stat-label">Min Range</span>
              <span className="stat-num">0.0%</span>
            </div>
            <div className="footer-stat text-center">
              <span className="stat-label">Current</span>
              <span className="stat-num" style={{ color: getColor(cpu) }}>
                {cpu.toFixed(1)}%
              </span>
            </div>
            <div className="footer-stat text-right">
              <span className="stat-label">Max Range</span>
              <span className="stat-num">100.0%</span>
            </div>
          </div>
        </div>

        {/* Memory Gauge Card */}
        <div className="glass-panel meter-card">
          <div className="meter-header">
            <div className="meter-badge-blue">
              <HardDrive size={16} />
            </div>
            <div>
              <h3 className="meter-name">RAM Utilization</h3>
              <span className="meter-sub">Physical memory allocation</span>
            </div>
            <span className="badge badge-muted ml-auto">System RAM</span>
          </div>

          <div className="gauge-display">
            <div className="radial-meter">
              <svg viewBox="0 0 100 100" className="gauge-svg">
                <circle
                  className="gauge-bg"
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                />
                <circle
                  className="gauge-val"
                  cx="50"
                  cy="50"
                  r="40"
                  strokeWidth="8"
                  stroke={getColor(mem)}
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * mem) / 100}
                />
              </svg>
              <div className="gauge-center-text">
                <span className="gauge-val-text">{mem.toFixed(1)}</span>
                <span className="gauge-unit">%</span>
              </div>
            </div>
          </div>

          <div className="meter-footer">
            <div className="footer-stat">
              <span className="stat-label">Allocation</span>
              <span className="stat-num">Active</span>
            </div>
            <div className="footer-stat text-center">
              <span className="stat-label">Utilization</span>
              <span className="stat-num" style={{ color: getColor(mem) }}>
                {mem.toFixed(1)}%
              </span>
            </div>
            <div className="footer-stat text-right">
              <span className="stat-label">Threshold</span>
              <span className="stat-num text-amber">85.0%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stream Ticker */}
      <div className="glass-panel stream-table-panel">
        <div className="stream-header">
          <div className="stream-header-left">
            <Activity size={16} className="text-cyan" />
            <h3 className="stream-title">Live Reading Log (Last 10 Polls)</h3>
          </div>
          <span className="badge badge-cyan">
            {autoRefresh ? `Updating every ${refreshInterval}s` : 'Stream Paused'}
          </span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>CPU %</th>
                <th>Memory %</th>
                <th>Live Status</th>
              </tr>
            </thead>
            <tbody>
              {recentStream.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center text-muted py-4">
                    Waiting for incoming metrics stream...
                  </td>
                </tr>
              ) : (
                recentStream.map((row, idx) => (
                  <tr key={idx}>
                    <td className="mono-cell text-primary">
                      {row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : '--'}
                    </td>
                    <td>
                      <span className="mono-cell font-semibold" style={{ color: getColor(row.cpu_percent) }}>
                        {typeof row.cpu_percent === 'number' ? row.cpu_percent.toFixed(1) : row.cpu_percent}%
                      </span>
                    </td>
                    <td>
                      <span className="mono-cell font-semibold" style={{ color: getColor(row.mem_percent) }}>
                        {typeof row.mem_percent === 'number' ? row.mem_percent.toFixed(1) : row.mem_percent}%
                      </span>
                    </td>
                    <td>
                      {row.cpu_percent > 85 || row.mem_percent > 90 ? (
                        <span className="badge badge-rose">Spike Load</span>
                      ) : (
                        <span className="badge badge-emerald">Nominal</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .live-view-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .live-control-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .control-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pulse-icon-container {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .live-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .live-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .control-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .interval-selector {
          display: flex;
          align-items: center;
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          padding: 2px 4px;
          border-radius: var(--radius-md);
          gap: 2px;
        }

        .selector-label {
          font-size: 0.74rem;
          color: var(--text-muted);
          padding: 0 6px;
        }

        .interval-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 0.74rem;
          padding: 4px 7px;
          border-radius: 4px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .interval-btn:hover {
          color: var(--text-primary);
        }

        .interval-btn.active {
          background: var(--bg-surface-elevated);
          color: var(--color-cyan);
          font-weight: 600;
        }

        .stream-active {
          border-color: rgba(56, 189, 248, 0.35);
          color: var(--color-cyan);
        }

        .meters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }

        .meter-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .meter-header {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          margin-bottom: 20px;
        }

        .meter-badge-cyan, .meter-badge-blue {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .meter-badge-cyan {
          background: rgba(56, 189, 248, 0.12);
          color: var(--color-cyan);
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .meter-badge-blue {
          background: rgba(59, 130, 246, 0.12);
          color: var(--color-blue);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .meter-name {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .meter-sub {
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .ml-auto {
          margin-left: auto;
        }

        .gauge-display {
          margin: 12px 0 24px;
        }

        .radial-meter {
          width: 170px;
          height: 170px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gauge-svg {
          transform: rotate(-90deg);
          width: 100%;
          height: 100%;
        }

        .gauge-bg {
          fill: none;
          stroke: rgba(255, 255, 255, 0.06);
        }

        .gauge-val {
          fill: none;
          stroke-linecap: round;
          transition: stroke-dashoffset 400ms ease, stroke 400ms ease;
        }

        .gauge-center-text {
          position: absolute;
          display: flex;
          align-items: baseline;
          gap: 2px;
        }

        .gauge-val-text {
          font-size: 2.2rem;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
          letter-spacing: -0.02em;
        }

        .gauge-unit {
          font-size: 1rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .meter-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding-top: 14px;
          border-top: 1px solid var(--border-subtle);
        }

        .footer-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .stat-num {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          font-weight: 600;
        }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-cyan { color: var(--color-cyan); }
        .text-amber { color: var(--color-amber); }

        .stream-table-panel {
          padding: 20px;
        }

        .stream-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .stream-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stream-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .mono-cell {
          font-family: var(--font-mono);
          font-size: 0.82rem;
        }

        .font-semibold {
          font-weight: 600;
        }

        .py-4 {
          padding-top: 24px;
          padding-bottom: 24px;
        }
      `}</style>
    </div>
  );
}
