/**
 * src/services/api.js
 * ===================
 * Client API service for communicating with the FastAPI backend.
 *
 * Designed with resilience:
 * - Dynamic base URL resolution (environment variable or user override in Settings)
 * - Structured error handling with human-readable error messages
 * - Timeout handling (prevents hanging indefinitely on unresponsive servers)
 * - Safe response extraction matching Phase 4 schemas
 */

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const STORAGE_KEY = 'mlops_api_base_url';
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Returns the current active API base URL.
 * Checks localStorage first (user runtime configuration), falling back to env var.
 */
export function getBaseUrl() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch (err) {
    // localStorage might be unavailable in private browsing
  }
  return DEFAULT_BASE_URL.replace(/\/+$/, '');
}

/**
 * Updates the runtime API base URL in localStorage.
 */
export function setBaseUrl(url) {
  const sanitized = (url || '').trim().replace(/\/+$/, '');
  if (!sanitized) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, sanitized);
  }
  return getBaseUrl();
}

/**
 * Helper to execute a fetch request with timeout and error classification.
 */
async function request(endpoint, options = {}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Parse JSON or return empty object if no body
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { detail: text } : {};
    }

    if (!response.ok) {
      const message =
        data?.detail ||
        (Array.isArray(data?.detail)
          ? data.detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
          : `HTTP error ${response.status}: ${response.statusText}`);

      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Request to ${endpoint} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }

    // Network error (CORS failure, connection refused, offline)
    if (!err.status) {
      const networkErr = new Error(
        `Unable to connect to backend at ${baseUrl}. Ensure FastAPI is running (uvicorn app.main:app --port 8000).`
      );
      networkErr.isNetworkError = true;
      networkErr.original = err;
      throw networkErr;
    }

    throw err;
  }
}

/**
 * GET /health
 * Returns: { status: "ok"|"degraded", model_loaded: bool, model_path: str, message: str }
 */
export async function getHealth() {
  return request('/health');
}

/**
 * GET /metrics/current
 * Returns: { latest: { timestamp, cpu_percent, mem_percent }, total_records: int }
 */
export async function getCurrentMetrics() {
  return request('/metrics/current');
}

/**
 * GET /metrics/history?limit={limit}
 * Returns: { records: [...], count: int, limit: int }
 */
export async function getMetricsHistory(limit = 100) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 100));
  return request(`/metrics/history?limit=${safeLimit}`);
}

/**
 * POST /predict
 * Body: { cpu_percent: number, mem_percent: number }
 * Returns: { label: "NORMAL"|"ANOMALY", is_anomaly: bool, score: float, cpu_percent, mem_percent, score_note }
 */
export async function predictAnomaly({ cpu_percent, mem_percent }) {
  return request('/predict', {
    method: 'POST',
    body: JSON.stringify({
      cpu_percent: Number(cpu_percent),
      mem_percent: Number(mem_percent),
    }),
  });
}

/**
 * GET /anomalies
 * Returns: { anomalies: [{ timestamp, cpu_percent, mem_percent, score, label }], count: int, source: str }
 */
export async function getAnomalies() {
  return request('/anomalies');
}

/**
 * Diagnostic helper: checks all API endpoints and measures latency.
 */
export async function testAllEndpoints() {
  const tests = [
    { name: 'Health Check (GET /health)', fn: () => getHealth() },
    { name: 'Current Metrics (GET /metrics/current)', fn: () => getCurrentMetrics() },
    { name: 'Metrics History (GET /metrics/history)', fn: () => getMetricsHistory(10) },
    { name: 'Anomalies Scan (GET /anomalies)', fn: () => getAnomalies() },
    {
      name: 'Anomaly Inference (POST /predict)',
      fn: () => predictAnomaly({ cpu_percent: 45.0, mem_percent: 65.0 }),
    },
  ];

  const results = [];
  for (const t of tests) {
    const start = performance.now();
    try {
      const data = await t.fn();
      const latency = Math.round(performance.now() - start);
      results.push({ name: t.name, ok: true, latency, data });
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      results.push({
        name: t.name,
        ok: false,
        latency,
        error: err.message,
        status: err.status || 'OFFLINE',
      });
    }
  }
  return results;
}

/**
 * Realistic simulated data generator for offline / demonstration testing.
 * Clearly tagged so it is never confused with live production readings.
 */
export function generateDemoData() {
  const now = Date.now();
  const records = [];
  const anomalies = [];

  for (let i = 59; i >= 0; i--) {
    const time = new Date(now - i * 5000).toISOString();
    // Normal sinus with noise + occasional spike
    const isSpike = i === 12 || i === 42;
    const cpu = isSpike
      ? +(92 + Math.random() * 6).toFixed(1)
      : +(20 + Math.sin(i / 5) * 15 + Math.random() * 8).toFixed(1);
    const mem = isSpike
      ? +(94 + Math.random() * 4).toFixed(1)
      : +(55 + Math.cos(i / 7) * 8 + Math.random() * 4).toFixed(1);

    const record = {
      timestamp: time,
      cpu_percent: cpu,
      mem_percent: mem,
    };
    records.push(record);

    if (isSpike) {
      anomalies.push({
        timestamp: time,
        cpu_percent: cpu,
        mem_percent: mem,
        score: -0.42,
        label: 'ANOMALY',
      });
    }
  }

  const latest = records[records.length - 1];

  return {
    health: {
      status: 'ok',
      model_loaded: true,
      model_path: 'models/anomaly_model.joblib (Demo Simulation)',
      message: 'Demo mode active: simulated metrics stream for UI evaluation.',
    },
    current: {
      latest,
      total_records: records.length,
    },
    history: {
      records,
      count: records.length,
      limit: 100,
    },
    anomalies: {
      anomalies,
      count: anomalies.length,
      source: 'Demo simulated anomaly stream (2 artificial spikes injected).',
    },
  };
}
