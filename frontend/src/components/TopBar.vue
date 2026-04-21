<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';
const { clearedCount, linesWon, keywordCount } = useBingoGame();
</script>

<template>
  <div
    class="sticky top-0 z-[100] flex h-12 items-center justify-between border-b border-themed bg-app-2/80 px-5 backdrop-blur-md"
  >
    <div class="text-[11px] font-bold uppercase tracking-[2px] text-lilac/85">
      Powered by <span class="text-neon">Microsoft Student Ambassador</span>
    </div>
    <div class="text-gradient text-[15px] font-extrabold">
      ⚡ Copilot Chat Bingo
    </div>
    <div class="flex gap-3.5 text-[11px] text-muted">
      <span>Tiles: <b class="text-neon">{{ clearedCount }}/9</b></span>
      <span>Lines: <b class="text-neon">{{ linesWon }}/8</b></span>
      <span>Keys: <b class="text-neon">{{ keywordCount }}</b></span>
    </div>
  </div>
</template>
