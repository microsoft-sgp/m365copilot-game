<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';
const { clearedCount, linesWon, keywordCount } = useBingoGame();
</script>

<template>
  <div
    class="sticky top-0 z-[100] flex h-12 items-center justify-between border-b border-themed bg-surface-container/80 px-5 backdrop-blur-md"
  >
    <div class="text-gradient text-title-md font-extrabold">⚡ Copilot Bingo</div>
    <div class="flex gap-3 text-label-lg">
      <span title="Tiles cleared"
        >🔥 <b class="text-tertiary">{{ clearedCount }}</b></span
      >
      <span title="Lines won"
        >⭐ <b class="text-tertiary">{{ linesWon }}</b></span
      >
      <span title="Keywords earned"
        >🔑 <b class="text-tertiary">{{ keywordCount }}</b></span
      >
    </div>
  </div>
</template>
