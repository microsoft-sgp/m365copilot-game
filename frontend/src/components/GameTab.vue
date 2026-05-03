<script setup>
import { ref } from 'vue';
import { useBingoGame } from '../composables/useBingoGame.js';
import SetupPanel from './SetupPanel.vue';
import BoardPanel from './BoardPanel.vue';
import TileModal from './TileModal.vue';
import WinModal from './WinModal.vue';

const { state } = useBingoGame();
const activeTileIdx = ref(null);
const winData = ref(null);

function openTile(idx) {
  activeTileIdx.value = idx;
}
function closeTile() {
  activeTileIdx.value = null;
}
function showWin(payload) {
  winData.value = payload;
}
function closeWin() {
  winData.value = null;
}
</script>

<template>
  <SetupPanel v-if="!state.boardActive" />
  <BoardPanel v-else @open-tile="openTile" />

  <TileModal
    v-if="activeTileIdx !== null"
    :tile-index="activeTileIdx"
    @close="closeTile"
    @won="showWin"
  />

  <WinModal v-if="winData" :data="winData" @close="closeWin" />
</template>
