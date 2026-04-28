<script setup>
import { useToast } from '../composables/useToast.js';
const { toast, hide } = useToast();
</script>

<template>
  <div v-if="toast.visible" class="fixed bottom-6 left-1/2 z-[500] -translate-x-1/2">
    <div
      class="flex max-w-[480px] items-center gap-3 rounded-2xl border-[1.5px] border-primary bg-gradient-to-br from-primary-container to-surface-container px-[22px] py-3.5 shadow-[0_0_40px_rgba(77,208,225,0.6)]"
    >
      <div class="text-title-lg">{{ toast.icon }}</div>
      <div class="flex-1">
        <div class="mb-0.5 text-sm font-extrabold text-tertiary">
          {{ toast.title }}
        </div>
        <div v-if="toast.sub" class="text-xs text-on-surface-variant">{{ toast.sub }}</div>
        <div
          v-if="toast.kw"
          class="mt-1 inline-block rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-label-lg font-bold text-white"
        >
          {{ toast.kw }}
        </div>
      </div>
      <button
        class="ml-2 cursor-pointer border-none bg-transparent text-base text-on-surface-variant"
        @click="hide"
      >
        ✕
      </button>
    </div>
  </div>
</template>
