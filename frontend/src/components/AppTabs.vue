<script setup>
const props = defineProps({ modelValue: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);

const tabs = [
  { id: 'game', icon: '🎮', label: 'Game' },
  { id: 'keywords', icon: '🔑', label: 'Keys' },
  { id: 'submit', icon: '📬', label: 'Submit' },
  { id: 'help', icon: '❓', label: 'Help' },
];
</script>

<template>
  <!-- Desktop: top tabs -->
  <nav class="hidden gap-1 px-5 pt-4 sm:flex">
    <button
      v-for="t in tabs"
      :key="t.id"
      class="tab-btn"
      :class="{ active: props.modelValue === t.id }"
      @click="emit('update:modelValue', t.id)"
    >
      {{ t.icon }} {{ t.label }}
    </button>
  </nav>

  <!-- Mobile: bottom navigation bar -->
  <nav
    class="fixed bottom-0 left-0 right-0 z-[100] flex border-t border-themed bg-app-2/95 backdrop-blur-md sm:hidden"
  >
    <button
      v-for="t in tabs"
      :key="t.id"
      class="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent text-muted transition-colors"
      :class="{ '!text-neon': props.modelValue === t.id }"
      @click="emit('update:modelValue', t.id)"
    >
      <span class="text-[18px]">{{ t.icon }}</span>
      <span class="text-[10px] font-semibold uppercase tracking-[0.5px]">{{ t.label }}</span>
    </button>
  </nav>
</template>
