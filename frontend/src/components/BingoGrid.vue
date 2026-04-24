<script setup>
import { useBingoGame } from '../composables/useBingoGame.js';

const emit = defineEmits(['open-tile']);
const { state } = useBingoGame();
</script>

<template>
  <div class="mb-[18px] grid grid-cols-2 gap-3 sm:grid-cols-3">
    <div
      v-for="(t, i) in state.tiles"
      :key="i"
      class="tile"
      :class="{
        cleared: state.cleared[i],
        'col-span-2 justify-self-center sm:col-span-1 sm:justify-self-auto': i === 8,
      }"
      @click="emit('open-tile', i)"
    >
      <div
        class="text-[10px] font-extrabold uppercase tracking-[0.5px] text-lilac"
      >
        Task {{ i + 1 }}
      </div>
      <div class="text-[14px] font-bold leading-snug text-text">
        {{ t.title }}
      </div>
      <div class="mt-auto text-[10px] text-muted">{{ t.tag }}</div>
    </div>
  </div>
</template>
