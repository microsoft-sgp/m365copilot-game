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
  const text = proof.value.trim();
  if (!text) {
    result.value = {
      kind: 'fail',
      messages: ['Please paste your Copilot output first.'],
    };
    return;
  }
  const res = verifyTile(props.tileIndex, text);
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
  if (res.weeklyKw) {
    showToast({
      icon: '🗓️',
      title: 'Weekly Clear!',
      sub: res.weeklyKw,
      kw: res.weeklyKw,
    });
  }
  if (res.lineWon) {
    emit('won', res.lineWon);
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
      class="relative max-h-[90vh] w-full max-w-[600px] overflow-y-auto rounded-[20px] border-[1.5px] border-lilac-2 bg-app-2 p-7 shadow-[0_0_60px_rgba(168,85,247,0.5)]"
    >
      <button
        class="absolute right-3.5 top-3.5 cursor-pointer border-none bg-transparent text-xl text-muted hover:text-neon"
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
          @click="verify"
        >
          ✅ Verify &amp; Claim
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
