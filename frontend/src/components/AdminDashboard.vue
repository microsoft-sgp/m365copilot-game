<script setup>
import { ref, onMounted } from 'vue';
import { apiAdminGetDashboard, apiAdminExportCsv } from '../lib/api.js';

const loading = ref(true);
const dashboard = ref(null);

onMounted(async () => {
  const res = await apiAdminGetDashboard();
  if (res.ok && res.data) {
    dashboard.value = res.data;
  }
  loading.value = false;
});

async function exportCsv() {
  const res = await apiAdminExportCsv();
  if (res.blob) {
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'progression-scores.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-on-surface-variant">Loading dashboard…</div>
    <template v-else-if="dashboard">
      <!-- Summary Cards -->
      <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="glass rounded-xl p-4 text-center">
          <div class="text-2xl font-black text-tertiary">{{ dashboard.summary.totalPlayers }}</div>
          <div class="text-label-sm text-on-surface-variant">Players</div>
        </div>
        <div class="glass rounded-xl p-4 text-center">
          <div class="text-2xl font-black text-tertiary">{{ dashboard.summary.totalSessions }}</div>
          <div class="text-label-sm text-on-surface-variant">Sessions</div>
        </div>
        <div class="glass rounded-xl p-4 text-center">
          <div class="text-2xl font-black text-tertiary">{{ dashboard.summary.totalSubmissions }}</div>
          <div class="text-label-sm text-on-surface-variant">Score Events</div>
        </div>
        <div class="glass rounded-xl p-4 text-center">
          <div class="text-2xl font-black text-tertiary">{{ dashboard.summary.avgTilesCleared }}</div>
          <div class="text-label-sm text-on-surface-variant">Avg Tiles</div>
        </div>
      </div>

      <div v-if="dashboard.summary.topOrg" class="mb-5 text-sm text-on-surface-variant">
        🏆 Top Org: <strong class="text-primary">{{ dashboard.summary.topOrg }}</strong>
      </div>

      <!-- Sessions Table -->
      <div class="glass mb-5 rounded-[14px] p-5">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-extrabold text-primary">📋 Recent Sessions</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-label-md">
            <thead>
              <tr>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Player</th>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Pack</th>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Tiles</th>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Lines</th>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Last Active</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in dashboard.sessions" :key="s.id" class="hover:bg-primary/8">
                <td class="border-b border-outline-variant px-2 py-1.5">{{ s.player_name }}</td>
                <td class="border-b border-outline-variant px-2 py-1.5">{{ s.pack_id }}</td>
                <td class="border-b border-outline-variant px-2 py-1.5">{{ s.tiles_cleared }}/9</td>
                <td class="border-b border-outline-variant px-2 py-1.5">{{ s.lines_won }}</td>
                <td class="border-b border-outline-variant px-2 py-1.5">{{ new Date(s.last_active_at).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Score Events Table -->
      <div class="glass mb-5 rounded-[14px] p-5">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-extrabold text-primary">🧾 Recent Score Events</h3>
          <button class="btn btn-ghost btn-xs" @click="exportCsv">↓ Export CSV</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-label-md">
            <thead>
              <tr>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Player</th>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Org</th>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Event</th>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Keyword</th>
                <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Awarded</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in dashboard.submissions" :key="s.id" class="hover:bg-primary/8">
                <td class="border-b border-outline-variant px-2 py-1.5">{{ s.player_name }}</td>
                <td class="border-b border-outline-variant px-2 py-1.5">{{ s.org }}</td>
                <td class="border-b border-outline-variant px-2 py-1.5">{{ s.event_type || 'legacy_submission' }}</td>
                <td class="border-b border-outline-variant px-2 py-1.5 font-mono text-label-sm">{{ s.keyword }}</td>
                <td class="border-b border-outline-variant px-2 py-1.5">{{ new Date(s.created_at).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
    <div v-else class="text-error">Failed to load dashboard.</div>
  </div>
</template>
