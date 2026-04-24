<script setup>
import { ref } from 'vue';
import {
  apiAdminSearchPlayers,
  apiAdminGetPlayer,
  apiAdminDeletePlayer,
  apiAdminRevokeSubmission,
} from '../lib/api.js';

const query = ref('');
const players = ref([]);
const selectedPlayer = ref(null);
const playerDetail = ref(null);
const loading = ref(false);

async function search() {
  if (!query.value.trim()) return;
  loading.value = true;
  const res = await apiAdminSearchPlayers(query.value.trim());
  if (res.ok && res.data) {
    players.value = res.data.players;
  }
  loading.value = false;
  selectedPlayer.value = null;
  playerDetail.value = null;
}

async function selectPlayer(p) {
  selectedPlayer.value = p;
  const res = await apiAdminGetPlayer(p.id);
  if (res.ok && res.data) {
    playerDetail.value = res.data;
  }
}

async function deletePlayer(id) {
  if (!confirm('Delete this player and all their data? This cannot be undone.')) return;
  await apiAdminDeletePlayer(id);
  selectedPlayer.value = null;
  playerDetail.value = null;
  await search();
}

async function revokeSubmission(subId) {
  if (!confirm('Revoke this keyword submission?')) return;
  await apiAdminRevokeSubmission(subId);
  // Refresh detail
  if (selectedPlayer.value) {
    await selectPlayer(selectedPlayer.value);
  }
}
</script>

<template>
  <div>
    <h3 class="mb-4 text-base font-extrabold text-primary">👤 Player Management</h3>

    <!-- Search -->
    <div class="mb-5 flex gap-2">
      <input v-model="query" class="field-input max-w-[300px]" placeholder="Search by email or name" @keyup.enter="search" />
      <button class="btn btn-primary btn-sm" :disabled="loading" @click="search">Search</button>
    </div>

    <!-- Results -->
    <div v-if="players.length > 0 && !selectedPlayer" class="glass rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-label-md">
          <thead>
            <tr>
              <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Name</th>
              <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Email</th>
              <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Sessions</th>
              <th class="border-b border-themed px-2 py-1.5 text-left text-primary">Submissions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in players" :key="p.id" class="cursor-pointer hover:bg-primary/8" @click="selectPlayer(p)">
              <td class="border-b border-outline-variant px-2 py-1.5">{{ p.player_name }}</td>
              <td class="border-b border-outline-variant px-2 py-1.5">{{ p.email }}</td>
              <td class="border-b border-outline-variant px-2 py-1.5">{{ p.session_count }}</td>
              <td class="border-b border-outline-variant px-2 py-1.5">{{ p.submission_count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Player Detail -->
    <div v-if="playerDetail" class="glass rounded-xl p-5">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <strong class="text-lg text-on-surface">{{ playerDetail.player.player_name }}</strong>
          <div class="text-label-md text-on-surface-variant">{{ playerDetail.player.email }}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-xs" @click="selectedPlayer = null; playerDetail = null">← Back</button>
          <button class="btn-danger btn-xs px-2 py-1 text-label-sm" @click="deletePlayer(playerDetail.player.id)">Delete Player</button>
        </div>
      </div>

      <!-- Sessions -->
      <h4 class="mb-2 text-label-lg font-bold text-primary">Game Sessions</h4>
      <div v-if="playerDetail.sessions.length === 0" class="mb-4 text-label-md text-on-surface-variant">No sessions</div>
      <div v-else class="mb-4 overflow-x-auto">
        <table class="w-full border-collapse text-label-md">
          <thead>
            <tr>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Pack</th>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Tiles</th>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Lines</th>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Keywords</th>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Last Active</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in playerDetail.sessions" :key="s.id">
              <td class="border-b border-outline-variant px-2 py-1">{{ s.pack_id }}</td>
              <td class="border-b border-outline-variant px-2 py-1">{{ s.tiles_cleared }}/9</td>
              <td class="border-b border-outline-variant px-2 py-1">{{ s.lines_won }}</td>
              <td class="border-b border-outline-variant px-2 py-1">{{ s.keywords_earned }}</td>
              <td class="border-b border-outline-variant px-2 py-1">{{ new Date(s.last_active_at).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Submissions -->
      <h4 class="mb-2 text-label-lg font-bold text-primary">Submissions</h4>
      <div v-if="playerDetail.submissions.length === 0" class="text-label-md text-on-surface-variant">No submissions</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse text-label-md">
          <thead>
            <tr>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Org</th>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Keyword</th>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Submitted</th>
              <th class="border-b border-themed px-2 py-1 text-left text-primary">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in playerDetail.submissions" :key="s.id">
              <td class="border-b border-outline-variant px-2 py-1">{{ s.org }}</td>
              <td class="border-b border-outline-variant px-2 py-1 font-mono text-label-sm">{{ s.keyword }}</td>
              <td class="border-b border-outline-variant px-2 py-1">{{ new Date(s.created_at).toLocaleString() }}</td>
              <td class="border-b border-outline-variant px-2 py-1">
                <button class="text-error hover:underline" @click="revokeSubmission(s.id)">Revoke</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
