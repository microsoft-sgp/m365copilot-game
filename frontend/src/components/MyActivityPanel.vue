<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useBingoGame } from '../composables/useBingoGame.js';
import { useSubmissions } from '../composables/useSubmissions.js';
import LeaderboardTable from './LeaderboardTable.vue';

const { state, keywordCount } = useBingoGame();
const { refreshLeaderboard, startPolling, stopPolling } = useSubmissions();

const sortedKeywords = computed(() =>
  [...state.keywords].sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)),
);

function fmt(ts) {
  return new Date(ts).toLocaleString();
}

onMounted(async () => {
  await refreshLeaderboard();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});

watch(keywordCount, async () => {
  // Refresh immediately when score-bearing progress changes locally.
  await refreshLeaderboard();
});
</script>

<template>
  <div class="mx-auto max-w-[720px]">
    <div class="glass mb-5 rounded-[14px] p-[22px]">
      <div class="mb-3.5 flex items-center justify-between">
        <h3 class="m-0 text-base font-extrabold text-primary">🏆 Organization Leaderboard</h3>
      </div>
      <LeaderboardTable />
    </div>

    <div class="glass mb-5 rounded-[14px] p-[22px]">
      <h3 class="mb-3 text-base font-extrabold text-primary">🧾 My Activity</h3>
      <p class="mb-4 text-label-md text-on-surface-variant">
        Activity is read-only. Score is awarded from verified gameplay progression.
      </p>

      <div v-if="!sortedKeywords.length" class="text-label-lg text-on-surface-variant">
        No activity yet. Complete a line to earn your first score event.
      </div>

      <div v-else class="flex max-h-[340px] flex-col gap-2 overflow-y-auto">
        <div
          v-for="k in sortedKeywords"
          :key="`${k.code}-${k.ts}`"
          class="flex items-center justify-between rounded-[10px] border border-outline-variant bg-surface-container px-3 py-2"
        >
          <div>
            <div class="font-mono text-label-md font-semibold text-tertiary">{{ k.code }}</div>
            <div class="text-label-sm text-on-surface-variant">
              {{ k.lineId }} · Pack {{ String(k.packId).padStart(3, '0') }}
            </div>
          </div>
          <div class="text-label-sm text-on-surface-variant">{{ fmt(k.ts) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
