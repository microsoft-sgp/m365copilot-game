<script setup>
import { computed, ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { STORAGE_KEYS } from './data/constants.js';
import { loadString, removeKey, saveString } from './lib/storage.js';
import { isPublicEmailDomain } from './lib/emailDomains.js';
import {
  apiAdminLogout,
  apiAdminRefresh,
  apiCreateSession,
  apiGetPlayerState,
  installAdminSessionInvalidHandler,
  installPlayerAuthRefresher,
  isPlayerRecoveryRequiredResponse,
} from './lib/api.js';
import {
  ADMIN_SESSION_CONFIRMATION_MESSAGE,
  clearAdminSessionHint,
  hasAdminSessionHint,
  setAdminSessionHint,
} from './lib/adminSession.js';
import { clearPlayerToken } from './lib/playerToken.js';
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

const { hydrateFromServer, setIdentity, setRecoveryRequired } = useBingoGame();

const activeTab = ref('game');
const playerEmail = ref(loadString(STORAGE_KEYS.email));
const playerName = ref(loadString(STORAGE_KEYS.playerName));
const playerOrganization = ref(loadString(STORAGE_KEYS.organization));
const view = ref('game'); // 'game' | 'admin-login' | 'admin'
const adminSessionMessage = ref('');
const identityReady = computed(() => {
  if (!playerEmail.value || !playerName.value) return false;
  return !isPublicEmailDomain(playerEmail.value) || !!playerOrganization.value;
});

onMounted(() => {
  // Check hash-based routing for admin
  void checkRoute();
  window.addEventListener('hashchange', routeHandler);

  installAdminSessionInvalidHandler(onAdminSessionInvalid);

  // Wire the api layer's 401-recovery hook so any game endpoint that returns
  // 401 (stale token, admin reset, etc.) silently re-bootstraps the player
  // session before retrying. The refresher reads the latest identity from
  // localStorage so it works after onEmailContinue updates it.
  installPlayerAuthRefresher(async () => {
    const email = playerEmail.value || loadString(STORAGE_KEYS.email);
    const name = playerName.value || loadString(STORAGE_KEYS.playerName);
    if (!email || !name) return false;
    const sessionId = loadString(STORAGE_KEYS.state) || `recover-${Date.now()}`;
    const res = await apiCreateSession({
      sessionId,
      playerName: name,
      email,
      organization: playerOrganization.value || loadString(STORAGE_KEYS.organization) || undefined,
    });
    if (isPlayerRecoveryRequiredResponse(res)) {
      setRecoveryRequired(email, 'Recover this player identity to continue.');
      return false;
    }
    return Boolean(res.ok);
  });

  if (identityReady.value) {
    syncPlayerState(playerEmail.value);
  }
});

onUnmounted(() => {
  installPlayerAuthRefresher(null);
  installAdminSessionInvalidHandler(null);
  window.removeEventListener('hashchange', routeHandler);
});

function routeHandler() {
  void checkRoute();
}

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

async function checkRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#/admin/login')) {
    view.value = 'admin-login';
  } else if (hash.startsWith('#/admin')) {
    if (hasAdminSessionHint()) {
      view.value = 'admin';
      return;
    }

    const refresh = await apiAdminRefresh();
    if (refresh.ok) {
      setAdminSessionHint();
      adminSessionMessage.value = '';
      view.value = 'admin';
    } else {
      clearAdminSessionHint();
      view.value = 'admin-login';
    }
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
  adminSessionMessage.value = '';
  window.location.hash = '#/admin/login';
  view.value = 'admin-login';
}

function onAdminLoggedIn(email) {
  setAdminSessionHint(email);
  adminSessionMessage.value = '';
  window.location.hash = '#/admin';
  view.value = 'admin';
}

function onAdminSessionInvalid() {
  clearAdminSessionHint();
  adminSessionMessage.value = ADMIN_SESSION_CONFIRMATION_MESSAGE;
  if (window.location.hash !== '#/admin/login') {
    window.location.hash = '#/admin/login';
  }
  view.value = 'admin-login';
}

async function onAdminLogout() {
  await apiAdminLogout();
  clearAdminSessionHint();
  adminSessionMessage.value = '';
  // Admin and player tokens are independent, but clearing the player token on
  // admin logout is a safe default for shared devices: it forces the next
  // game-API call to re-bootstrap a session with whatever identity the next
  // user enters.
  clearPlayerToken();
  window.location.hash = '';
  view.value = 'game';
}

function onBackToGame() {
  adminSessionMessage.value = '';
  window.location.hash = '';
  view.value = 'game';
}
</script>

<template>
  <div class="relative z-[1]">
    <!-- Admin views -->
    <template v-if="view === 'admin-login'">
      <AdminLogin
        :session-message="adminSessionMessage"
        @authenticated="onAdminLoggedIn"
        @back="onBackToGame"
      />
    </template>
    <template v-else-if="view === 'admin'">
      <AdminLayout @logout="onAdminLogout" />
    </template>

    <!-- Game views -->
    <template v-else>
      <!-- Email gate -->
      <template v-if="!identityReady">
        <EmailGate
          @continue="onEmailContinue"
          @admin="onAdminNav"
        />
        <GameFooter />
      </template>

      <!-- Main game -->
      <template v-else>
        <TopBar />
        <AppTabs v-model="activeTab" />

        <section
          v-show="activeTab === 'game'"
          class="px-5 py-5 pb-20 sm:pb-5"
        >
          <GameTab />
        </section>
        <section
          v-show="activeTab === 'keywords'"
          class="px-5 py-5 pb-20 sm:pb-5"
        >
          <KeywordsPanel />
        </section>
        <section
          v-show="activeTab === 'activity'"
          class="px-5 py-5 pb-20 sm:pb-5"
        >
          <MyActivityPanel />
        </section>
        <section
          v-show="activeTab === 'help'"
          class="px-5 py-5 pb-20 sm:pb-5"
        >
          <HelpPanel @admin="onAdminNav" />
        </section>
        <GameFooter />
      </template>
    </template>

    <ToastMessage />
  </div>
</template>
