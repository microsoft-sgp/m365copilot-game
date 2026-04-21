<script setup>
import { useSubmissions } from '../composables/useSubmissions.js';

const { leaderboard } = useSubmissions();

function fmt(ts) {
  return new Date(ts).toLocaleString();
}
function rankClass(i) {
  return i < 3 ? `rank-${i + 1}` : 'rank-n';
}
</script>

<template>
  <div>
    <p
      v-if="!leaderboard.length"
      class="text-[13px] text-muted"
    >
      No submissions yet. Be the first!
    </p>
    <table v-else class="mt-2.5 w-full border-collapse">
      <thead>
        <tr>
          <th
            class="border-b border-themed px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[1px] text-muted"
          >
            Rank
          </th>
          <th
            class="border-b border-themed px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[1px] text-muted"
          >
            Organization
          </th>
          <th
            class="border-b border-themed px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[1px] text-muted"
          >
            # Contributors
          </th>
          <th
            class="border-b border-themed px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[1px] text-muted"
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
        >
          <td
            class="border-b border-[rgba(192,132,252,0.08)] px-3 py-2.5 text-[13px]"
          >
            <span class="rank-badge" :class="rankClass(i)">{{ i + 1 }}</span>
          </td>
          <td
            class="border-b border-[rgba(192,132,252,0.08)] px-3 py-2.5 text-[13px]"
          >
            <strong>{{ r.org }}</strong>
          </td>
          <td
            class="border-b border-[rgba(192,132,252,0.08)] px-3 py-2.5 text-[13px]"
          >
            {{ r.contributorCount }}
          </td>
          <td
            class="border-b border-[rgba(192,132,252,0.08)] px-3 py-2.5 text-[13px]"
          >
            {{ fmt(r.lastTs) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
