import { computed, onBeforeUnmount, ref } from 'vue';

export const SLOW_SEND_THRESHOLD_MS = 3000;

export const SEND_STATUS = {
  idle: 'idle',
  sending: 'sending',
  confirming: 'confirming',
  sent: 'sent',
  failed: 'failed',
} as const;

export type SendStatus = (typeof SEND_STATUS)[keyof typeof SEND_STATUS];

export function useSlowSendStatus(thresholdMs = SLOW_SEND_THRESHOLD_MS) {
  const status = ref<SendStatus>(SEND_STATUS.idle);
  let slowTimer: ReturnType<typeof setTimeout> | null = null;

  const isPending = computed(
    () => status.value === SEND_STATUS.sending || status.value === SEND_STATUS.confirming,
  );

  function clearSlowTimer() {
    if (!slowTimer) return;
    clearTimeout(slowTimer);
    slowTimer = null;
  }

  function start() {
    clearSlowTimer();
    status.value = SEND_STATUS.sending;
    slowTimer = setTimeout(() => {
      slowTimer = null;
      if (status.value === SEND_STATUS.sending) {
        status.value = SEND_STATUS.confirming;
      }
    }, thresholdMs);
  }

  function markSent() {
    clearSlowTimer();
    status.value = SEND_STATUS.sent;
  }

  function markFailed() {
    clearSlowTimer();
    status.value = SEND_STATUS.failed;
  }

  function reset() {
    clearSlowTimer();
    status.value = SEND_STATUS.idle;
  }

  onBeforeUnmount(clearSlowTimer);

  return {
    status,
    isPending,
    start,
    markSent,
    markFailed,
    reset,
  };
}
