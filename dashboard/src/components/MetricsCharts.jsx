import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Layers, Cpu, HardDrive } from 'lucide-react';

export default function MetricsCharts({ historyRecords = [], isLoading }) {
  const [activeView, setActiveView] = useState('both'); // 'both' | 'cpu' | 'memory'

  // Format data for Recharts
  const chartData = (historyRecords || []).map((row, index) => {
    let displayTime = `#${index + 1}`;
    try {
      const d = new Date(row.timestamp);
      if (!isNaN(d.getTime())) {
        displayTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } catch {
      displayTime = `#${index + 1}`;
    }

    return {
      index: index + 1,
      time: displayTime,
      timestamp: row.timestamp,
      cpu: typeof row.cpu_percent === 'number' ? row.cpu_percent : parseFloat(row.cpu_percent) || 0,
      memory: typeof row.mem_percent === 'number' ? row.mem_percent : parseFloat(row.mem_percent) || 0,
    };
  });

  // Custom Dark Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="tooltip-time">{data.timestamp || data.time}</p>
          <div className="tooltip-row">
            <span className="dot dot-cpu" />
            <span className="tooltip-label">CPU Usage:</span>
            <span className="tooltip-value">{data.cpu.toFixed(1)}%</span>
          </div>
          <div className="tooltip-row">
            <span className="dot dot-mem" />
            <span className="tooltip-label">Memory Usage:</span>
            <span className="tooltip-value">{data.memory.toFixed(1)}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel charts-container">
      <div className="charts-header">
        <div className="header-left">
          <div className="title-icon-wrapper">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className="charts-title">System Metrics Telemetry</h2>
            <p className="charts-subtitle">
              Time-series observations streamed from <code className="mono-text">data/metrics.csv</code> ({chartData.length} samples)
            </p>
          </div>
        </div>

        <div className="view-toggle-group">
          <button
            onClick={() => setActiveView('both')}
            className={`toggle-tab ${activeView === 'both' ? 'active' : ''}`}
          >
            <Layers size={14} />
            <span>Dual View</span>
          </button>
          <button
            onClick={() => setActiveView('cpu')}
            className={`toggle-tab ${activeView === 'cpu' ? 'active' : ''}`}
          >
            <Cpu size={14} />
            <span>CPU Only</span>
          </button>
          <button
            onClick={() => setActiveView('memory')}
            className={`toggle-tab ${activeView === 'memory' ? 'active' : ''}`}
          >
            <HardDrive size={14} />
            <span>Memory Only</span>
          </button>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="empty-chart-state">
          <Layers size={36} className="text-muted mb-2" />
          <h4 className="empty-title">No Telemetry Recorded Yet</h4>
          <p className="empty-text">
            Start the collector in PowerShell to generate CPU and memory data:
          </p>
          <div className="code-snippet">
            <code>.\venv\Scripts\python run_collector.py --interval 2</code>
          </div>
        </div>
      ) : (
        <div className="charts-body">
          {/* Dual or CPU Chart */}
          {(activeView === 'both' || activeView === 'cpu') && (
            <div className="chart-panel">
              <div className="chart-panel-header">
                <div className="indicator-group">
                  <span className="dot dot-cpu" />
                  <span className="panel-title">CPU Utilization (%)</span>
                </div>
                <span className="threshold-pill">High Load Warning &gt; 80%</span>
              </div>

              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      minTickGap={25}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: '80% Threshold', fill: '#f43f5e', fontSize: 10, position: 'insideTopRight' }} />
                    <Area
                      type="monotone"
                      dataKey="cpu"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#cpuGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Dual or Memory Chart */}
          {(activeView === 'both' || activeView === 'memory') && (
            <div className="chart-panel">
              <div className="chart-panel-header">
                <div className="indicator-group">
                  <span className="dot dot-mem" />
                  <span className="panel-title">Memory Utilization (%)</span>
                </div>
                <span className="threshold-pill">Memory Alert &gt; 85%</span>
              </div>

              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      minTickGap={25}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={85} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: '85% Pressure', fill: '#fbbf24', fontSize: 10, position: 'insideTopRight' }} />
                    <Area
                      type="monotone"
                      dataKey="memory"
                      stroke="#818cf8"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#memGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .charts-container {
          padding: 20px;
          margin-bottom: 20px;
        }

        .charts-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 14px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .title-icon-wrapper {
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

        .charts-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .charts-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .mono-text {
          font-family: var(--font-mono);
          color: var(--color-cyan);
        }

        .view-toggle-group {
          display: flex;
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          padding: 3px;
          border-radius: var(--radius-md);
          gap: 4px;
        }

        .toggle-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .toggle-tab:hover {
          color: var(--text-primary);
        }

        .toggle-tab.active {
          background: var(--bg-surface-elevated);
          color: var(--color-cyan);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .charts-body {
          display: grid;
          grid-template-columns: ${activeView === 'both' ? 'repeat(auto-fit, minmax(420px, 1fr))' : '1fr'};
          gap: 18px;
        }

        .chart-panel {
          background: rgba(10, 15, 26, 0.4);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 16px;
        }

        .chart-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .indicator-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .dot-cpu { background: #38bdf8; box-shadow: 0 0 6px #38bdf8; }
        .dot-mem { background: #818cf8; box-shadow: 0 0 6px #818cf8; }

        .panel-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .threshold-pill {
          font-size: 0.68rem;
          font-weight: 500;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          padding: 2px 7px;
          border-radius: var(--radius-full);
          font-family: var(--font-mono);
        }

        .chart-wrapper {
          width: 100%;
        }

        .chart-tooltip {
          background: rgba(12, 18, 32, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid var(--border-medium);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          box-shadow: var(--shadow-lg);
          font-size: 0.78rem;
        }

        .tooltip-time {
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          margin-bottom: 6px;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 4px;
        }

        .tooltip-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 3px 0;
        }

        .tooltip-label {
          color: var(--text-secondary);
        }

        .tooltip-value {
          font-family: var(--font-mono);
          font-weight: 600;
          color: var(--text-primary);
          margin-left: auto;
        }

        .empty-chart-state {
          padding: 40px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .empty-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .empty-text {
          font-size: 0.82rem;
          color: var(--text-muted);
          margin-bottom: 12px;
        }

        .code-snippet {
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          padding: 8px 14px;
          border-radius: var(--radius-md);
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--color-cyan);
        }

        @media (max-width: 768px) {
          .charts-body {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
