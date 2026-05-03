<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { useHealthStatus } from '../composables/useHealthStatus.js';

const { status, start, stop } = useHealthStatus();

const HEALTH_LABELS = {
  unknown: 'Checking…',
  healthy: 'Online',
  degraded: 'Degraded',
  down: 'Offline',
};

const HEALTH_DOT_CLASSES = {
  unknown: 'bg-slate-400',
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
};

const label = computed(() => HEALTH_LABELS[status.value] ?? HEALTH_LABELS.unknown);
const dotClass = computed(() => HEALTH_DOT_CLASSES[status.value] ?? HEALTH_DOT_CLASSES.unknown);

onMounted(() => start());
onUnmounted(() => stop());
</script>

<template>
  <footer class="mt-8 border-t border-outline-variant pb-20 pt-6 text-center sm:pb-8">
    <div
      class="mb-2 flex items-center justify-center gap-2 text-label-sm text-on-surface-variant"
      data-testid="health-status"
      :data-status="status"
    >
      <span class="inline-block h-2 w-2 rounded-full" :class="dotClass" aria-hidden="true" />
      <span>{{ label }}</span>
    </div>
    <div class="text-label-md tracking-[0.5px] text-on-surface-variant">
      Designed by Microsoft Student Ambassadors
    </div>
    <div class="mt-1 text-label-sm text-primary/70">Powered by Microsoft</div>
  </footer>
</template>
