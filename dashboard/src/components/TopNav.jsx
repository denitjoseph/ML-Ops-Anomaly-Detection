import React from 'react';
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Menu,
  Zap,
} from 'lucide-react';

export default function TopNav({
  apiHealth,
  lastRefresh,
  isRefreshing,
  onRefresh,
  autoRefresh,
  setAutoRefresh,
  sidebarCollapsed,
  setSidebarCollapsed,
  isDemoMode,
}) {
  // Determine connection status badge
  let statusBadge = {
    label: 'Connecting...',
    className: 'badge-muted',
    icon: <Activity size={12} className="animate-spin" />,
  };

  if (apiHealth?.status === 'ok') {
    statusBadge = {
      label: isDemoMode ? 'Demo Mode' : 'Connected',
      className: isDemoMode ? 'badge-cyan' : 'badge-emerald',
      icon: <CheckCircle2 size={12} />,
    };
  } else if (apiHealth?.status === 'degraded') {
    statusBadge = {
      label: 'Model Missing',
      className: 'badge-amber',
      icon: <AlertTriangle size={12} />,
    };
  } else if (apiHealth?.isError) {
    statusBadge = {
      label: 'Offline',
      className: 'badge-rose',
      icon: <XCircle size={12} />,
    };
  }

  // Format last refresh time
  const formatTime = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="icon-button"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="brand-group">
          <div className="brand-badge">
            <Zap size={16} className="brand-icon" />
          </div>
          <div>
            <h1 className="brand-title">ML-Ops Anomaly Detection</h1>
            <p className="brand-subtitle">Telemetry & Isolation Forest Engine</p>
          </div>
        </div>
      </div>

      <div className="top-nav-right">
        {isDemoMode && (
          <span className="badge badge-cyan" title="Displaying simulated data stream for offline design testing">
            <span className="live-dot demo" /> Demo Stream Active
          </span>
        )}

        <div className="nav-item status-indicator" title={apiHealth?.message || 'API connection state'}>
          <span className={`badge ${statusBadge.className}`}>
            {statusBadge.icon}
            <span>{statusBadge.label}</span>
          </span>
        </div>

        <div className="nav-item refresh-timer" title="Last successful data fetch timestamp">
          <Clock size={14} className="text-muted" />
          <span className="time-text">Updated {formatTime(lastRefresh)}</span>
        </div>

        <div className="nav-item">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`toggle-button ${autoRefresh ? 'active' : ''}`}
            title={autoRefresh ? 'Auto-refresh is ON (polling every 5s)' : 'Auto-refresh is PAUSED'}
          >
            <span className={`live-dot ${autoRefresh ? 'active' : 'paused'}`} />
            <span>{autoRefresh ? 'Live' : 'Paused'}</span>
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn-secondary refresh-btn"
          title="Force refresh data now"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <style>{`
        .top-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: rgba(12, 18, 32, 0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
          position: sticky;
          top: 0;
          z-index: 30;
          gap: 16px;
        }

        .top-nav-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .icon-button {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .icon-button:hover {
          color: var(--text-primary);
          border-color: var(--border-medium);
          background: var(--bg-surface-hover);
        }

        .brand-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand-badge {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%);
          border: 1px solid rgba(56, 189, 248, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-icon {
          color: var(--color-cyan);
        }

        .brand-title {
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .brand-subtitle {
          font-size: 0.72rem;
          color: var(--text-muted);
          line-height: 1.2;
        }

        .top-nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .time-text {
          font-size: 0.78rem;
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }

        .toggle-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-medium);
          padding: 6px 11px;
          border-radius: var(--radius-md);
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .toggle-button.active {
          color: var(--text-primary);
          border-color: rgba(56, 189, 248, 0.3);
          background: rgba(56, 189, 248, 0.08);
        }

        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .live-dot.active {
          background: var(--color-emerald);
          box-shadow: 0 0 8px var(--color-emerald);
          animation: pulseSlow 2s infinite;
        }

        .live-dot.paused {
          background: var(--text-muted);
        }

        .live-dot.demo {
          background: var(--color-cyan);
          box-shadow: 0 0 8px var(--color-cyan);
        }

        .refresh-btn {
          padding: 6px 12px;
          font-size: 0.8rem;
        }

        @media (max-width: 768px) {
          .brand-subtitle, .time-text {
            display: none;
          }
          .top-nav {
            padding: 10px 14px;
          }
        }
      `}</style>
    </header>
  );
}
