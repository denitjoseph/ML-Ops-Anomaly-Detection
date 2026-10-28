import React, { useState } from 'react';
import {
  Cpu,
  Sliders,
  Play,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { predictAnomaly } from '../services/api';

export default function ModelInfoView({ apiHealth }) {
  const [cpuInput, setCpuInput] = useState(25.0);
  const [memInput, setMemInput] = useState(60.0);
  const [predictionResult, setPredictionResult] = useState(null);
  const [isInferencing, setIsInferencing] = useState(false);
  const [inferenceError, setInferenceError] = useState(null);

  const modelPath = apiHealth?.model_path || 'models/anomaly_model.joblib';
  const modelLoaded = apiHealth?.model_loaded ?? false;

  // Presets for quick evaluation
  const presets = [
    { label: 'Normal Baseline', cpu: 25.0, mem: 58.0 },
    { label: 'CPU Spike Only', cpu: 95.0, mem: 52.0 },
    { label: 'RAM Pressure Only', cpu: 30.0, mem: 96.0 },
    { label: 'Dual Stress Outlier', cpu: 99.0, mem: 98.0 },
  ];

  const handleRunInference = async (cpu = cpuInput, mem = memInput) => {
    setIsInferencing(true);
    setInferenceError(null);

    try {
      const res = await predictAnomaly({
        cpu_percent: Number(cpu),
        mem_percent: Number(mem),
      });
      setPredictionResult(res);
    } catch (err) {
      setInferenceError(err.message || 'Inference call failed');
      setPredictionResult(null);
    } finally {
      setIsInferencing(false);
    }
  };

  const applyPreset = (preset) => {
    setCpuInput(preset.cpu);
    setMemInput(preset.mem);
    handleRunInference(preset.cpu, preset.mem);
  };

  const isAnomaly = predictionResult?.is_anomaly ?? (predictionResult?.label === 'ANOMALY');

  return (
    <div className="model-view-container">
      {/* Model Spec Cards */}
      <div className="specs-grid">
        <div className="glass-panel spec-card">
          <div className="spec-header">
            <Cpu size={18} className="text-cyan" />
            <span className="spec-type">Architecture</span>
          </div>
          <h3 className="spec-value">Isolation Forest</h3>
          <p className="spec-detail">
            Unsupervised ensemble of isolation trees (iTrees). Isolates observations by randomly partitioning feature subspace.
          </p>
          <div className="pill-list">
            <span className="spec-pill">scikit-learn</span>
            <span className="spec-pill">joblib persistence</span>
          </div>
        </div>

        <div className="glass-panel spec-card">
          <div className="spec-header">
            <Layers size={18} className="text-blue" />
            <span className="spec-type">Feature Space</span>
          </div>
          <h3 className="spec-value">2D Telemetry</h3>
          <p className="spec-detail">
            Standardized feature vector with continuous percentage inputs: <code className="mono-code">cpu_percent</code> and <code className="mono-code">mem_percent</code>.
          </p>
          <div className="pill-list">
            <span className="spec-pill">Range: [0.0, 100.0]</span>
            <span className="spec-pill">Contamination: 0.05</span>
          </div>
        </div>

        <div className="glass-panel spec-card">
          <div className="spec-header">
            <FileCode size={18} className="text-emerald" />
            <span className="spec-type">Artifact Status</span>
          </div>
          <h3 className="spec-value">{modelLoaded ? 'Model Loaded' : 'Model Missing'}</h3>
          <p className="spec-detail truncate" title={modelPath}>
            {modelPath}
          </p>
          <div className="pill-list">
            {modelLoaded ? (
              <span className="badge badge-emerald">Ready for Inference</span>
            ) : (
              <span className="badge badge-amber">Execute train_model.py</span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive What-If Prediction Sandbox */}
      <div className="glass-panel sandbox-panel">
        <div className="sandbox-header">
          <div className="title-left">
            <div className="sparkle-badge">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="sandbox-title">Interactive What-If Prediction Sandbox</h3>
              <p className="sandbox-subtitle">
                Test custom telemetry inputs directly against the live <code className="mono-code">POST /predict</code> FastAPI endpoint.
              </p>
            </div>
          </div>

          <div className="presets-group">
            <span className="presets-label">Quick Presets:</span>
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(p)}
                className="preset-btn"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sandbox-body">
          {/* Sliders Input Form */}
          <div className="sliders-column">
            <div className="input-group">
              <div className="input-label-row">
                <span className="label-text">CPU Usage Percentage</span>
                <span className="value-badge">{cpuInput.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={cpuInput}
                onChange={(e) => setCpuInput(parseFloat(e.target.value))}
                className="range-slider slider-cpu"
              />
              <div className="range-bounds">
                <span>0.0%</span>
                <span>50.0%</span>
                <span>100.0%</span>
              </div>
            </div>

            <div className="input-group">
              <div className="input-label-row">
                <span className="label-text">Memory Usage Percentage</span>
                <span className="value-badge text-blue">{memInput.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={memInput}
                onChange={(e) => setMemInput(parseFloat(e.target.value))}
                className="range-slider slider-mem"
              />
              <div className="range-bounds">
                <span>0.0%</span>
                <span>50.0%</span>
                <span>100.0%</span>
              </div>
            </div>

            <button
              onClick={() => handleRunInference()}
              disabled={isInferencing}
              className="btn-primary run-inference-btn"
            >
              {isInferencing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Computing Inference...</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>Execute Prediction (POST /predict)</span>
                </>
              )}
            </button>
          </div>

          {/* Inference Output Card */}
          <div className="result-column">
            {inferenceError ? (
              <div className="inference-error-card">
                <AlertTriangle size={24} className="text-rose mb-2" />
                <h4 className="error-title">Inference Request Failed</h4>
                <p className="error-detail">{inferenceError}</p>
                <p className="error-hint">
                  Ensure the model is trained (<code className="mono-code">python -m model.train_model</code>) and backend is active.
                </p>
              </div>
            ) : predictionResult ? (
              <div className={`inference-result-card ${isAnomaly ? 'anomaly-border' : 'normal-border'}`}>
                <div className="result-header">
                  <span className="result-tag">Inference Result</span>
                  {isAnomaly ? (
                    <span className="badge badge-rose large-badge">
                      <AlertTriangle size={14} /> ANOMALY DETECTED
                    </span>
                  ) : (
                    <span className="badge badge-emerald large-badge">
                      <ShieldCheck size={14} /> NORMAL BEHAVIOR
                    </span>
                  )}
                </div>

                <div className="result-stats-row">
                  <div className="res-stat">
                    <span className="stat-name">Raw Score:</span>
                    <span className="stat-val font-mono">{predictionResult.score?.toFixed(4)}</span>
                  </div>
                  <div className="res-stat">
                    <span className="stat-name">Evaluated CPU:</span>
                    <span className="stat-val font-mono">{predictionResult.cpu_percent}%</span>
                  </div>
                  <div className="res-stat">
                    <span className="stat-name">Evaluated RAM:</span>
                    <span className="stat-val font-mono">{predictionResult.mem_percent}%</span>
                  </div>
                </div>

                <div className="score-meter-section">
                  <span className="meter-label">Outlier Proximity Spectrum:</span>
                  <div className="spectrum-bar">
                    <div
                      className="spectrum-marker"
                      style={{
                        left: `${Math.min(95, Math.max(5, ((-predictionResult.score) / 0.6) * 100))}%`,
                        background: isAnomaly ? '#f43f5e' : '#10b981',
                      }}
                    />
                  </div>
                  <div className="spectrum-legend">
                    <span className="text-emerald">Dense Cluster (Normal)</span>
                    <span className="text-rose">Partitioned (Anomaly)</span>
                  </div>
                </div>

                <div className="result-note-box">
                  <span className="note-title">Model Interpretation:</span>
                  <p className="note-text">{predictionResult.score_note}</p>
                </div>
              </div>
            ) : (
              <div className="inference-placeholder">
                <Sliders size={32} className="text-muted mb-2" />
                <h4 className="placeholder-title">Ready for Telemetry Testing</h4>
                <p className="placeholder-text">
                  Adjust CPU & memory sliders on the left or select a preset, then click Execute Prediction.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .model-view-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }

        .spec-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .spec-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spec-type {
          font-size: 0.74rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .spec-value {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .spec-detail {
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.45;
          margin-bottom: 6px;
        }

        .pill-list {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: auto;
        }

        .spec-pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: 0.7rem;
          padding: 2px 7px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
        }

        .mono-code {
          font-family: var(--font-mono);
          color: var(--color-cyan);
          background: rgba(56, 189, 248, 0.08);
          padding: 1px 4px;
          border-radius: 4px;
        }

        .truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .text-cyan { color: var(--color-cyan); }
        .text-blue { color: #818cf8; }
        .text-emerald { color: var(--color-emerald); }
        .text-rose { color: var(--color-rose); }

        .sandbox-panel {
          padding: 22px;
        }

        .sandbox-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .title-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sparkle-badge {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: rgba(56, 189, 248, 0.12);
          color: var(--color-cyan);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .sandbox-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .sandbox-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .presets-group {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .presets-label {
          font-size: 0.74rem;
          color: var(--text-muted);
        }

        .preset-btn {
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          color: var(--text-secondary);
          padding: 4px 9px;
          border-radius: var(--radius-sm);
          font-size: 0.74rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .preset-btn:hover {
          color: var(--color-cyan);
          border-color: rgba(56, 189, 248, 0.3);
        }

        .sandbox-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .sliders-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .label-text {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .value-badge {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-cyan);
        }

        .range-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.08);
          outline: none;
        }

        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #38bdf8;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
        }

        .slider-mem::-webkit-slider-thumb {
          background: #818cf8;
          box-shadow: 0 0 10px rgba(129, 140, 248, 0.5);
        }

        .range-bounds {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .run-inference-btn {
          width: 100%;
          padding: 10px;
          font-size: 0.85rem;
          margin-top: 6px;
        }

        .result-column {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .inference-placeholder {
          text-align: center;
          padding: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .placeholder-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .placeholder-text {
          font-size: 0.78rem;
          color: var(--text-muted);
          max-width: 280px;
        }

        .inference-result-card {
          width: 100%;
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-medium);
          border-radius: var(--radius-md);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .inference-result-card.anomaly-border {
          border-color: rgba(244, 63, 94, 0.4);
          box-shadow: 0 0 20px rgba(244, 63, 94, 0.15);
        }

        .inference-result-card.normal-border {
          border-color: rgba(16, 185, 129, 0.4);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
        }

        .result-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .result-tag {
          font-size: 0.72rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 600;
        }

        .result-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          background: rgba(10, 15, 26, 0.5);
          padding: 10px;
          border-radius: var(--radius-sm);
        }

        .res-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-name {
          font-size: 0.68rem;
          color: var(--text-muted);
        }

        .stat-val {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .score-meter-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .meter-label {
          font-size: 0.72rem;
          color: var(--text-secondary);
        }

        .spectrum-bar {
          height: 6px;
          background: linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #f43f5e 100%);
          border-radius: var(--radius-full);
          position: relative;
        }

        .spectrum-marker {
          position: absolute;
          top: -4px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          transform: translateX(-50%);
          transition: left 300ms ease;
        }

        .spectrum-legend {
          display: flex;
          justify-content: space-between;
          font-size: 0.68rem;
        }

        .result-note-box {
          background: rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-sm);
          padding: 10px;
        }

        .note-title {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .note-text {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .inference-error-card {
          text-align: center;
          padding: 24px;
          background: rgba(244, 63, 94, 0.08);
          border: 1px solid rgba(244, 63, 94, 0.25);
          border-radius: var(--radius-md);
        }

        .error-title {
          font-size: 0.95rem;
          color: var(--color-rose);
          margin-bottom: 4px;
        }

        .error-detail {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .error-hint {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        @media (max-width: 900px) {
          .sandbox-body {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
