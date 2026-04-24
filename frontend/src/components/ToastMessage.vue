<script setup>
import { useToast } from '../composables/useToast.js';
const { toast, hide } = useToast();
</script>

<template>
  <div
    v-if="toast.visible"
    class="fixed bottom-6 left-1/2 z-[500] -translate-x-1/2"
  >
    <div
      class="flex max-w-[480px] items-center gap-3 rounded-2xl border-[1.5px] border-lilac-2 bg-gradient-to-br from-lilac-3 to-app-2 px-[22px] py-3.5 shadow-[0_0_40px_rgba(168,85,247,0.6)]"
    >
      <div class="text-[22px]">{{ toast.icon }}</div>
      <div class="flex-1">
        <div class="mb-0.5 text-sm font-extrabold text-neon">
          {{ toast.title }}
        </div>
        <div v-if="toast.sub" class="text-xs text-muted">{{ toast.sub }}</div>
        <div
          v-if="toast.kw"
          class="mt-1 inline-block rounded-md bg-app-3 px-2 py-0.5 font-mono text-[13px] font-bold text-white"
        >
          {{ toast.kw }}
        </div>
      </div>
      <button
        class="ml-2 cursor-pointer border-none bg-transparent text-base text-muted"
        @click="hide"
      >
        ✕
      </button>
    </div>
  </div>
</template>
