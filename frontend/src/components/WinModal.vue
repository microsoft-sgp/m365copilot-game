<script setup>
import { useToast } from '../composables/useToast.js';

const props = defineProps({
  data: {
    type: Object,
    required: true, // { line: { id, label, cells }, kw }
  },
});
const emit = defineEmits(['close']);
const { show: showToast } = useToast();

const colors = [
  '#c084fc',
  '#e879f9',
  '#7c3aed',
  '#a855f7',
  '#f0abfc',
  '#fbbf24',
  '#4ade80',
];
const confetti = Array.from({ length: 40 }, (_, i) => ({
  left: Math.random() * 100,
  background: colors[i % colors.length],
  duration: 0.8 + Math.random() * 1.2,
  delay: Math.random() * 0.4,
}));

function copyKw() {
  navigator.clipboard.writeText(props.data.kw).catch(() => {});
  showToast({ icon: '📋', title: 'Copied!', sub: props.data.kw });
}
</script>

<template>
  <div
    class="fixed inset-0 z-[300] flex items-center justify-center bg-app/90 p-4 backdrop-blur-md"
    @click.self="emit('close')"
  >
    <div
      class="relative w-full max-w-[480px] rounded-3xl border-2 border-neon bg-app-2 p-9 text-center shadow-[0_0_80px_rgba(232,121,249,0.6)]"
    >
      <div
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
      >
        <div
          v-for="(c, i) in confetti"
          :key="i"
          class="confetti-piece"
          :style="{
            left: c.left + '%',
            background: c.background,
            animationDuration: c.duration + 's',
            animationDelay: c.delay + 's',
          }"
        ></div>
      </div>
      <span class="mb-3 block text-[56px]">🎉</span>
      <div class="text-gradient mb-1.5 text-[28px] font-black">
        BINGO! {{ data.line.label }}
      </div>
      <div class="mb-[18px] text-sm text-muted">
        You completed {{ data.line.label }}! Here is your keyword:
      </div>
      <div
        class="mx-auto mb-[18px] inline-block rounded-[10px] border-[1.5px] border-lilac-2 bg-app-3 px-[18px] py-2.5 font-mono text-base font-extrabold tracking-[2px] text-white"
      >
        {{ data.kw }}
      </div>
      <button class="btn btn-ghost btn-sm mb-2.5" @click="copyKw">
        📋 Copy Keyword
      </button>
      <br />
      <button class="btn btn-primary btn-sm" @click="emit('close')">
        Keep Playing →
      </button>
      <p class="mt-3 text-[11px] text-muted">
        ⚠️ Prototype: keyword generated client-side with session nonce. Not
        tamper-proof.
      </p>
    </div>
  </div>
</template>
