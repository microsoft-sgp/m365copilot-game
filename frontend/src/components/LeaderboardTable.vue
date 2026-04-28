<script setup>
import { useSubmissions } from '../composables/useSubmissions.js';

const props = defineProps({
  playerOrg: { type: String, default: '' },
});

const { leaderboard } = useSubmissions();

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
      class="text-body-md text-on-surface-variant"
    >
      No submissions yet. Be the first! 🚀
    </p>
    <div
      v-else
      class="overflow-x-auto"
    >
      <table class="mt-2.5 w-full border-collapse">
        <thead>
          <tr>
            <th
              class="border-b border-themed px-3 py-2 text-left text-label-md font-semibold uppercase tracking-[0.5px] text-tertiary"
            >
              Rank
            </th>
            <th
              class="border-b border-themed px-3 py-2 text-left text-label-md font-semibold uppercase tracking-[0.5px] text-tertiary"
            >
              Organization
            </th>
            <th
              class="border-b border-themed px-3 py-2 text-left text-label-md font-semibold uppercase tracking-[0.5px] text-tertiary"
            >
              #
            </th>
            <th
              class="hidden border-b border-themed px-3 py-2 text-left text-label-md font-semibold uppercase tracking-[0.5px] text-tertiary sm:table-cell"
            >
              Last Submission
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in leaderboard"
            :key="r.org"
            class="hover:bg-primary/8"
            :class="{ 'bg-primary/10 ring-1 ring-primary/30': isPlayerOrg(r.org) }"
          >
            <td class="border-b border-outline-variant px-3 py-2.5 text-body-md text-on-surface">
              <span
                class="rank-badge"
                :class="rankClass(i)"
              >{{ i + 1 }}</span>
            </td>
            <td class="border-b border-outline-variant px-3 py-2.5 text-body-md text-on-surface">
              <strong>{{ r.org }}</strong>
              <span
                v-if="isPlayerOrg(r.org)"
                class="ml-1 text-label-sm text-tertiary"
              >★ You</span>
            </td>
            <td class="border-b border-outline-variant px-3 py-2.5 text-body-md text-on-surface">
              {{ r.contributorCount }}
            </td>
            <td
              class="hidden border-b border-outline-variant px-3 py-2.5 text-body-md text-on-surface-variant sm:table-cell"
            >
              {{ fmtFull(r.lastTs) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
