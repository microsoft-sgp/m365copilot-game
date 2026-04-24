<script setup>
import { computed } from 'vue';
import { useBingoGame } from '../composables/useBingoGame.js';
const { clearedCount, linesWon, keywordCount, boardProgress } =
  useBingoGame();

const motivation = computed(() => {
  const p = boardProgress.value;
  if (p === 0) return "Let's get started! Pick a tile. 🎯";
  if (p <= 33) return 'Nice start! Keep going! 💪';
  if (p <= 66) return 'On fire! 🔥';
  if (p < 100) return 'Almost there! 🚀';
  return 'Board complete! 🎉';
});
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
        class="text-[10px] uppercase tracking-[0.5px] text-muted"
      >
        Tiles Cleared
      </div>
    </div>
    <div class="flex flex-col items-center gap-0.5">
      <div class="text-gradient text-[22px] font-black">{{ linesWon }}</div>
      <div class="text-[10px] uppercase tracking-[0.5px] text-muted">
        Lines Won
      </div>
    </div>
    <div class="flex flex-col items-center gap-0.5">
      <div class="text-gradient text-[22px] font-black">
        {{ keywordCount }}
      </div>
      <div class="text-[10px] uppercase tracking-[0.5px] text-muted">
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
      <div class="mt-0.5 text-[11px] text-muted/80">
        {{ motivation }}
      </div>
    </div>
  </div>
</template>
