<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { TOTAL_PACKS, STORAGE_KEYS } from '../data/constants.js';
import { loadString } from '../lib/storage.js';
import { useBingoGame } from '../composables/useBingoGame.js';

const { startBoard } = useBingoGame();

const luckyNum = ref('');
const search = ref('');
const error = ref('');

const packs = Array.from({ length: TOTAL_PACKS }, (_, i) => i + 1);
const gridRef = ref(null);

onMounted(() => {
  const lp = loadString(STORAGE_KEYS.lastPack);
  if (lp) {
    luckyNum.value = lp;
    nextTick(() => scrollToSelected());
  }
});

function pad(n) {
  return String(n).padStart(3, '0');
}

function visiblePack(p) {
  if (!search.value) return true;
  return pad(p).includes(search.value);
}

function selectPack(p) {
  luckyNum.value = String(p);
}

function quickPick() {
  const n = Math.floor(Math.random() * TOTAL_PACKS) + 1;
  luckyNum.value = String(n);
  nextTick(() => scrollToSelected());
}

function scrollToSelected() {
  if (!gridRef.value) return;
  const el = gridRef.value.querySelector(`[data-pack="${luckyNum.value}"]`);
  if (el) el.scrollIntoView({ block: 'nearest' });
}

function launch() {
  error.value = '';
  const name = loadString(STORAGE_KEYS.playerName);
  const num = parseInt(luckyNum.value, 10);
  if (!num || num < 1 || num > TOTAL_PACKS) {
    error.value = `Please choose a pack between 1 and ${TOTAL_PACKS}.`;
    return;
  }
  if (!name) {
    error.value = 'Please restart and complete onboarding identity.';
    return;
  }
  startBoard({ name, packId: num });
}
</script>

<template>
  <div class="glass mx-auto max-w-[560px] rounded-[14px] p-6">
    <h2 class="text-gradient mb-1 text-title-lg font-black">Start Your Board</h2>
    <p class="mb-[18px] text-label-lg text-on-surface-variant">
      Choose a pack (001–{{ TOTAL_PACKS }}) or use Quick Pick to generate your
      personalised Bingo board.
    </p>

    <div class="mb-3.5">
      <label class="field-label">Lucky Number (Pack)</label>
      <input
        v-model="luckyNum"
        class="field-input"
        type="number"
        :min="1"
        :max="TOTAL_PACKS"
        placeholder="1–999"
      />
    </div>

    <label class="field-label">Browse Packs</label>
    <input
      v-model="search"
      class="field-input mb-2"
      type="text"
      placeholder="Search pack number…"
    />
    <div
      ref="gridRef"
      class="my-2.5 grid max-h-[220px] grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-2 overflow-y-auto p-1"
    >
      <div
        v-for="p in packs"
        v-show="visiblePack(p)"
        :key="p"
        :data-pack="p"
        class="pack-cell"
        :class="{ selected: String(p) === luckyNum }"
        @click="selectPack(p)"
      >
        {{ pad(p) }}
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2.5">
      <button class="btn btn-primary" @click="launch">🚀 Launch Board</button>
      <button class="btn btn-ghost btn-sm" @click="quickPick">
        🎲 Quick Pick
      </button>
    </div>
    <p v-if="error" class="mt-2 text-xs text-error">{{ error }}</p>
  </div>
</template>
