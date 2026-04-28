<script setup>
import { computed } from 'vue';
import { TOTAL_WEEKS } from '../data/constants.js';
import { useBingoGame } from '../composables/useBingoGame.js';

const { state } = useBingoGame();

const cp = computed(() => state.challengeProfile);
const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
const done = computed(() => cp.value?.weeksCompleted ?? 0);
const left = computed(() => TOTAL_WEEKS - done.value);
const progressPct = computed(() => Math.round((done.value / TOTAL_WEEKS) * 100));
</script>

<template>
  <div
    v-if="cp"
    class="glass mb-4 rounded-[14px] px-5 py-4"
  >
    <h4 class="mb-2.5 text-xs font-bold uppercase tracking-[1px] text-primary">
      7-Week Challenge Progress
    </h4>
    <div class="mb-2 flex gap-2">
      <div
        v-for="w in weeks"
        :key="w"
        class="wdot"
        :class="{
          done: w <= done,
          current: w === cp.currentWeek && w > done,
        }"
      >
        W{{ w }}
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <div class="flex justify-between text-xs text-on-surface-variant">
        <span>Completed: {{ done }}/{{ TOTAL_WEEKS }} • {{ left }} week{{
          left !== 1 ? 's' : ''
        }}
          left</span>
        <span>Week {{ cp.currentWeek }}</span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: progressPct + '%' }"
        />
      </div>
    </div>
  </div>
</template>
