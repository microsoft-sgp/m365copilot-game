<script setup>
import { ref } from 'vue';
import TopBar from './components/TopBar.vue';
import AppTabs from './components/AppTabs.vue';
import GameTab from './components/GameTab.vue';
import KeywordsPanel from './components/KeywordsPanel.vue';
import SubmitPanel from './components/SubmitPanel.vue';
import HelpPanel from './components/HelpPanel.vue';
import ToastMessage from './components/ToastMessage.vue';

const activeTab = ref('game');
</script>

<template>
  <div class="relative z-[1]">
    <TopBar />
    <AppTabs v-model="activeTab" />

    <section v-show="activeTab === 'game'" class="px-5 py-5">
      <GameTab />
    </section>
    <section v-show="activeTab === 'keywords'" class="px-5 py-5">
      <KeywordsPanel />
    </section>
    <section v-show="activeTab === 'submit'" class="px-5 py-5">
      <SubmitPanel />
    </section>
    <section v-show="activeTab === 'help'" class="px-5 py-5">
      <HelpPanel />
    </section>

    <ToastMessage />
  </div>
</template>
