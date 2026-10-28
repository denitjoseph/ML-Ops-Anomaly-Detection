import React, { useState, useMemo } from 'react';
import {
  History,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Database,
  ArrowUpDown,
} from 'lucide-react';

export default function HistoryView({
  historyRecords = [],
  historyLimit = 100,
  setHistoryLimit,
  isLoading,
  onRefreshHistory,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('timestamp'); // 'timestamp' | 'cpu' | 'memory'
  const [sortAsc, setSortAsc] = useState(false); // default descending (newest first)
  const [page, setPage] = useState(1);
  const rowsPerPage = 20;

  // Filter & Sort
  const filteredRecords = useMemo(() => {
    let result = [...historyRecords];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.timestamp?.toLowerCase().includes(q) ||
          String(r.cpu_percent).includes(q) ||
          String(r.mem_percent).includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];

      if (sortField === 'cpu') {
        va = a.cpu_percent;
        vb = b.cpu_percent;
      } else if (sortField === 'memory') {
        va = a.mem_percent;
        vb = b.mem_percent;
      }

      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [historyRecords, searchTerm, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!historyRecords.length) return;
    const headers = ['timestamp', 'cpu_percent', 'mem_percent'];
    const rows = historyRecords.map((r) => [r.timestamp, r.cpu_percent, r.mem_percent].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `metrics_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="history-container">
      {/* Top Header & Actions */}
      <div className="glass-panel history-header-panel">
        <div className="header-left">
          <div className="icon-badge">
            <History size={18} />
          </div>
          <div>
            <h2 className="panel-title">Metrics History Archive</h2>
            <p className="panel-subtitle">
              Inspecting {historyRecords.length} records retrieved via <code className="mono-text">GET /metrics/history?limit={historyLimit}</code>
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div className="limit-group">
            <span className="limit-label">Fetch Limit:</span>
            {[50, 100, 250, 500, 1000].map((l) => (
              <button
                key={l}
                onClick={() => {
                  setHistoryLimit(l);
                  onRefreshHistory(l);
                }}
                className={`limit-btn ${historyLimit === l ? 'active' : ''}`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            disabled={!historyRecords.length}
            className="btn-secondary"
            title="Export retrieved history to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel filter-panel">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search by timestamp or metric value..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="search-input"
          />
        </div>

        <div className="filter-stats">
          <Database size={14} className="text-muted" />
          <span className="stat-text">
            Showing {paginatedRows.length} of {filteredRecords.length} filtered rows
          </span>
        </div>
      </div>

      {/* History Table */}
      <div className="glass-panel table-panel">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('timestamp')} className="sortable-th">
                  <div className="th-content">
                    <span>Timestamp (UTC/Local)</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => toggleSort('cpu')} className="sortable-th">
                  <div className="th-content">
                    <span>CPU Usage (%)</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => toggleSort('memory')} className="sortable-th">
                  <div className="th-content">
                    <span>Memory Usage (%)</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Workload Category</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-table-cell">
                    No historical records match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const cpu = typeof row.cpu_percent === 'number' ? row.cpu_percent : parseFloat(row.cpu_percent) || 0;
                  const mem = typeof row.mem_percent === 'number' ? row.mem_percent : parseFloat(row.mem_percent) || 0;
                  const isHighCpu = cpu >= 80;
                  const isHighMem = mem >= 85;

                  return (
                    <tr key={idx} className={isHighCpu || isHighMem ? 'row-anomaly' : ''}>
                      <td className="mono-cell text-primary font-medium">
                        {row.timestamp}
                      </td>
                      <td>
                        <div className="metric-cell">
                          <span className={`mono-cell font-semibold ${isHighCpu ? 'text-rose' : 'text-cyan'}`}>
                            {cpu.toFixed(1)}%
                          </span>
                          <div className="mini-bar-bg">
                            <div className="mini-bar-fill" style={{ width: `${cpu}%`, background: isHighCpu ? '#f43f5e' : '#38bdf8' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="metric-cell">
                          <span className={`mono-cell font-semibold ${isHighMem ? 'text-amber' : 'text-blue'}`}>
                            {mem.toFixed(1)}%
                          </span>
                          <div className="mini-bar-bg">
                            <div className="mini-bar-fill" style={{ width: `${mem}%`, background: isHighMem ? '#f59e0b' : '#818cf8' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        {isHighCpu && isHighMem ? (
                          <span className="badge badge-rose">Critical Spike</span>
                        ) : isHighCpu ? (
                          <span className="badge badge-rose">CPU Spike</span>
                        ) : isHighMem ? (
                          <span className="badge badge-amber">RAM Pressure</span>
                        ) : (
                          <span className="badge badge-emerald">Normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="pagination-bar">
          <span className="page-info">
            Page {page} of {totalPages} ({filteredRecords.length} total entries)
          </span>

          <div className="pagination-buttons">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="page-btn"
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="page-btn"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .history-container {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .history-header-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-badge {
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

        .panel-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .panel-subtitle {
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .mono-text {
          font-family: var(--font-mono);
          color: var(--color-cyan);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .limit-group {
          display: flex;
          align-items: center;
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          padding: 2px 4px;
          border-radius: var(--radius-md);
          gap: 2px;
        }

        .limit-label {
          font-size: 0.72rem;
          color: var(--text-muted);
          padding: 0 6px;
        }

        .limit-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 4px 7px;
          border-radius: 4px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .limit-btn:hover {
          color: var(--text-primary);
        }

        .limit-btn.active {
          background: var(--bg-surface-elevated);
          color: var(--color-cyan);
          font-weight: 600;
        }

        .filter-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          border-radius: var(--radius-md);
          padding: 6px 12px;
          width: 340px;
          max-width: 100%;
        }

        .search-icon {
          color: var(--text-muted);
        }

        .search-input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 0.82rem;
          width: 100%;
        }

        .filter-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.76rem;
          color: var(--text-secondary);
        }

        .table-panel {
          padding: 0;
          overflow: hidden;
        }

        .sortable-th {
          cursor: pointer;
          user-select: none;
        }

        .sortable-th:hover {
          color: var(--text-primary);
        }

        .th-content {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mono-cell {
          font-family: var(--font-mono);
          font-size: 0.8rem;
        }

        .font-medium { font-weight: 500; }
        .font-semibold { font-weight: 600; }
        .text-cyan { color: var(--color-cyan); }
        .text-blue { color: #818cf8; }
        .text-rose { color: var(--color-rose); }
        .text-amber { color: var(--color-amber); }

        .metric-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mini-bar-bg {
          width: 80px;
          height: 4px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .mini-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
        }

        .empty-table-cell {
          text-align: center;
          padding: 36px 16px;
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .pagination-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: rgba(10, 15, 26, 0.5);
          border-top: 1px solid var(--border-subtle);
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .pagination-buttons {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .page-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--bg-surface);
          border: 1px solid var(--border-medium);
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.76rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .page-btn:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
