<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';
const { clearedCount, linesWon, keywordCount } = useBingoGame();
</script>

<template>
  <div
    class="sticky top-0 z-[100] flex h-12 items-center justify-between border-b border-themed bg-app-2/80 px-5 backdrop-blur-md"
  >
    <div class="text-gradient text-[18px] font-extrabold">
      ⚡ Copilot Bingo
    </div>
    <div class="flex gap-3 text-[13px]">
      <span title="Tiles cleared">🔥 <b class="text-neon">{{ clearedCount }}</b></span>
      <span title="Lines won">⭐ <b class="text-neon">{{ linesWon }}</b></span>
      <span title="Keywords earned">🔑 <b class="text-neon">{{ keywordCount }}</b></span>
    </div>
  </div>
</template>
