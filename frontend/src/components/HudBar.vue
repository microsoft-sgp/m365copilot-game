<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';
const { clearedCount, linesWon, keywordCount, boardProgress } =
  useBingoGame();
</script>

<template>
  <div
    class="glass mb-4 flex flex-wrap gap-5 rounded-[14px] px-[18px] py-3.5"
  >
    <div class="flex flex-col items-center gap-0.5">
      <div class="text-gradient text-[22px] font-black">
        {{ clearedCount }}
      </div>
      <div
        class="text-[10px] uppercase tracking-[1px] text-muted"
      >
        Tiles Cleared
      </div>
    </div>
    <div class="flex flex-col items-center gap-0.5">
      <div class="text-gradient text-[22px] font-black">{{ linesWon }}</div>
      <div class="text-[10px] uppercase tracking-[1px] text-muted">
        Lines Won
      </div>
    </div>
    <div class="flex flex-col items-center gap-0.5">
      <div class="text-gradient text-[22px] font-black">
        {{ keywordCount }}
      </div>
      <div class="text-[10px] uppercase tracking-[1px] text-muted">
        Keywords
      </div>
    </div>
    <div class="flex min-w-[160px] flex-1 flex-col justify-center gap-1">
      <div class="flex justify-between text-xs text-muted">
        <span>Board Progress</span>
        <span>{{ boardProgress }}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: boardProgress + '%' }"></div>
      </div>
    </div>
  </div>
</template>
