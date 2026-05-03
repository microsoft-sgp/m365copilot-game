<script setup>
import { ref } from 'vue';
import { useBingoGame } from '../composables/useBingoGame.js';
import HudBar from './HudBar.vue';
import ChallengeBar from './ChallengeBar.vue';
import BingoGrid from './BingoGrid.vue';

const emit = defineEmits(['open-tile']);
const { state, rerollBoard } = useBingoGame();
const error = ref('');
const rerolling = ref(false);

function pad(n) {
  return String(n).padStart(3, '0');
}

async function newBoard() {
  error.value = '';
  if (
    confirm(
      'Start a new board? Your current board progress will be cleared and a new pack will be assigned.',
    )
  ) {
    rerolling.value = true;
    try {
      const result = await rerollBoard();
      if (!result?.ok) {
        error.value = result?.message || 'Unable to assign a new pack. Please try again.';
      }
    } finally {
      rerolling.value = false;
    }
  }
}
</script>

<template>
  <div class="mx-auto max-w-[680px]">
    <ChallengeBar v-if="state.challengeProfile" />
    <HudBar />

    <div class="mb-3.5 flex items-center justify-between">
      <div>
        <h2 class="text-gradient text-title-md font-black">Pack #{{ pad(state.packId) }}</h2>
        <div class="text-xs text-on-surface-variant">
          Player: {{ state.playerName }} · Session: {{ state.sessionId.slice(0, 8) }}…
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" :disabled="rerolling" @click="newBoard">
        {{ rerolling ? 'Assigning...' : '↩ New Board' }}
      </button>
    </div>

    <p v-if="error" class="mb-3 text-xs text-error">
      {{ error }}
    </p>

    <BingoGrid @open-tile="(i) => emit('open-tile', i)" />
  </div>
</template>
