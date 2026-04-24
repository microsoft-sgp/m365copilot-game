<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';
const { state } = useBingoGame();

function pad(n) {
  return String(n).padStart(3, '0');
}
function fmt(ts) {
  return new Date(ts).toLocaleString();
}
function copy(code) {
  navigator.clipboard.writeText(code).catch(() => {});
}
</script>

<template>
  <div class="mx-auto max-w-[660px]">
    <div
      class="my-5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[2px] text-muted"
    >
      My Earned Keywords
      <span class="h-px flex-1 bg-[rgba(192,132,252,0.25)]"></span>
    </div>

    <div v-if="!state.keywords.length">
      <p class="text-[13px] text-muted">
        No keywords yet — complete a Bingo line to earn one!
      </p>
    </div>

    <div v-else class="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
      <div
        v-for="k in state.keywords"
        :key="k.code"
        class="glass flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-xs"
      >
        <div class="flex-1 font-mono text-[13px] font-bold text-neon">
          {{ k.code }}
        </div>
        <div class="text-[11px] text-muted">
          Pack {{ pad(k.packId) }} · {{ k.lineId }} · {{ fmt(k.ts) }}
        </div>
        <button class="btn btn-ghost btn-xs" @click="copy(k.code)">
          📋
        </button>
      </div>
    </div>
  </div>
</template>
