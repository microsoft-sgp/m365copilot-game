<script setup>
import { COPILOT_URL } from '../data/constants.js';
</script>

<template>
  <div class="mx-auto max-w-[640px]">
    <div class="glass rounded-[14px] p-6">
      <h2 class="text-gradient mb-1 text-[22px] font-black">How to Play</h2>
      <p class="mb-3.5 text-sm text-muted">
        Complete Copilot Chat tasks on your 3×3 board, verify your answers, and
        earn keywords when you complete a Bingo line.
      </p>
      <ol
        class="list-decimal pl-[18px] text-[13px] leading-loose text-muted"
      >
        <li>Pick a pack (1–999) and enter your name → Launch your board.</li>
        <li>Click any tile to open the task panel.</li>
        <li>Copy the prompt → Open Copilot Chat → Paste and run it.</li>
        <li>Paste your proof into the text box → Verify &amp; Claim.</li>
        <li>Complete a row, column, or diagonal → earn a keyword!</li>
        <li>Submit keywords on the Submit tab to score for your org.</li>
      </ol>
      <div class="hint-warn mt-3.5">
        <strong>⚠️ Browser Security Note:</strong> Due to standard browser
        security restrictions, this game <em>cannot</em> automatically fill or
        send your prompt into Copilot Chat (m365.cloud.microsoft/chat) via URL
        parameters. The supported flow is:
        <strong>(1) Copy prompt to clipboard → (2) Open Copilot Chat → (3)
        Paste manually</strong>. This is by design.
      </div>
      <div class="hint-soft mt-2.5">
        <strong>🔒 Keyword Security Note (Prototype):</strong> Keywords are
        generated client-side using a session nonce for per-user uniqueness.
        This is a prototype and is <em>not tamper-proof</em>. In production,
        keywords should be generated and validated server-side (e.g., Azure
        Functions) against a registry, and client-side storage should not be
        trusted.
      </div>
      <div class="mt-4">
        <div
          class="my-5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[2px] text-muted"
        >
          Copilot Chat URL
          <span class="h-px flex-1 bg-[rgba(192,132,252,0.25)]"></span>
        </div>
        <p class="text-xs text-muted">
          Default: <code class="text-lilac">{{ COPILOT_URL }}</code
          ><br />This is configured in one place in the source (COPILOT_URL
          constant). Update it if your org uses a different entry point.
        </p>
      </div>
    </div>
  </div>
</template>
