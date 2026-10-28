import React from 'react';
import {
  Server,
  Cpu,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
} from 'lucide-react';

export default function SystemStatusBar({ apiHealth, totalRecords = 0, isDemoMode }) {
  const isHealthy = apiHealth?.status === 'ok';
  const isDegraded = apiHealth?.status === 'degraded';
  const isOffline = apiHealth?.isError || !apiHealth;

  const modelLoaded = apiHealth?.model_loaded ?? false;
  const hasData = totalRecords > 0;

  return (
    <div className="glass-panel system-status-bar">
      <div className="status-item">
        <div className="item-icon-wrapper">
          <Server size={15} />
        </div>
        <div className="item-content">
          <div className="item-label-row">
            <span className="item-label">FastAPI Backend</span>
            {isOffline ? (
              <span className="badge badge-rose">Offline</span>
            ) : isHealthy ? (
              <span className="badge badge-emerald">Online</span>
            ) : (
              <span className="badge badge-amber">Degraded</span>
            )}
          </div>
          <span className="item-meta">
            {isOffline ? 'Server not responding' : 'Port 8000 &bull; Uvicorn ASGI'}
          </span>
        </div>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <div className="item-icon-wrapper">
          <Cpu size={15} />
        </div>
        <div className="item-content">
          <div className="item-label-row">
            <span className="item-label">Isolation Forest</span>
            {modelLoaded ? (
              <span className="badge badge-emerald">Loaded</span>
            ) : (
              <span className="badge badge-amber">Not Trained</span>
            )}
          </div>
          <span className="item-meta truncate" title={apiHealth?.model_path || 'models/anomaly_model.joblib'}>
            {apiHealth?.model_path ? apiHealth.model_path.split('\\').pop() : 'anomaly_model.joblib'}
          </span>
        </div>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <div className="item-icon-wrapper">
          <FileSpreadsheet size={15} />
        </div>
        <div className="item-content">
          <div className="item-label-row">
            <span className="item-label">Telemetry Pipeline</span>
            {hasData ? (
              <span className="badge badge-cyan">{totalRecords} Records</span>
            ) : (
              <span className="badge badge-muted">No Data</span>
            )}
          </div>
          <span className="item-meta">data/metrics.csv</span>
        </div>
      </div>

      {(!modelLoaded || !hasData || isOffline) && !isDemoMode && (
        <div className="status-action-pill">
          <Terminal size={13} className="text-muted" />
          <span className="action-text">
            {isOffline
              ? 'Run: .\\venv\\Scripts\\uvicorn app.main:app --port 8000'
              : !hasData
              ? 'Run: .\\venv\\Scripts\\python run_collector.py --interval 2'
              : 'Run: .\\venv\\Scripts\\python -m model.train_model'}
          </span>
        </div>
      )}

      <style>{`
        .system-status-bar {
          display: flex;
          align-items: center;
          padding: 12px 18px;
          gap: 18px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          background: rgba(10, 15, 26, 0.65);
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 170px;
        }

        .item-icon-wrapper {
          width: 30px;
          height: 30px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          color: var(--color-cyan);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .item-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .item-label-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .item-label {
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .item-meta {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .status-divider {
          width: 1px;
          height: 28px;
          background: var(--border-subtle);
        }

        .status-action-pill {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(17, 26, 46, 0.8);
          border: 1px solid var(--border-medium);
          padding: 5px 10px;
          border-radius: var(--radius-md);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          color: var(--color-cyan);
        }

        .truncate {
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 900px) {
          .status-divider {
            display: none;
          }
          .status-action-pill {
            margin-left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
