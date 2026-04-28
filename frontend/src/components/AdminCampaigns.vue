<script setup>
import { ref, onMounted } from 'vue';
import {
  apiAdminGetCampaigns,
  apiAdminCreateCampaign,
  apiAdminUpdateCampaign,
} from '../lib/api.js';

const campaigns = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const newCampaign = ref({
  id: '',
  displayName: '',
  totalPacks: 999,
  totalWeeks: 7,
  copilotUrl: 'https://m365.cloud.microsoft/chat',
});
const editing = ref(null);

async function loadCampaigns() {
  loading.value = true;
  const res = await apiAdminGetCampaigns();
  if (res.ok && res.data) {
    campaigns.value = res.data.campaigns;
  }
  loading.value = false;
}

onMounted(loadCampaigns);

async function createCampaign() {
  const res = await apiAdminCreateCampaign(newCampaign.value);
  if (res.ok) {
    showCreate.value = false;
    newCampaign.value = {
      id: '',
      displayName: '',
      totalPacks: 999,
      totalWeeks: 7,
      copilotUrl: 'https://m365.cloud.microsoft/chat',
    };
    await loadCampaigns();
  } else {
    alert(res.data?.message || 'Failed to create');
  }
}

function startEdit(c) {
  editing.value = { ...c };
}

async function saveEdit() {
  const c = editing.value;
  await apiAdminUpdateCampaign(c.id, {
    displayName: c.displayName,
    totalPacks: c.totalPacks,
    totalWeeks: c.totalWeeks,
    copilotUrl: c.copilotUrl,
    isActive: c.isActive,
  });
  editing.value = null;
  await loadCampaigns();
}

async function toggleActive(c) {
  await apiAdminUpdateCampaign(c.id, { isActive: !c.isActive });
  await loadCampaigns();
}
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-base font-extrabold text-primary">
        🎮 Campaigns
      </h3>
      <button
        class="btn btn-primary btn-sm"
        @click="showCreate = !showCreate"
      >
        + New Campaign
      </button>
    </div>

    <!-- Create form -->
    <div
      v-if="showCreate"
      class="glass mb-5 rounded-xl p-4"
    >
      <div class="mb-2 grid grid-cols-2 gap-3">
        <div>
          <label class="field-label">Campaign ID</label>
          <input
            v-model="newCampaign.id"
            class="field-input"
            placeholder="e.g. JUL26"
          >
        </div>
        <div>
          <label class="field-label">Display Name</label>
          <input
            v-model="newCampaign.displayName"
            class="field-input"
            placeholder="e.g. July 2026"
          >
        </div>
        <div>
          <label class="field-label">Total Packs</label>
          <input
            v-model.number="newCampaign.totalPacks"
            class="field-input"
            type="number"
          >
        </div>
        <div>
          <label class="field-label">Total Weeks</label>
          <input
            v-model.number="newCampaign.totalWeeks"
            class="field-input"
            type="number"
          >
        </div>
      </div>
      <div class="mb-3">
        <label class="field-label">Copilot URL</label>
        <input
          v-model="newCampaign.copilotUrl"
          class="field-input"
        >
      </div>
      <button
        class="btn btn-primary btn-sm"
        @click="createCampaign"
      >
        Create
      </button>
    </div>

    <div
      v-if="loading"
      class="text-on-surface-variant"
    >
      Loading…
    </div>
    <template v-else>
      <div
        v-for="c in campaigns"
        :key="c.id"
        class="glass mb-3 rounded-xl p-4"
      >
        <!-- Edit mode -->
        <template v-if="editing && editing.id === c.id">
          <div class="mb-2 grid grid-cols-2 gap-3 text-label-lg">
            <div>
              <label class="field-label">Display Name</label>
              <input
                v-model="editing.displayName"
                class="field-input"
              >
            </div>
            <div>
              <label class="field-label">Total Packs</label>
              <input
                v-model.number="editing.totalPacks"
                class="field-input"
                type="number"
              >
            </div>
            <div>
              <label class="field-label">Total Weeks</label>
              <input
                v-model.number="editing.totalWeeks"
                class="field-input"
                type="number"
              >
            </div>
            <div>
              <label class="field-label">Copilot URL</label>
              <input
                v-model="editing.copilotUrl"
                class="field-input"
              >
            </div>
          </div>
          <div class="flex gap-2">
            <button
              class="btn btn-primary btn-xs"
              @click="saveEdit"
            >
              Save
            </button>
            <button
              class="btn btn-ghost btn-xs"
              @click="editing = null"
            >
              Cancel
            </button>
          </div>
        </template>

        <!-- View mode -->
        <template v-else>
          <div class="mb-1 flex items-center justify-between">
            <div>
              <strong class="text-on-surface">{{ c.id }}</strong>
              <span class="ml-2 text-label-md text-on-surface-variant">{{ c.displayName }}</span>
              <span
                v-if="c.isActive"
                class="ml-2 rounded-full bg-success/20 px-2 py-0.5 text-label-sm font-bold text-success"
              >ACTIVE</span>
            </div>
            <div class="flex gap-1">
              <button
                class="btn btn-ghost btn-xs"
                @click="startEdit(c)"
              >
                Edit
              </button>
              <button
                class="btn btn-ghost btn-xs"
                @click="toggleActive(c)"
              >
                {{ c.isActive ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </div>
          <div class="text-label-sm text-on-surface-variant">
            {{ c.stats.totalPlayers }} players · {{ c.stats.totalSessions }} sessions ·
            {{ c.stats.totalSubmissions }} submissions
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
