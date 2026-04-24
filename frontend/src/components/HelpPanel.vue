<script setup>
import { COPILOT_URL } from '../data/constants.js';
</script>

<template>
  <div class="mx-auto max-w-[640px]">
    <div class="glass rounded-[14px] p-6">
      <h2 class="text-gradient mb-1 text-title-lg font-black">How to Play</h2>
      <p class="mb-3.5 text-sm text-on-surface-variant">
        Complete Copilot Chat tasks on your 3×3 board, verify your answers, and
        earn keywords when you complete a Bingo line.
      </p>
      <ol
        class="list-decimal pl-[18px] text-body-md leading-loose text-on-surface-variant"
      >
        <li>Pick a pack (1–999) and enter your name → Launch your board.</li>
        <li>Click any tile to open the task panel.</li>
        <li>Copy the prompt → Open Copilot Chat → Paste and run it.</li>
        <li>Paste your proof into the text box → Verify &amp; Claim.</li>
        <li>Complete a row, column, or diagonal → earn a keyword!</li>
        <li>Submit keywords on the Submit tab to score for your org.</li>
      </ol>
      <div class="mt-4">
        <a
          :href="COPILOT_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-ghost btn-sm"
        >
          🌐 Open Copilot Chat ↗
        </a>
      </div>
    </div>
  </div>
</template>
