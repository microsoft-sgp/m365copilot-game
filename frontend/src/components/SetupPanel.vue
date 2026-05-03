<script setup>
import { computed, onMounted, ref } from 'vue';
import { TOTAL_PACKS, STORAGE_KEYS } from '../data/constants.js';
import { loadString, removeKey } from '../lib/storage.js';
import {
  apiGetPlayerState,
  apiPlayerRecoveryRequest,
  apiPlayerRecoveryVerify,
} from '../lib/api.js';
import { useBingoGame } from '../composables/useBingoGame.js';

const { clearRecoveryRequired, ensurePackAssignment, hydrateFromServer, startBoard, state } =
  useBingoGame();

const error = ref('');
const recoveryStatus = ref('');
const recoveryCode = ref('');
const codeRequested = ref(false);
const assigning = ref(false);
const launching = ref(false);
const requestingCode = ref(false);
const verifyingCode = ref(false);

const assignedPack = computed(
  () => state.assignedPackId || Number(loadString(STORAGE_KEYS.lastPack) || 0),
);
const assignedPackLabel = computed(() => {
  if (!assignedPack.value) return '#---';
  return `#${String(assignedPack.value).padStart(3, '0')}`;
});
const cycleText = computed(() => {
  if (!state.assignmentCycle) return 'Cycle information will appear after assignment sync.';
  return `Cycle ${state.assignmentCycle}`;
});
const statusText = computed(() => {
  if (state.recoveryRequired) {
    return 'Recovery is required before this board can continue.';
  }
  if (state.assignmentRotated && state.completedPackId) {
    return `Great work completing Pack #${String(state.completedPackId).padStart(3, '0')}! A new pack has been assigned.`;
  }
  if (assignedPack.value) {
    return 'Your current pack is ready.';
  }
  return 'Fetching your assigned pack...';
});
const recoveryEmail = computed(() => state.recoveryEmail || loadString(STORAGE_KEYS.email));

async function syncAssignment() {
  if (assignedPack.value || assigning.value) return;
  const name = loadString(STORAGE_KEYS.playerName);
  const email = loadString(STORAGE_KEYS.email);
  const organization = loadString(STORAGE_KEYS.organization);
  if (!name || !email) return;

  assigning.value = true;
  try {
    const result = await ensurePackAssignment({ name, email, organization });
    if (result?.recoveryRequired) {
      error.value = '';
    } else if (!result?.ok && !assignedPack.value) {
      error.value = result?.message || 'Unable to resolve your assigned pack. Please try again.';
    }
  } finally {
    assigning.value = false;
  }
}

onMounted(() => {
  void syncAssignment();
});

async function launch() {
  error.value = '';
  const name = loadString(STORAGE_KEYS.playerName);
  const email = loadString(STORAGE_KEYS.email);
  const organization = loadString(STORAGE_KEYS.organization);
  const num = Number(assignedPack.value || 0);
  if (num && (num < 1 || num > TOTAL_PACKS)) {
    error.value = 'Your assigned pack is not valid. Please refresh and try again.';
    return;
  }
  if (!name) {
    error.value = 'Please restart and complete onboarding identity.';
    return;
  }
  launching.value = true;
  try {
    const result = await startBoard({ name, email, organization, packId: num || undefined });
    if (!result?.ok) {
      error.value = result?.message || 'Unable to start your board. Please try again.';
    }
  } finally {
    launching.value = false;
  }
}

async function requestRecoveryCode() {
  error.value = '';
  recoveryStatus.value = '';
  const email = recoveryEmail.value;
  if (!email) {
    error.value = 'Email is required for recovery.';
    return;
  }
  requestingCode.value = true;
  try {
    const res = await apiPlayerRecoveryRequest(email);
    if (res.ok) {
      codeRequested.value = true;
      recoveryStatus.value = 'Recovery code sent.';
      return;
    }
    error.value = res.data?.message || 'Could not request a recovery code.';
  } finally {
    requestingCode.value = false;
  }
}

