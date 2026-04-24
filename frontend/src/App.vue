<script setup>
import { ref, onMounted, defineAsyncComponent } from 'vue';
import { STORAGE_KEYS } from './data/constants.js';
import { loadString, saveString } from './lib/storage.js';
import { apiGetPlayerState } from './lib/api.js';
import { useBingoGame } from './composables/useBingoGame.js';
import TopBar from './components/TopBar.vue';
import AppTabs from './components/AppTabs.vue';
import GameTab from './components/GameTab.vue';
import KeywordsPanel from './components/KeywordsPanel.vue';
import SubmitPanel from './components/SubmitPanel.vue';
import HelpPanel from './components/HelpPanel.vue';
import EmailGate from './components/EmailGate.vue';
import ToastMessage from './components/ToastMessage.vue';
import GameFooter from './components/GameFooter.vue';

// Lazy-load admin views
const AdminLogin = defineAsyncComponent(() => import('./components/AdminLogin.vue'));
const AdminLayout = defineAsyncComponent(() => import('./components/AdminLayout.vue'));

const { hydrateFromServer, setEmail } = useBingoGame();

const activeTab = ref('game');
const playerEmail = ref(loadString(STORAGE_KEYS.email));
const view = ref('game'); // 'game' | 'admin-login' | 'admin'

onMounted(() => {
  // Check hash-based routing for admin
  checkRoute();
  window.addEventListener('hashchange', checkRoute);
});

function checkRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#/admin/login')) {
    view.value = 'admin-login';
  } else if (hash.startsWith('#/admin')) {
    const token = sessionStorage.getItem('admin_token');
    view.value = token ? 'admin' : 'admin-login';
  } else {
    view.value = 'game';
  }
}

async function onEmailContinue(email) {
  playerEmail.value = email;
  saveString(STORAGE_KEYS.email, email);
  setEmail(email);

  // Try to fetch existing progress from server
  try {
    const res = await apiGetPlayerState(email);
    if (res.ok && res.data && res.data.player) {
      hydrateFromServer(res.data.player);
    }
  } catch {
    // API unavailable — continue with local state
  }
}

function onAdminNav() {
  window.location.hash = '#/admin/login';
  view.value = 'admin-login';
}

function onAdminLoggedIn() {
  window.location.hash = '#/admin';
  view.value = 'admin';
}

function onAdminLogout() {
  sessionStorage.removeItem('admin_token');
  window.location.hash = '';
  view.value = 'game';
}

function onBackToGame() {
  window.location.hash = '';
  view.value = 'game';
}
</script>

<template>
  <div class="relative z-[1]">
    <!-- Admin views -->
    <template v-if="view === 'admin-login'">
      <AdminLogin @authenticated="onAdminLoggedIn" @back="onBackToGame" />
    </template>
    <template v-else-if="view === 'admin'">
      <AdminLayout @logout="onAdminLogout" />
    </template>

    <!-- Game views -->
    <template v-else>
      <!-- Email gate -->
      <template v-if="!playerEmail">
        <EmailGate @continue="onEmailContinue" @admin="onAdminNav" />
        <GameFooter />
      </template>

      <!-- Main game -->
      <template v-else>
        <TopBar />
        <AppTabs v-model="activeTab" />

        <section v-show="activeTab === 'game'" class="px-5 py-5 pb-20 sm:pb-5">
          <GameTab />
        </section>
        <section v-show="activeTab === 'keywords'" class="px-5 py-5 pb-20 sm:pb-5">
          <KeywordsPanel />
        </section>
        <section v-show="activeTab === 'submit'" class="px-5 py-5 pb-20 sm:pb-5">
          <SubmitPanel />
        </section>
        <section v-show="activeTab === 'help'" class="px-5 py-5 pb-20 sm:pb-5">
          <HelpPanel />
        </section>
        <GameFooter />
      </template>
    </template>

    <ToastMessage />
  </div>
</template>
