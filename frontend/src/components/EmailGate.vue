<script setup>
import { ref } from 'vue';

const emit = defineEmits(['continue', 'admin']);

const email = ref('');
const error = ref('');

function submit() {
  error.value = '';
  const trimmed = email.value.trim().toLowerCase();
  if (!trimmed) {
    error.value = 'Please enter your email.';
    return;
  }
  if (!trimmed.includes('@')) {
    error.value = 'Please enter a valid email address.';
    return;
  }
  emit('continue', trimmed);
}
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center px-5">
    <div class="glass mx-auto w-full max-w-[440px] rounded-[14px] p-8 text-center">
      <h1 class="text-gradient mb-2 text-[28px] font-black">🎮 Copilot Chat Bingo</h1>
      <p class="mb-6 text-sm text-muted">
        Enter your email to play. Your progress will be saved so you can resume
        on any device.
      </p>

      <div class="mb-4 text-left">
        <label class="field-label">Email Address</label>
        <input
          v-model="email"
          class="field-input"
          type="email"
          placeholder="you@university.edu.sg"
          @keyup.enter="submit"
        />
        <div v-if="error" class="mt-1 text-[12px] text-error">{{ error }}</div>
      </div>

      <button class="btn btn-primary w-full" @click="submit">
        Continue →
      </button>

      <div class="mt-6 border-t border-lilac/20 pt-4">
        <button
          class="text-[12px] text-muted hover:text-lilac transition-colors"
          @click="emit('admin')"
        >
          🔐 Admin Login
        </button>
      </div>
    </div>
  </div>
</template>
