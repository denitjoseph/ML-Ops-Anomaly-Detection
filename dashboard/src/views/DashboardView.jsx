import React from 'react';
import SystemStatusBar from '../components/SystemStatusBar';
import SummaryCards from '../components/SummaryCards';
import MetricsCharts from '../components/MetricsCharts';
import RecentAnomaliesTable from '../components/RecentAnomaliesTable';

export default function DashboardView({
  currentMetrics,
  historyRecords,
  anomalies,
  apiHealth,
  latestPrediction,
  isLoading,
  onNavigateTab,
  isDemoMode,
}) {
  return (
    <div className="view-container">
      {/* System Status Banner */}
      <SystemStatusBar
        apiHealth={apiHealth}
        totalRecords={currentMetrics?.total_records ?? historyRecords?.length ?? 0}
        isDemoMode={isDemoMode}
      />

      {/* 4 Summary Cards */}
      <SummaryCards
        currentMetrics={currentMetrics}
        latestPrediction={latestPrediction}
        historyCount={historyRecords?.length || 0}
        isLoading={isLoading}
      />

      {/* Responsive Metrics Charts */}
      <MetricsCharts
        historyRecords={historyRecords}
        isLoading={isLoading}
      />

      {/* Recent Anomalies Table */}
      <RecentAnomaliesTable
        anomalies={anomalies}
        onNavigateToAnomalies={() => onNavigateTab('anomalies')}
        maxRows={5}
      />

      <style>{`
        .view-container {
          animation: fadeIn 250ms ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
