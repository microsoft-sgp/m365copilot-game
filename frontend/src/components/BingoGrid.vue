<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';

const emit = defineEmits(['open-tile']);
const { state } = useBingoGame();
</script>

<template>
  <div class="mb-[18px] grid grid-cols-3 gap-2 sm:gap-3">
    <div
      v-for="(t, i) in state.tiles"
      :key="i"
      class="tile"
      :class="{ cleared: state.cleared[i] }"
      @click="emit('open-tile', i)"
    >
      <div class="text-label-sm font-extrabold uppercase tracking-[0.5px] text-primary">
        Task {{ i + 1 }}
      </div>
      <div class="text-body-md font-bold leading-snug text-on-surface">
        {{ t.title }}
      </div>
      <div class="mt-auto text-label-sm text-on-surface-variant">
        {{ t.tag }}
      </div>
    </div>
  </div>
</template>
