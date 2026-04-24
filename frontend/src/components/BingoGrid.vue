<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';

const emit = defineEmits(['open-tile']);
const { state } = useBingoGame();
</script>

<template>
  <div class="mb-[18px] grid grid-cols-3 gap-3">
    <div
      v-for="(t, i) in state.tiles"
      :key="i"
      class="tile"
      :class="{ cleared: state.cleared[i] }"
      @click="emit('open-tile', i)"
    >
      <div
        class="text-[10px] font-extrabold uppercase tracking-[1px] text-lilac"
      >
        Task {{ i + 1 }}
      </div>
      <div class="text-[13px] font-bold leading-snug text-text">
        {{ t.title }}
      </div>
      <div class="mt-auto text-[10px] text-muted">{{ t.tag }}</div>
    </div>
  </div>
</template>
