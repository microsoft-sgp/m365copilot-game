<script setup>
import { ref, defineAsyncComponent } from 'vue';

const emit = defineEmits(['logout']);

const AdminDashboard = defineAsyncComponent(() => import('./AdminDashboard.vue'));
const AdminOrganizations = defineAsyncComponent(() => import('./AdminOrganizations.vue'));
const AdminCampaigns = defineAsyncComponent(() => import('./AdminCampaigns.vue'));
const AdminPlayers = defineAsyncComponent(() => import('./AdminPlayers.vue'));
const AdminDangerZone = defineAsyncComponent(() => import('./AdminDangerZone.vue'));

const activeView = ref('dashboard');

const navItems = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'organizations', label: '🏢 Organizations' },
  { id: 'campaigns', label: '🎮 Campaigns' },
  { id: 'players', label: '👤 Players' },
  { id: 'danger', label: '⚠️ Danger Zone' },
];
</script>

<template>
  <div class="mx-auto max-w-[960px] px-5 py-5">
    <!-- Header -->
    <div class="mb-5 flex items-center justify-between">
      <h1 class="text-gradient text-title-lg font-black">🔐 Admin Portal</h1>
      <button class="btn btn-ghost btn-sm" @click="emit('logout')">
        Logout
      </button>
    </div>

    <!-- Tab Navigation -->
    <nav class="mb-5 flex gap-1 overflow-x-auto">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="tab-btn whitespace-nowrap"
        :class="{ active: activeView === item.id }"
        @click="activeView = item.id"
      >
        {{ item.label }}
      </button>
    </nav>

    <!-- Content -->
    <AdminDashboard v-if="activeView === 'dashboard'" />
    <AdminOrganizations v-else-if="activeView === 'organizations'" />
    <AdminCampaigns v-else-if="activeView === 'campaigns'" />
    <AdminPlayers v-else-if="activeView === 'players'" />
    <AdminDangerZone v-else-if="activeView === 'danger'" />
  </div>
</template>
