<script setup>
import { computed, ref, onMounted, defineAsyncComponent } from 'vue';
import { STORAGE_KEYS } from './data/constants.js';
import { loadString, removeKey, saveString } from './lib/storage.js';
import { isPublicEmailDomain } from './lib/emailDomains.js';
import { apiGetPlayerState } from './lib/api.js';
import { useBingoGame } from './composables/useBingoGame.js';
import TopBar from './components/TopBar.vue';
import AppTabs from './components/AppTabs.vue';
import GameTab from './components/GameTab.vue';
import KeywordsPanel from './components/KeywordsPanel.vue';
import MyActivityPanel from './components/MyActivityPanel.vue';
import HelpPanel from './components/HelpPanel.vue';
import EmailGate from './components/EmailGate.vue';
import ToastMessage from './components/ToastMessage.vue';
import GameFooter from './components/GameFooter.vue';

// Lazy-load admin views
const AdminLogin = defineAsyncComponent(() => import('./components/AdminLogin.vue'));
const AdminLayout = defineAsyncComponent(() => import('./components/AdminLayout.vue'));

const { hydrateFromServer, setIdentity } = useBingoGame();

const activeTab = ref('game');
const playerEmail = ref(loadString(STORAGE_KEYS.email));
const playerName = ref(loadString(STORAGE_KEYS.playerName));
const playerOrganization = ref(loadString(STORAGE_KEYS.organization));
const view = ref('game'); // 'game' | 'admin-login' | 'admin'
const identityReady = computed(() => {
  if (!playerEmail.value || !playerName.value) return false;
  return !isPublicEmailDomain(playerEmail.value) || !!playerOrganization.value;
});

onMounted(() => {
  // Check hash-based routing for admin
  checkRoute();
  window.addEventListener('hashchange', checkRoute);

  if (identityReady.value) {
    syncPlayerState(playerEmail.value);
  }
});

async function syncPlayerState(email) {
  try {
    const res = await apiGetPlayerState(email);
    if (res.ok && res.data && res.data.player) {
      hydrateFromServer(res.data.player);
    }
  } catch {
    // API unavailable — continue with local state
  }
}

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

async function onEmailContinue(identity) {
  playerEmail.value = identity.email;
  playerName.value = identity.name;
  playerOrganization.value = identity.organization || '';
  saveString(STORAGE_KEYS.email, identity.email);
  saveString(STORAGE_KEYS.playerName, identity.name);
  if (identity.organization) {
    saveString(STORAGE_KEYS.organization, identity.organization);
  } else {
    removeKey(STORAGE_KEYS.organization);
  }
  setIdentity(identity);

  await syncPlayerState(identity.email);
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
      <template v-if="!identityReady">
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
        <section v-show="activeTab === 'activity'" class="px-5 py-5 pb-20 sm:pb-5">
          <MyActivityPanel />
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