async function verifyRecoveryCode() {
  error.value = '';
  recoveryStatus.value = '';
  const name = loadString(STORAGE_KEYS.playerName);
  const email = recoveryEmail.value;
  const organization = loadString(STORAGE_KEYS.organization);
  const code = recoveryCode.value.trim();
  if (!email || !code) {
    error.value = 'Email and code are required.';
    return;
  }
  verifyingCode.value = true;
  try {
    const verify = await apiPlayerRecoveryVerify(email, code);
    if (!verify.ok) {
      error.value = verify.data?.message || 'Invalid or expired code.';
      return;
    }

    clearRecoveryRequired();
    const launchResult = await startBoard({
      name,
      email,
      organization,
      packId: Number(assignedPack.value || 0) || undefined,
    });
    if (!launchResult?.ok) {
      error.value = launchResult?.message || 'Unable to resume your board.';
      return;
    }

    const stateResult = await apiGetPlayerState(email);
    if (stateResult.ok && stateResult.data?.player) {
      hydrateFromServer(stateResult.data.player);
    }
    recoveryStatus.value = 'Recovery complete.';
  } finally {
    verifyingCode.value = false;
  }
}

function cancelRecovery() {
  clearRecoveryRequired();
  removeKey(STORAGE_KEYS.email);
  removeKey(STORAGE_KEYS.playerName);
  removeKey(STORAGE_KEYS.organization);
  removeKey(STORAGE_KEYS.lastPack);
  removeKey(STORAGE_KEYS.state);
  window.location.reload();
}
</script>

<template>
  <div class="glass mx-auto max-w-[560px] rounded-[14px] p-6">
    <h2 class="text-gradient mb-1 text-title-lg font-black">Start Your Board</h2>
    <p class="mb-[18px] text-label-lg text-on-surface-variant">
      Your pack is assigned automatically across devices.
    </p>

    <div class="mb-4 rounded-[12px] border border-outline-variant bg-surface-container p-4">
      <div class="field-label mb-2">Assigned Pack</div>
      <div class="text-title-lg font-black text-primary">
        {{ assignedPackLabel }}
      </div>
      <p class="mt-2 text-label-md text-on-surface-variant">
        {{ statusText }}
      </p>
      <p class="mt-1 text-label-sm text-on-surface-variant">
        {{ cycleText }}
      </p>
    </div>

    <div
      v-if="state.recoveryRequired"
      class="mb-4 rounded-[12px] border border-outline-variant bg-surface-container p-4"
    >
      <div class="field-label mb-2">Player Recovery</div>
      <p class="mb-3 text-label-md text-on-surface-variant">
        {{ recoveryEmail }} needs a recovery code before this board can continue.
      </p>
      <div class="flex flex-wrap gap-2.5">
        <button
          class="btn btn-secondary"
          :disabled="requestingCode || verifyingCode"
          @click="requestRecoveryCode"
        >
          {{ requestingCode ? 'Sending...' : codeRequested ? 'Send Again' : 'Send Code' }}
        </button>
        <button
          class="btn btn-secondary"
          :disabled="requestingCode || verifyingCode"
          @click="cancelRecovery"
        >
          Use Different Email
        </button>
      </div>
      <div v-if="codeRequested" class="mt-3 flex flex-wrap gap-2.5">
        <input
          v-model="recoveryCode"
          class="input max-w-[180px]"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="000000"
        />
        <button
          class="btn btn-primary"
          :disabled="requestingCode || verifyingCode"
          @click="verifyRecoveryCode"
        >
          {{ verifyingCode ? 'Verifying...' : 'Verify Code' }}
        </button>
      </div>
      <p v-if="recoveryStatus" class="mt-2 text-xs text-on-surface-variant">
        {{ recoveryStatus }}
      </p>
    </div>

    <div class="mt-4 flex flex-wrap gap-2.5">
      <button
        class="btn btn-primary"
        :disabled="assigning || launching || state.recoveryRequired"
        @click="launch"
      >
        {{ assigning ? 'Assigning...' : launching ? 'Starting...' : '🚀 Launch Board' }}
      </button>
    </div>
    <p v-if="error" class="mt-2 text-xs text-error">
      {{ error }}
    </p>
  </div>
</template>
