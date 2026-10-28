import React, { useState } from 'react';
import {
  Settings,
  Globe,
  Radio,
  Sliders,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  HelpCircle,
  Activity,
  Terminal,
} from 'lucide-react';
import { getBaseUrl, setBaseUrl, testAllEndpoints } from '../services/api';

export default function SettingsView({
  refreshInterval,
  setRefreshInterval,
  isDemoMode,
  setIsDemoMode,
  onResetApp,
}) {
  const [urlInput, setUrlInput] = useState(getBaseUrl());
  const [saveMessage, setSaveMessage] = useState(null);
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const handleSaveUrl = (e) => {
    e.preventDefault();
    const updated = setBaseUrl(urlInput);
    setUrlInput(updated);
    setSaveMessage('API Base URL saved successfully!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleResetUrl = () => {
    const defaultUrl = 'http://127.0.0.1:8000';
    setBaseUrl(defaultUrl);
    setUrlInput(defaultUrl);
    setSaveMessage('Reset to default URL (http://127.0.0.1:8000)');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const results = await testAllEndpoints();
      setDiagnosticResults(results);
    } catch (err) {
      // should not happen as testAllEndpoints catches internally
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  return (
    <div className="settings-container">
      {/* 1. API Connection Configuration */}
      <div className="glass-panel settings-card">
        <div className="card-header">
          <div className="header-icon-wrapper">
            <Globe size={18} />
          </div>
          <div>
            <h3 className="card-title">Backend API Base URL</h3>
            <p className="card-desc">
              Configure the target host and port for FastAPI REST calls.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveUrl} className="url-form">
          <div className="input-row">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              className="form-input url-input"
            />
            <button type="submit" className="btn-primary">
              Save URL
            </button>
            <button
              type="button"
              onClick={handleResetUrl}
              className="btn-secondary"
            >
              <RotateCcw size={14} />
              <span>Reset Default</span>
            </button>
          </div>

          {saveMessage && (
            <p className="text-emerald text-xs mt-2 font-medium">{saveMessage}</p>
          )}

          <div className="env-hint">
            <span className="hint-label">Default environment setting:</span>
            <code className="mono-code">VITE_API_BASE_URL={import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}</code>
          </div>
        </form>
      </div>

      {/* 2. Telemetry Polling Cadence & Demo Mode */}
      <div className="glass-panel settings-card">
        <div className="card-header">
          <div className="header-icon-wrapper blue">
            <Radio size={18} />
          </div>
          <div>
            <h3 className="card-title">Stream Configuration & Offline Demo Mode</h3>
            <p className="card-desc">
              Control client-side polling frequency and toggle mock telemetry.
            </p>
          </div>
        </div>

        <div className="settings-grid">
          <div className="setting-item">
            <div className="setting-meta">
              <span className="setting-name">Polling Interval</span>
              <span className="setting-sub">Cadence for refreshing telemetry data</span>
            </div>
            <div className="interval-buttons">
              {[2, 5, 10, 30].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setRefreshInterval(sec)}
                  className={`btn-secondary interval-choice ${refreshInterval === sec ? 'active' : ''}`}
                >
                  {sec} seconds
                </button>
              ))}
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-meta">
              <span className="setting-name">Simulate Demo Telemetry</span>
              <span className="setting-sub">
                Enable synthetic metrics for UI/UX inspection when backend is offline
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isDemoMode}
                onChange={(e) => setIsDemoMode(e.target.checked)}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* 3. Endpoint Diagnostics Suite */}
      <div className="glass-panel settings-card">
        <div className="card-header">
          <div className="header-icon-wrapper emerald">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="card-title">Backend Endpoints Diagnostics Suite</h3>
            <p className="card-desc">
              Verify connectivity, latency, and status code for each Phase 4 endpoint.
            </p>
          </div>
          <button
            onClick={handleRunDiagnostics}
            disabled={isRunningDiagnostics}
            className="btn-primary ml-auto"
          >
            {isRunningDiagnostics ? (
              <>
                <Activity size={14} className="animate-spin" />
                <span>Pinging Endpoints...</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Run Diagnostic Healthcheck</span>
              </>
            )}
          </button>
        </div>

        {diagnosticResults && (
          <div className="diagnostics-results-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>API Endpoint</th>
                  <th>Status</th>
                  <th>Round-Trip Latency</th>
                  <th>Response Details</th>
                </tr>
              </thead>
              <tbody>
                {diagnosticResults.map((r, i) => (
                  <tr key={i}>
                    <td className="mono-cell font-medium text-primary">{r.name}</td>
                    <td>
                      {r.ok ? (
                        <span className="badge badge-emerald">
                          <CheckCircle2 size={12} /> SUCCESS (200)
                        </span>
                      ) : (
                        <span className="badge badge-rose">
                          <XCircle size={12} /> {r.status || 'FAILED'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="mono-cell font-semibold text-cyan">
                        {r.latency} ms
                      </span>
                    </td>
                    <td className="text-secondary text-xs">
                      {r.ok ? 'Valid JSON payload received' : r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Troubleshooting Guide */}
      <div className="glass-panel settings-card">
        <div className="card-header">
          <div className="header-icon-wrapper amber">
            <HelpCircle size={18} />
          </div>
          <div>
            <h3 className="card-title">CORS & Local Deployment Troubleshooting</h3>
            <p className="card-desc">
              Common solutions if you encounter connection errors between frontend and backend.
            </p>
          </div>
        </div>

        <div className="troubleshoot-list">
          <div className="troubleshoot-item">
            <h5 className="item-title">1. Failed to fetch / Connection Refused</h5>
            <p className="item-desc">
              Ensure your FastAPI backend is running on port 8000 in your PowerShell terminal:
            </p>
            <div className="cli-box">
              <code>.\venv\Scripts\uvicorn app.main:app --reload --port 8000</code>
            </div>
          </div>

          <div className="troubleshoot-item">
            <h5 className="item-title">2. Status 503 / Model Not Found</h5>
            <p className="item-desc">
              Occurs when <code className="mono-code">models/anomaly_model.joblib</code> hasn't been generated yet. Train it via:
            </p>
            <div className="cli-box">
              <code>.\venv\Scripts\python -m model.train_model</code>
            </div>
          </div>

          <div className="troubleshoot-item">
            <h5 className="item-title">3. Status 404 / Metrics CSV Not Found</h5>
            <p className="item-desc">
              Occurs when <code className="mono-code">data/metrics.csv</code> has no readings. Run the background collector:
            </p>
            <div className="cli-box">
              <code>.\venv\Scripts\python run_collector.py --interval 2</code>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .settings-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .settings-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .header-icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: rgba(56, 189, 248, 0.12);
          color: var(--color-cyan);
          border: 1px solid rgba(56, 189, 248, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon-wrapper.blue {
          background: rgba(59, 130, 246, 0.12);
          color: var(--color-blue);
          border-color: rgba(59, 130, 246, 0.25);
        }

        .header-icon-wrapper.emerald {
          background: rgba(16, 185, 129, 0.12);
          color: var(--color-emerald);
          border-color: rgba(16, 185, 129, 0.25);
        }

        .header-icon-wrapper.amber {
          background: rgba(245, 158, 11, 0.12);
          color: var(--color-amber);
          border-color: rgba(245, 158, 11, 0.25);
        }

        .card-title {
          font-size: 0.98rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .card-desc {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .url-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .url-input {
          font-family: var(--font-mono);
          width: 380px;
          max-width: 100%;
        }

        .env-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.74rem;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .mono-code {
          font-family: var(--font-mono);
          color: var(--color-cyan);
          background: rgba(56, 189, 248, 0.08);
          padding: 1px 5px;
          border-radius: 4px;
        }

        .settings-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .setting-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px;
          background: rgba(10, 15, 26, 0.4);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          flex-wrap: wrap;
          gap: 12px;
        }

        .setting-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .setting-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .setting-sub {
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .interval-buttons {
          display: flex;
          gap: 6px;
        }

        .interval-choice {
          padding: 5px 10px;
          font-size: 0.76rem;
        }

        .interval-choice.active {
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(56, 189, 248, 0.1);
          color: var(--color-cyan);
        }

        /* Toggle switch */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .switch-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-medium);
          transition: .3s;
          border-radius: 34px;
        }

        .switch-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: var(--text-muted);
          transition: .3s;
          border-radius: 50%;
        }

        input:checked + .switch-slider {
          background-color: rgba(56, 189, 248, 0.2);
          border-color: var(--color-cyan);
        }

        input:checked + .switch-slider:before {
          transform: translateX(20px);
          background-color: var(--color-cyan);
          box-shadow: 0 0 8px var(--color-cyan);
        }

        .troubleshoot-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .troubleshoot-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .item-title {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .item-desc {
          font-size: 0.76rem;
          color: var(--text-secondary);
        }

        .cli-box {
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          padding: 8px 12px;
          border-radius: var(--radius-md);
          font-family: var(--font-mono);
          font-size: 0.78rem;
          color: var(--color-cyan);
          margin-top: 4px;
        }

        .mono-cell {
          font-family: var(--font-mono);
          font-size: 0.78rem;
        }

        .ml-auto {
          margin-left: auto;
        }

        .text-xs { font-size: 0.72rem; }
        .text-emerald { color: var(--color-emerald); }
        .text-cyan { color: var(--color-cyan); }
      `}</style>
    </div>
  );
}
