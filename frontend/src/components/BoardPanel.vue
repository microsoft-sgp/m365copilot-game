<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';
import HudBar from './HudBar.vue';
import ChallengeBar from './ChallengeBar.vue';
import BingoGrid from './BingoGrid.vue';

const emit = defineEmits(['open-tile']);
const { state, resetBoard } = useBingoGame();

function pad(n) {
  return String(n).padStart(3, '0');
}

function newBoard() {
  if (confirm('Start a new board? Your current board progress will be cleared.')) {
    resetBoard();
  }
}
</script>

<template>
  <div class="mx-auto max-w-[680px]">
    <ChallengeBar v-if="state.challengeProfile" />
    <HudBar />

    <div class="mb-3.5 flex items-center justify-between">
      <div>
        <h2 class="text-gradient text-title-md font-black">
          Pack #{{ pad(state.packId) }}
        </h2>
        <div class="text-xs text-on-surface-variant">
          Player: {{ state.playerName }} · Session: {{ state.sessionId.slice(0, 8) }}…
        </div>
      </div>
      <button
        class="btn btn-ghost btn-sm"
        @click="newBoard"
      >
        ↩ New Board
      </button>
    </div>

    <BingoGrid @open-tile="(i) => emit('open-tile', i)" />
  </div>
</template>
