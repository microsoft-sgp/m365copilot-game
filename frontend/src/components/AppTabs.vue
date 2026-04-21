<script setup>
const props = defineProps({ modelValue: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);

const tabs = [
  { id: 'game', label: '🎮 Game Board' },
  { id: 'keywords', label: '🔑 My Keywords' },
  { id: 'submit', label: '📬 Submit & Leaderboard' },
  { id: 'help', label: '❓ Help' },
];
</script>

<template>
  <nav class="flex gap-1 px-5 pt-4">
    <button
      v-for="t in tabs"
      :key="t.id"
      class="tab-btn"
      :class="{ active: props.modelValue === t.id }"
      @click="emit('update:modelValue', t.id)"
    >
      {{ t.label }}
    </button>
  </nav>
</template>
