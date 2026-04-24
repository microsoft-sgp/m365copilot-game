<script setup>
import { ref, computed } from 'vue';
import { COPILOT_URL } from '../data/constants.js';
import { buildPromptFull } from '../lib/verification.js';
import { useBingoGame } from '../composables/useBingoGame.js';
import { useToast } from '../composables/useToast.js';

const props = defineProps({ tileIndex: { type: Number, required: true } });
const emit = defineEmits(['close', 'won']);

const { state, verifyTile } = useBingoGame();
const { show: showToast } = useToast();

const tile = computed(() => state.tiles[props.tileIndex]);
const promptText = computed(() =>
  tile.value ? buildPromptFull(tile.value.prompt, state.packId, props.tileIndex) : '',
);

const proof = ref('');
const result = ref({ kind: '', messages: [] });
const copied = ref(false);
const verifying = ref(false);

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(promptText.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2500);
  } catch {
    alert('Copy failed — please select and copy the prompt manually.');
  }
}

function openCopilot() {
  window.open(COPILOT_URL, '_blank', 'noopener,noreferrer');
}

function verify() {
  if (verifying.value) return;

  const text = proof.value.trim();
  if (!text) {
    result.value = {
      kind: 'fail',
      messages: ['Please paste your Copilot output first.'],
    };
    return;
  }

  verifying.value = true;
  const res = verifyTile(props.tileIndex, text);
  verifying.value = false;

  if (!res.ok) {
    result.value = { kind: 'fail', messages: res.errors };
    return;
  }
  result.value = { kind: 'ok', messages: ['Verified!'] };
  showToast({
    icon: '✅',
    title: 'Tile Cleared!',
    sub: `"${tile.value.title}" verified!`,
  });

  // Consolidated multi-line win feedback
  const lines = res.linesWon || (res.lineWon ? [res.lineWon] : []);
  if (lines.length > 1) {
    showToast({
      icon: '🎉',
      title: `${lines.length} Lines Completed!`,
      sub: `${lines.length} keywords earned!`,
    });
  }

  if (res.weeklyKw) {
    showToast({
      icon: '🗓️',
      title: 'Weekly Clear!',
      sub: res.weeklyKw,
      kw: res.weeklyKw,
    });
  }
  if (lines.length > 0) {
    emit('won', lines.length === 1 ? lines[0] : lines[lines.length - 1]);
  }
  emit('close');
}
</script>

<template>
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center bg-app/85 p-4 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="relative h-full w-full overflow-y-auto border-lilac-2 bg-app-2 p-4 shadow-[0_0_60px_rgba(168,85,247,0.5)] sm:max-h-[90vh] sm:max-w-[600px] sm:rounded-[20px] sm:border-[1.5px] sm:p-7"
    >
      <button
        class="absolute right-3 top-3 z-10 cursor-pointer border-none bg-transparent text-2xl text-muted hover:text-neon sm:right-3.5 sm:top-3.5 sm:text-xl"
        @click="emit('close')"
      >
        ✕
      </button>

      <div
        class="mb-1.5 text-[11px] font-bold uppercase tracking-[2px] text-lilac"
      >
        Task {{ tileIndex + 1 }} · {{ tile?.tag }}
      </div>
      <div class="text-gradient mb-3 text-xl font-black">
        {{ tile?.title }}
      </div>

      <pre
        class="mb-3 whitespace-pre-wrap rounded-[10px] border border-themed bg-app-3 p-3.5 text-[13px] leading-relaxed text-text"
        >{{ promptText }}</pre
      >

      <div
        class="mb-3.5 rounded-xl border border-lilac-3 bg-gradient-to-br from-lilac-3/20 to-lilac-2/10 p-3.5"
      >
        <h4
          class="mb-2 text-xs font-bold uppercase tracking-[1px] text-lilac"
        >
          🚀 Launch Copilot Chat
        </h4>
        <div class="flex flex-col gap-2">
          <div class="flex items-start gap-2.5 text-[13px]">
            <div
              class="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-lilac-3 text-[11px] font-extrabold text-white"
            >
              1
            </div>
            <div>
              <strong>Copy the prompt above</strong> to your clipboard.<br />
              <button class="btn btn-primary btn-sm mt-1.5" @click="copyPrompt">
                📋 Copy Prompt
              </button>
              <span v-if="copied" class="ml-2 text-[11px] text-success"
                >✓ Copied!</span
              >
            </div>
          </div>
          <div class="flex items-start gap-2.5 text-[13px]">
            <div
              class="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-lilac-3 text-[11px] font-extrabold text-white"
            >
              2
            </div>
            <div>
              <strong>Open Copilot Chat</strong> and paste your prompt.<br />
              <button
                class="btn btn-ghost btn-sm mt-1.5"
                style="border-color: var(--color-lilac-2); color: var(--color-lilac)"
                @click="openCopilot"
              >
                🌐 Open Copilot Chat ↗
              </button>
            </div>
          </div>
        </div>
        <div class="hint-warn mt-2">
          💡 Prompt copied — paste into Copilot Chat and run it, then paste
          your output below as proof.
        </div>
      </div>

      <div>
        <label class="field-label mt-3"
          >Your Proof (paste Copilot output here)</label
        >
        <textarea
          v-model="proof"
          class="field-textarea"
          placeholder="Paste the full Copilot response here…"
        ></textarea>
        <button
          class="btn btn-primary mt-2.5 w-full"
          :disabled="verifying"
          @click="verify"
        >
          {{ verifying ? '⏳ Verifying…' : '✅ Verify & Claim' }}
        </button>
        <div
          v-if="result.kind"
          class="verify-result"
          :class="result.kind"
          v-html="
            result.kind === 'ok'
              ? '✅ Verified!'
              : result.messages.map((m) => `❌ ${m}`).join('<br/>')
          "
        ></div>
      </div>
    </div>
  </div>
</template>
