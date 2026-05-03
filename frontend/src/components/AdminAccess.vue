<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  apiAdminAddAdmin,
  apiAdminGetAdmins,
  apiAdminRemoveAdmin,
  apiAdminRequestOtp,
  apiAdminVerifyStepUpOtp,
} from '../lib/api.js';

const admins = ref([]);
const loading = ref(true);
const error = ref('');
const newEmail = ref('');
const pendingAction = ref(null);
const otpCode = ref('');
const otpError = ref('');
const otpLoading = ref(false);

const currentAdminEmail = computed(() => {
  return sessionStorage.getItem('admin_email') || '';
});

async function loadAdmins() {
  loading.value = true;
  error.value = '';
  const res = await apiAdminGetAdmins();
  if (res.ok && res.data) {
    admins.value = res.data.admins || [];
  } else {
    error.value = res.data?.message || 'Failed to load admins.';
  }
  loading.value = false;
}

onMounted(loadAdmins);

async function beginAdd() {
  const email = newEmail.value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    error.value = 'Enter a valid admin email.';
    return;
  }
  await beginStepUp({ type: 'add', email });
}

async function beginRemove(admin) {
  await beginStepUp({ type: 'remove', email: admin.email });
}

async function beginStepUp(action) {
  error.value = '';
  otpError.value = '';
  otpCode.value = '';
  if (!currentAdminEmail.value) {
    error.value = 'Could not identify the current admin session.';
    return;
  }

  const res = await apiAdminRequestOtp(currentAdminEmail.value);
  if (!res.ok) {
    error.value = res.data?.message || 'Failed to send verification code.';
    return;
  }
  pendingAction.value = action;
}

async function confirmStepUp() {
  otpError.value = '';
  if (!otpCode.value.trim()) {
    otpError.value = 'Enter the verification code.';
    return;
  }

  otpLoading.value = true;
  const action = pendingAction.value;
  const actionName = action.type === 'add' ? 'add-admin' : 'remove-admin';
  const verifyRes = await apiAdminVerifyStepUpOtp(
    currentAdminEmail.value,
    otpCode.value.trim(),
    actionName,
    action.email,
  );
  if (!verifyRes.ok) {
    otpLoading.value = false;
    otpError.value = verifyRes.data?.message || 'Verification failed.';
    return;
  }

  const mutateRes =
    action.type === 'add'
      ? await apiAdminAddAdmin(action.email)
      : await apiAdminRemoveAdmin(action.email);
  otpLoading.value = false;

  if (!mutateRes.ok) {
    otpError.value = mutateRes.data?.message || 'Admin update failed.';
    return;
  }

  if (action.type === 'add') newEmail.value = '';
  pendingAction.value = null;
  otpCode.value = '';
  await loadAdmins();
}

function cancelStepUp() {
  pendingAction.value = null;
  otpCode.value = '';
  otpError.value = '';
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-base font-extrabold text-primary">Admin Access</h3>
      <button class="btn btn-ghost btn-sm" @click="loadAdmins">Refresh</button>
    </div>

    <p class="mb-4 text-label-lg text-on-surface-variant">
      Bootstrap admins come from Function App settings. Portal-managed admins are stored in the
      database.
    </p>

    <div class="glass mb-5 rounded-xl p-4">
      <label class="field-label">Add Admin Email</label>
      <div class="flex flex-wrap gap-2">
        <input
          v-model="newEmail"
          class="field-input min-w-[240px] flex-1"
          type="email"
          placeholder="admin@example.com"
        />
        <button class="btn btn-primary btn-sm" @click="beginAdd">Add Admin</button>
      </div>
    </div>

    <div v-if="error" class="mb-3 text-label-md text-error">
      {{ error }}
    </div>
    <div v-if="loading" class="text-on-surface-variant">Loading…</div>

    <div v-else class="space-y-3">
      <div
        v-for="admin in admins"
        :key="`${admin.source}:${admin.email}`"
        class="glass rounded-xl p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="font-semibold text-on-surface">
              {{ admin.email }}
            </div>
            <div class="mt-1 flex flex-wrap gap-2 text-label-sm">
              <span class="rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary">
                {{ admin.source === 'bootstrap' ? 'BOOTSTRAP' : 'PORTAL' }}
              </span>
              <span
                class="rounded-full px-2 py-0.5 font-bold"
                :class="admin.isActive ? 'bg-success/15 text-success' : 'bg-error/15 text-error'"
              >
                {{ admin.isActive ? 'ACTIVE' : 'DISABLED' }}
              </span>
            </div>
          </div>
          <button
            v-if="admin.source === 'portal' && admin.isActive"
            class="btn-danger px-3 py-1.5 text-label-md"
            @click="beginRemove(admin)"
          >
            Disable
          </button>
          <span
            v-else-if="admin.source === 'bootstrap'"
            class="text-label-md text-on-surface-variant"
          >
            Managed in app settings
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="pendingAction"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
    >
      <div class="glass w-full max-w-[420px] rounded-[14px] p-6">
        <h4 class="mb-2 text-base font-extrabold text-primary">Re-enter OTP</h4>
        <p class="mb-4 text-label-lg text-on-surface-variant">
          Enter the code sent to {{ currentAdminEmail }} before
          {{ pendingAction.type === 'add' ? 'adding' : 'disabling' }} {{ pendingAction.email }}.
        </p>
        <label class="field-label">Verification Code</label>
        <input
          v-model="otpCode"
          class="field-input text-center font-mono text-lg tracking-[8px]"
          maxlength="6"
          placeholder="000000"
          @keyup.enter="confirmStepUp"
        />
        <div v-if="otpError" class="mt-3 text-label-md text-error">
          {{ otpError }}
        </div>
        <div class="mt-5 flex gap-2">
          <button class="btn btn-primary flex-1" :disabled="otpLoading" @click="confirmStepUp">
            {{ otpLoading ? 'Verifying…' : 'Confirm' }}
          </button>
          <button class="btn btn-ghost flex-1" :disabled="otpLoading" @click="cancelStepUp">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
