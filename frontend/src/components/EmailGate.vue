<script setup>
import { computed, ref } from 'vue';
import { isPublicEmailDomain } from '../lib/emailDomains.js';

const emit = defineEmits(['continue', 'admin']);

const email = ref('');
const name = ref('');
const organization = ref('');
const error = ref('');

const requiresOrganization = computed(() => isPublicEmailDomain(email.value));

function submit() {
  error.value = '';
  const trimmedName = name.value.trim();
  const trimmed = email.value.trim().toLowerCase();
  const trimmedOrganization = organization.value.trim();
  if (!trimmedName) {
    error.value = 'Please enter how we should address you.';
    return;
  }
  if (!trimmed) {
    error.value = 'Please enter your email.';
    return;
  }
  if (!trimmed.includes('@')) {
    error.value = 'Please enter a valid email address.';
    return;
  }
  if (requiresOrganization.value && !trimmedOrganization) {
    error.value = 'Please enter your company, school, or organization.';
    return;
  }
  emit('continue', {
    email: trimmed,
    name: trimmedName,
    organization: requiresOrganization.value ? trimmedOrganization : '',
  });
}
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center px-5">
    <div class="glass mx-auto w-full max-w-[440px] rounded-[14px] p-8 text-center">
      <h1 class="text-gradient mb-2 text-headline-sm font-black">🎮 Copilot Chat Bingo</h1>
      <p class="mb-6 text-sm text-on-surface-variant">
        Enter your identity to play. Your progress and score will be tied to verified gameplay so
        you can resume on any device.
      </p>

      <div class="mb-4 text-left">
        <label class="field-label">How should we address you?</label>
        <input
          v-model="name"
          class="field-input"
          type="text"
          placeholder="e.g. Alex"
          maxlength="40"
          @keyup.enter="submit"
        />
      </div>

      <div class="mb-4 text-left">
        <label class="field-label">Email Address</label>
        <input
          v-model="email"
          class="field-input"
          type="email"
          placeholder="you@university.edu.sg"
          @keyup.enter="submit"
        />
        <div v-if="error" class="mt-1 text-label-md text-error">{{ error }}</div>
      </div>

      <div v-if="requiresOrganization" class="mb-4 text-left">
        <label class="field-label">Company / School / Organization</label>
        <input
          v-model="organization"
          class="field-input"
          type="text"
          placeholder="e.g. Contoso"
          maxlength="100"
          @keyup.enter="submit"
        />
      </div>

      <button class="btn btn-primary w-full" @click="submit">Continue →</button>

      <div class="mt-6 border-t border-outline-variant pt-4">
        <button
          class="text-label-md text-on-surface-variant hover:text-primary transition-colors"
          @click="emit('admin')"
        >
          🔐 Admin Login
        </button>
      </div>
    </div>
  </div>
</template>
