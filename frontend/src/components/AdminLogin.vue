<script setup>
import { computed, ref } from 'vue';
import { apiAdminRequestOtp, apiAdminVerifyOtp } from '../lib/api.js';
import { setAdminSessionHint } from '../lib/adminSession.js';
import { SEND_STATUS, useSlowSendStatus } from '../composables/useSlowSendStatus.js';

const emit = defineEmits(['authenticated', 'back']);

const props = defineProps({
  sessionMessage: { type: String, default: '' },
});

const email = ref('');
const code = ref('');
const step = ref('email'); // 'email' | 'otp'
const error = ref('');
const verifying = ref(false);
const otpRequest = useSlowSendStatus();
const otpRequestPending = otpRequest.isPending;

const otpRequestStatusText = computed(() => {
  if (otpRequest.status.value === SEND_STATUS.sending) return 'Sending...';
  if (otpRequest.status.value === SEND_STATUS.confirming) return 'Confirming delivery...';
  if (otpRequest.status.value === SEND_STATUS.sent) return 'Code sent. Check your email.';
  return '';
});

const otpRequestButtonText = computed(() =>
  otpRequestPending.value ? otpRequestStatusText.value : 'Send Code',
);

async function requestOtp() {
  if (otpRequestPending.value) return;
  error.value = '';
  const trimmed = email.value.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    error.value = 'Please enter a valid email.';
    return;
  }
  otpRequest.start();

  try {
    const res = await apiAdminRequestOtp(trimmed);
    if (res.ok) {
      otpRequest.markSent();
      step.value = 'otp';
    } else if (res.status === 429) {
      otpRequest.markFailed();
      error.value = 'Please wait before requesting another code.';
    } else {
      otpRequest.markFailed();
      error.value = res.data?.message || 'Failed to send code.';
    }
  } catch {
    otpRequest.markFailed();
    error.value = 'Failed to send code.';
  }
}

async function verifyOtp() {
  if (verifying.value) return;
  error.value = '';
  if (!code.value.trim()) {
    error.value = 'Please enter the 6-digit code.';
    return;
  }
  verifying.value = true;

  try {
    const res = await apiAdminVerifyOtp(email.value.trim().toLowerCase(), code.value.trim());
    if (res.ok) {
      const adminEmail = email.value.trim().toLowerCase();
      setAdminSessionHint(adminEmail);
      emit('authenticated', adminEmail);
    } else {
      error.value = res.data?.message || 'Invalid code.';
    }
  } catch {
    error.value = 'Invalid code.';
  } finally {
    verifying.value = false;
  }
}

function backToEmailStep() {
  step.value = 'email';
  error.value = '';
  otpRequest.reset();
}
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center px-5">
    <div class="glass mx-auto w-full max-w-[420px] rounded-[14px] p-8">
      <h2 class="text-gradient mb-2 text-title-lg font-black">🔐 Admin Login</h2>

      <div
        v-if="props.sessionMessage && !error && step === 'email'"
        class="mb-3 text-label-md text-error"
      >
        {{ props.sessionMessage }}
      </div>

      <!-- Step 1: Email -->
      <template v-if="step === 'email'">
        <p class="mb-4 text-sm text-on-surface-variant">
          Enter your admin email to receive a one-time code.
        </p>
        <div class="mb-4">
          <label class="field-label">Email</label>
          <input
            v-model="email"
            class="field-input"
            type="email"
            placeholder="admin@example.com"
            @keyup.enter="requestOtp"
          />
        </div>
        <div v-if="error" class="mb-3 text-label-md text-error">
          {{ error }}
        </div>
        <button
          class="btn btn-primary w-full"
          :disabled="otpRequestPending"
          :aria-busy="otpRequestPending"
          aria-live="polite"
          @click="requestOtp"
        >
          {{ otpRequestButtonText }}
        </button>
      </template>

      <!-- Step 2: OTP verification -->
      <template v-else>
        <p class="mb-4 text-sm text-on-surface-variant" role="status" aria-live="polite">
          Code sent. Enter the 6-digit code sent to <strong>{{ email }}</strong>.
        </p>
        <div class="mb-4">
          <label class="field-label">Verification Code</label>
          <input
            v-model="code"
            class="field-input text-center font-mono text-lg tracking-[8px]"
            type="text"
            maxlength="6"
            placeholder="000000"
            @keyup.enter="verifyOtp"
          />
        </div>
        <div v-if="error" class="mb-3 text-label-md text-error">
          {{ error }}
        </div>
        <button class="btn btn-primary w-full" :disabled="verifying" @click="verifyOtp">
          {{ verifying ? 'Verifying...' : 'Verify & Login' }}
        </button>
        <button
          class="mt-3 w-full text-center text-label-md text-on-surface-variant hover:text-primary"
          @click="backToEmailStep"
        >
          ← Back to email
        </button>
      </template>

      <div class="mt-6 border-t border-outline-variant pt-4 text-center">
        <button
          class="text-label-md text-on-surface-variant hover:text-primary"
          @click="emit('back')"
        >
          ← Back to Game
        </button>
      </div>
    </div>
  </div>
</template>
