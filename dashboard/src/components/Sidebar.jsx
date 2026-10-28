import React from 'react';
import {
  LayoutDashboard,
  Activity,
  History,
  AlertOctagon,
  Cpu,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Server,
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  anomalyCount = 0,
  apiHealth,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live', label: 'Live Monitoring', icon: Activity, badge: 'LIVE' },
    { id: 'history', label: 'Metrics History', icon: History },
    {
      id: 'anomalies',
      label: 'Anomalies',
      icon: AlertOctagon,
      count: anomalyCount > 0 ? anomalyCount : null,
      isAlert: anomalyCount > 0,
    },
    { id: 'model', label: 'Model Information', icon: Cpu },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-button ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <div className="nav-icon-container">
                <Icon size={18} className="nav-icon" />
              </div>

              {!collapsed && (
                <div className="nav-label-container">
                  <span className="nav-label">{item.label}</span>
                  {item.badge && (
                    <span className="nav-live-pill">{item.badge}</span>
                  )}
                  {item.count !== null && item.count !== undefined && (
                    <span className={`nav-counter ${item.isAlert ? 'alert' : ''}`}>
                      {item.count}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="footer-card">
            <div className="footer-header">
              <Server size={14} className="footer-icon" />
              <span className="footer-title">Pipeline Stack</span>
            </div>
            <div className="footer-meta">
              <span>FastAPI &bull; Scikit-learn</span>
              <span className="version-pill">v0.4.0</span>
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="collapse-toggle-btn"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>

      <style>{`
        .sidebar {
          width: 240px;
          min-width: 240px;
          background: rgba(10, 15, 26, 0.96);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 16px 10px;
          transition: width var(--transition-normal), min-width var(--transition-normal);
          position: relative;
          z-index: 20;
        }

        .sidebar.collapsed {
          width: 68px;
          min-width: 68px;
          padding: 16px 8px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-button {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
          position: relative;
        }

        .collapsed .nav-button {
          justify-content: center;
          padding: 10px 0;
        }

        .nav-button:hover {
          color: var(--text-primary);
          background: var(--bg-surface-elevated);
          border-color: var(--border-subtle);
        }

        .nav-button.active {
          color: #ffffff;
          background: linear-gradient(90deg, rgba(56, 189, 248, 0.14) 0%, rgba(37, 99, 235, 0.08) 100%);
          border-color: rgba(56, 189, 248, 0.35);
          box-shadow: inset 0 0 12px rgba(56, 189, 248, 0.06);
        }

        .nav-button.active .nav-icon {
          color: var(--color-cyan);
        }

        .nav-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .nav-icon {
          transition: color var(--transition-fast);
        }

        .nav-label-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          overflow: hidden;
        }

        .nav-label {
          font-size: 0.85rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav-live-pill {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: var(--radius-full);
          background: rgba(16, 185, 129, 0.15);
          color: var(--color-emerald);
          border: 1px solid rgba(16, 185, 129, 0.3);
          letter-spacing: 0.04em;
        }

        .nav-counter {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: var(--radius-full);
          background: var(--bg-surface-hover);
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .nav-counter.alert {
          background: rgba(244, 63, 94, 0.2);
          color: var(--color-rose);
          border: 1px solid rgba(244, 63, 94, 0.4);
        }

        .sidebar-footer {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-top: 14px;
          border-top: 1px solid var(--border-subtle);
        }

        .footer-card {
          background: rgba(17, 26, 46, 0.5);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 10px 12px;
        }

        .footer-header {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }

        .footer-icon {
          color: var(--color-cyan);
        }

        .footer-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.72rem;
          color: var(--text-secondary);
        }

        .version-pill {
          font-family: var(--font-mono);
          background: rgba(56, 189, 248, 0.1);
          color: var(--color-cyan);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.65rem;
        }

        .collapse-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 8px;
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          font-size: 0.75rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .collapse-toggle-btn:hover {
          color: var(--text-primary);
          background: var(--bg-surface-elevated);
          border-color: var(--border-medium);
        }
      `}</style>
    </aside>
  );
}
