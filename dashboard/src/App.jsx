import React, { useState, useEffect, useCallback, useRef } from 'react';
import TopNav from './components/TopNav';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import LiveMonitoringView from './views/LiveMonitoringView';
import HistoryView from './views/HistoryView';
import AnomaliesView from './views/AnomaliesView';
import ModelInfoView from './views/ModelInfoView';
import SettingsView from './views/SettingsView';
import {
  getHealth,
  getCurrentMetrics,
  getMetricsHistory,
  getAnomalies,
  predictAnomaly,
  generateDemoData,
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Core telemetry state
  const [apiHealth, setApiHealth] = useState(null);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLimit, setHistoryLimit] = useState(100);
  const [anomalies, setAnomalies] = useState([]);
  const [anomaliesSource, setAnomaliesSource] = useState('');
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);

  // Fetch all data
  const fetchData = useCallback(async (isManual = false) => {
    setIsRefreshing(true);
    setGlobalError(null);

    // If demo mode is active, use simulated telemetry
    if (isDemoMode) {
      const demo = generateDemoData();
      setApiHealth(demo.health);
      setCurrentMetrics(demo.current);
      setHistoryRecords(demo.history.records);
      setAnomalies(demo.anomalies.anomalies);
      setAnomaliesSource(demo.anomalies.source);
      setLatestPrediction({
        label: 'NORMAL',
        is_anomaly: false,
        score: -0.065,
        cpu_percent: demo.current.latest.cpu_percent,
        mem_percent: demo.current.latest.mem_percent,
        score_note: 'Simulated nominal observation.',
      });
      setLastRefresh(new Date());
      setIsRefreshing(false);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch health, current, history, anomalies concurrently
      const [healthRes, currentRes, historyRes, anomaliesRes] = await Promise.allSettled([
        getHealth(),
        getCurrentMetrics(),
        getMetricsHistory(historyLimit),
        getAnomalies(),
      ]);

      // 1. Health
      if (healthRes.status === 'fulfilled') {
        setApiHealth(healthRes.value);
      } else {
        setApiHealth({
          status: 'offline',
          isError: true,
          message: healthRes.reason?.message || 'Failed to connect to backend',
        });
      }

      // 2. Current metrics
      let latestReading = null;
      if (currentRes.status === 'fulfilled') {
        setCurrentMetrics(currentRes.value);
        latestReading = currentRes.value?.latest;
      } else {
        // If 404 (file not found/empty), handle gracefully
        setCurrentMetrics(null);
      }

      // 3. History
      if (historyRes.status === 'fulfilled') {
        setHistoryRecords(historyRes.value?.records || []);
      } else {
        setHistoryRecords([]);
      }

      // 4. Anomalies
      if (anomaliesRes.status === 'fulfilled') {
        setAnomalies(anomaliesRes.value?.anomalies || []);
        setAnomaliesSource(anomaliesRes.value?.source || '');
      } else {
        setAnomalies([]);
      }

      // 5. Predict latest reading if available and model is loaded
      if (latestReading && healthRes.status === 'fulfilled' && healthRes.value?.model_loaded) {
        try {
          const pred = await predictAnomaly({
            cpu_percent: latestReading.cpu_percent,
            mem_percent: latestReading.mem_percent,
          });
          setLatestPrediction(pred);
        } catch {
          // Non-blocking if predict fails
        }
      }

      setLastRefresh(new Date());
    } catch (err) {
      setGlobalError(err.message || 'Error communicating with backend API');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [isDemoMode, historyLimit]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Interval polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  return (
    <div className="app-layout">
      {/* Top Header */}
      <TopNav
        apiHealth={apiHealth}
        lastRefresh={lastRefresh}
        isRefreshing={isRefreshing}
        onRefresh={() => fetchData(true)}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        isDemoMode={isDemoMode}
      />

      <div className="app-main-body">
        {/* Collapsible Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          anomalyCount={anomalies.length}
          apiHealth={apiHealth}
        />

        {/* Viewport Content */}
        <main className="main-viewport">
          {globalError && (
            <div className="global-error-banner">
              <span>{globalError}</span>
              <button onClick={() => fetchData(true)} className="btn-secondary text-xs">
                Retry Connection
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              currentMetrics={currentMetrics}
              historyRecords={historyRecords}
              anomalies={anomalies}
              apiHealth={apiHealth}
              latestPrediction={latestPrediction}
              isLoading={isLoading}
              onNavigateTab={setActiveTab}
              isDemoMode={isDemoMode}
            />
          )}

          {activeTab === 'live' && (
            <LiveMonitoringView
              currentMetrics={currentMetrics}
              latestPrediction={latestPrediction}
              historyRecords={historyRecords}
              autoRefresh={autoRefresh}
              setAutoRefresh={setAutoRefresh}
              onRefresh={() => fetchData(true)}
              isRefreshing={isRefreshing}
              refreshInterval={refreshInterval}
              setRefreshInterval={setRefreshInterval}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              historyRecords={historyRecords}
              historyLimit={historyLimit}
              setHistoryLimit={setHistoryLimit}
              isLoading={isLoading}
              onRefreshHistory={(limit) => fetchData(true)}
            />
          )}

          {activeTab === 'anomalies' && (
            <AnomaliesView
              anomalies={anomalies}
              totalHistoryCount={currentMetrics?.total_records || historyRecords.length}
              anomaliesSource={anomaliesSource}
              isLoading={isLoading}
            />
          )}

          {activeTab === 'model' && (
            <ModelInfoView apiHealth={apiHealth} />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              refreshInterval={refreshInterval}
              setRefreshInterval={setRefreshInterval}
              isDemoMode={isDemoMode}
              setIsDemoMode={setIsDemoMode}
            />
          )}
        </main>
      </div>

      <style>{`
        .app-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background: var(--bg-canvas);
        }

        .app-main-body {
          display: flex;
          flex: 1;
          height: calc(100vh - 61px);
          overflow: hidden;
          position: relative;
        }

        .main-viewport {
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px;
          background: radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.03) 0%, transparent 60%);
        }

        .global-error-banner {
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.35);
          color: #fca5a5;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          font-size: 0.82rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .text-xs {
          font-size: 0.74rem;
        }

        @media (max-width: 768px) {
          .main-viewport {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
