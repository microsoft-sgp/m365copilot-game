import { ref } from 'vue';
import { apiGetHealth } from '../lib/api.js';
import type { ApiResponse } from '../lib/api.js';

type HealthStatus = 'unknown' | 'healthy' | 'degraded' | 'down';
type HealthPayload = { status?: string };

// Singleton-style: shared module-level state so multiple footer mounts
// (e.g. across EmailGate <-> main game transitions) reuse one timer/probe.
const status = ref<HealthStatus>('unknown');
let pollTimer: ReturnType<typeof setInterval> | null = null;
let visibilityListener: (() => void) | null = null;
let refCount = 0;
let inFlight: Promise<void> | null = null;

const POLL_INTERVAL_MS = 30000;

async function probe() {
  // Coalesce concurrent probes (visibility + interval racing).
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const res = (await apiGetHealth()) as ApiResponse<HealthPayload>;
    if (res && res.status === 0) {
      status.value = 'down';
    } else if (res && res.ok && res.data && res.data.status === 'healthy') {
      status.value = 'healthy';
    } else if (res && res.data && res.data.status === 'degraded') {
      status.value = 'degraded';
    } else {
      // API responded but with an unexpected shape — treat as down so the
      // user sees an honest signal rather than stale "healthy".
      status.value = 'down';
    }
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

function onVisibility() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    probe();
  }
}

function start() {
  refCount += 1;
  // Probe + timer + visibility listener should only be installed once.
  if (refCount > 1) return;

  probe();
  pollTimer = setInterval(probe, POLL_INTERVAL_MS);

  if (typeof document !== 'undefined') {
    visibilityListener = onVisibility;
    document.addEventListener('visibilitychange', visibilityListener);
  }
}

function stop() {
  if (refCount === 0) return;
  refCount -= 1;
  if (refCount > 0) return;

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (visibilityListener && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityListener);
    visibilityListener = null;
  }
}

export function useHealthStatus() {
  return {
    status,
    start,
    stop,
    // Exposed for tests; also useful for future explicit refresh actions.
    _probe: probe,
  };
}

// Test-only reset hook so vitest can isolate state across cases.
export function __resetHealthStatusForTests() {
  if (pollTimer) clearInterval(pollTimer);
  if (visibilityListener && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityListener);
  }
  pollTimer = null;
  visibilityListener = null;
  refCount = 0;
  inFlight = null;
  status.value = 'unknown';
}
