<script setup>
import { useSubmissions } from '../composables/useSubmissions.js';

const props = defineProps({
  playerOrg: { type: String, default: '' },
});

const { leaderboard } = useSubmissions();

function fmt(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}
function fmtFull(ts) {
  return new Date(ts).toLocaleString();
}
function rankClass(i) {
  return i < 3 ? `rank-${i + 1}` : 'rank-n';
}
function isPlayerOrg(org) {
  return props.playerOrg && org.toLowerCase() === props.playerOrg.toLowerCase();
}
</script>

<template>
  <div>
    <p
      v-if="!leaderboard.length"
      class="text-[14px] text-muted"
    >
      No submissions yet. Be the first! 🚀
    </p>
    <div v-else class="overflow-x-auto">
      <table class="mt-2.5 w-full border-collapse">
        <thead>
          <tr>
            <th
              class="border-b border-themed px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.5px] text-neon-2"
            >
              Rank
            </th>
            <th
              class="border-b border-themed px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.5px] text-neon-2"
            >
              Organization
            </th>
            <th
              class="border-b border-themed px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.5px] text-neon-2"
            >
              #
            </th>
            <th
              class="hidden border-b border-themed px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.5px] text-neon-2 sm:table-cell"
            >
              Last Submission
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in leaderboard"
            :key="r.org"
            class="hover:bg-lilac/5"
            :class="{ 'bg-lilac/10 ring-1 ring-lilac/30': isPlayerOrg(r.org) }"
          >
            <td
              class="border-b border-[rgba(192,132,252,0.15)] px-3 py-2.5 text-[14px] text-text"
            >
              <span class="rank-badge" :class="rankClass(i)">{{ i + 1 }}</span>
            </td>
            <td
              class="border-b border-[rgba(192,132,252,0.15)] px-3 py-2.5 text-[14px] text-text"
            >
              <strong>{{ r.org }}</strong>
              <span v-if="isPlayerOrg(r.org)" class="ml-1 text-[10px] text-neon">★ You</span>
            </td>
            <td
              class="border-b border-[rgba(192,132,252,0.15)] px-3 py-2.5 text-[14px] text-text"
            >
              {{ r.contributorCount }}
            </td>
            <td
              class="hidden border-b border-[rgba(192,132,252,0.15)] px-3 py-2.5 text-[14px] text-muted sm:table-cell"
            >
              {{ fmtFull(r.lastTs) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
