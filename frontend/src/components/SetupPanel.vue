<script setup>
import { computed, onMounted, ref } from 'vue';
import { TOTAL_PACKS, STORAGE_KEYS } from '../data/constants.js';
import { loadString } from '../lib/storage.js';
import { useBingoGame } from '../composables/useBingoGame.js';

const { ensurePackAssignment, startBoard, state } = useBingoGame();

const error = ref('');
const assigning = ref(false);
const launching = ref(false);

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
  if (state.assignmentRotated && state.completedPackId) {
    return `Great work completing Pack #${String(state.completedPackId).padStart(3, '0')}! A new pack has been assigned.`;
  }
  if (assignedPack.value) {
    return 'Your assigned pack is locked for this challenge cycle.';
  }
  return 'Fetching your assigned pack...';
});

async function syncAssignment() {
  if (assignedPack.value || assigning.value) return;
  const name = loadString(STORAGE_KEYS.playerName);
  const email = loadString(STORAGE_KEYS.email);
  const organization = loadString(STORAGE_KEYS.organization);
  if (!name || !email) return;

  assigning.value = true;
  try {
    const result = await ensurePackAssignment({ name, email, organization });
    if (!result?.ok && !assignedPack.value) {
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
</script>

<template>
  <div class="glass mx-auto max-w-[560px] rounded-[14px] p-6">
    <h2 class="text-gradient mb-1 text-title-lg font-black">
      Start Your Board
    </h2>
    <p class="mb-[18px] text-label-lg text-on-surface-variant">
      Your pack is assigned automatically for fairness across devices.
    </p>

    <div class="mb-4 rounded-[12px] border border-outline-variant bg-surface-container p-4">
      <div class="field-label mb-2">
        Assigned Pack
      </div>
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

    <div class="mt-4 flex flex-wrap gap-2.5">
      <button
        class="btn btn-primary"
        :disabled="assigning || launching"
        @click="launch"
      >
        {{ assigning ? 'Assigning...' : launching ? 'Starting...' : '🚀 Launch Board' }}
      </button>
    </div>
    <p
      v-if="error"
      class="mt-2 text-xs text-error"
    >
      {{ error }}
    </p>
  </div>
</template>
