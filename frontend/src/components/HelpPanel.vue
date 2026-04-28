<script setup>
import { COPILOT_URL } from '../data/constants.js';

const emit = defineEmits(['admin']);

const playLoopSections = [
  {
    step: '01',
    title: 'Start',
    points: [
      'Complete onboarding with your email and display name.',
      'Review your assigned pack, then launch your board.',
    ],
  },
  {
    step: '02',
    title: 'Play',
    points: [
      'Click any tile to open the task panel.',
      'Copy the prompt, open Copilot Chat, paste it, and run it.',
    ],
  },
  {
    step: '03',
    title: 'Claim',
    points: [
      'Paste your proof into the text box, then Verify & Claim.',
      'Complete a row, column, or diagonal to earn a keyword.',
    ],
  },
  {
    step: '04',
    title: 'Track progress',
    points: [
      'View score updates and timeline in the My Activity tab.',
      'Find earned codes in the Keys tab.',
    ],
  },
];
</script>

<template>
  <div class="mx-auto max-w-[760px]">
    <div class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="max-w-[460px]">
        <h2 class="text-gradient mb-1 text-title-lg font-black">
          How to Play
        </h2>
        <p class="text-body-md leading-relaxed text-on-surface-variant">
          Complete Copilot Chat tasks on your 3×3 board, verify your answers, and earn keywords when
          you complete a Bingo line.
        </p>
      </div>

      <div class="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[190px]">
        <a
          :href="COPILOT_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary w-full sm:w-auto"
        >
          🌐 Open Copilot Chat ↗
        </a>
        <button
          type="button"
          class="btn btn-ghost w-full sm:w-auto"
          @click="emit('admin')"
        >
          🔐 Admin Login
        </button>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <section
        v-for="section in playLoopSections"
        :key="section.title"
        class="glass rounded-[14px] p-4"
      >
        <div class="mb-2 flex items-center gap-2">
          <span class="font-mono text-label-sm font-black text-tertiary">
            {{ section.step }}
          </span>
          <h3 class="text-title-md font-extrabold text-primary">
            {{ section.title }}
          </h3>
        </div>
        <ul class="space-y-1.5 text-body-md leading-relaxed text-on-surface-variant">
          <li
            v-for="point in section.points"
            :key="point"
            class="flex gap-2"
          >
            <span class="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-tertiary" />
            <span>{{ point }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
