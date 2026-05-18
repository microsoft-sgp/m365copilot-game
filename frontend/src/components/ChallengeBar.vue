<script setup>
import { computed } from 'vue';
import { TOTAL_WEEKS } from '../data/constants.js';
import { useBingoGame } from '../composables/useBingoGame.js';

const { state } = useBingoGame();

const cp = computed(() => state.challengeProfile);
const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
const submittedWeeks = computed(() => {
  const submitted = Array.isArray(cp.value?.weeklySubmissions) ? cp.value.weeklySubmissions : [];
  const validWeeks = submitted
    .map((week) => Number(week))
    .filter((week) => Number.isInteger(week) && week >= 1 && week <= TOTAL_WEEKS);
  if (validWeeks.length > 0) return new Set(validWeeks);

  const fallbackDone = Math.min(Math.max(Number(cp.value?.weeksCompleted ?? 0), 0), TOTAL_WEEKS);
  return new Set(Array.from({ length: fallbackDone }, (_, i) => i + 1));
});
const done = computed(() => submittedWeeks.value.size);
const left = computed(() => TOTAL_WEEKS - done.value);
const progressPct = computed(() => Math.round((done.value / TOTAL_WEEKS) * 100));

function isWeekDone(week) {
  return submittedWeeks.value.has(week);
}

function isCurrentWeek(week) {
  return week === cp.value?.currentWeek && !isWeekDone(week);
}
</script>

<template>
  <div v-if="cp" class="glass mb-4 rounded-[14px] px-5 py-4">
    <h4 class="mb-2.5 text-xs font-bold uppercase tracking-[1px] text-primary">
      7-Week Challenge Progress
    </h4>
    <div class="mb-2 flex gap-2">
      <div
        v-for="w in weeks"
        :key="w"
        class="wdot"
        :class="{
          done: isWeekDone(w),
          current: isCurrentWeek(w),
        }"
      >
        W{{ w }}
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <div class="flex justify-between text-xs text-on-surface-variant">
        <span
          >Completed: {{ done }}/{{ TOTAL_WEEKS }} • {{ left }} week{{
            left !== 1 ? 's' : ''
          }}
          left</span
        >
        <span>Week {{ cp.currentWeek }}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPct + '%' }" />
      </div>
    </div>
  </div>
</template>
