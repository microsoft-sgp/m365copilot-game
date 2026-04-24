<script setup>
import { ref } from 'vue';
import { apiAdminRequestOtp, apiAdminVerifyOtp } from '../lib/api.js';

const emit = defineEmits(['authenticated', 'back']);

const email = ref('');
const code = ref('');
const step = ref('email'); // 'email' | 'otp'
const error = ref('');
const loading = ref(false);

async function requestOtp() {
  error.value = '';
  const trimmed = email.value.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    error.value = 'Please enter a valid email.';
    return;
  }
  loading.value = true;
  const res = await apiAdminRequestOtp(trimmed);
  loading.value = false;

  if (res.ok) {
    step.value = 'otp';
  } else if (res.status === 429) {
    error.value = 'Please wait before requesting another code.';
  } else {
    error.value = res.data?.message || 'Failed to send code.';
  }
}

async function verifyOtp() {
  error.value = '';
  if (!code.value.trim()) {
    error.value = 'Please enter the 6-digit code.';
    return;
  }
  loading.value = true;
  const res = await apiAdminVerifyOtp(email.value.trim().toLowerCase(), code.value.trim());
  loading.value = false;

  if (res.ok && res.data?.token) {
    sessionStorage.setItem('admin_token', res.data.token);
    emit('authenticated');
  } else {
    error.value = res.data?.message || 'Invalid code.';
  }
}
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center px-5">
    <div class="glass mx-auto w-full max-w-[420px] rounded-[14px] p-8">
      <h2 class="text-gradient mb-2 text-[22px] font-black">🔐 Admin Login</h2>

      <!-- Step 1: Email -->
      <template v-if="step === 'email'">
        <p class="mb-4 text-sm text-muted">
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
        <div v-if="error" class="mb-3 text-[12px] text-error">{{ error }}</div>
        <button
          class="btn btn-primary w-full"
          :disabled="loading"
          @click="requestOtp"
        >
          {{ loading ? 'Sending…' : 'Send Code' }}
        </button>
      </template>

      <!-- Step 2: OTP verification -->
      <template v-else>
        <p class="mb-4 text-sm text-muted">
          Enter the 6-digit code sent to <strong>{{ email }}</strong>.
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
        <div v-if="error" class="mb-3 text-[12px] text-error">{{ error }}</div>
        <button
          class="btn btn-primary w-full"
          :disabled="loading"
          @click="verifyOtp"
        >
          {{ loading ? 'Verifying…' : 'Verify & Login' }}
        </button>
        <button
          class="mt-3 w-full text-center text-[12px] text-muted hover:text-lilac"
          @click="step = 'email'; error = ''"
        >
          ← Back to email
        </button>
      </template>

      <div class="mt-6 border-t border-lilac/20 pt-4 text-center">
        <button
          class="text-[12px] text-muted hover:text-lilac"
          @click="emit('back')"
        >
          ← Back to Game
        </button>
      </div>
    </div>
  </div>
</template>
