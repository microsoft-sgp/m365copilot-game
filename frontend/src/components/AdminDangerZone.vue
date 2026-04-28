<script setup>
import { ref } from 'vue';
import { apiAdminClearCampaignData, apiAdminResetLeaderboard } from '../lib/api.js';

const clearCampaign = ref('APR26');
const clearPhrase = ref('');
const clearResult = ref(null);

const resetCampaign = ref('APR26');
const resetPhrase = ref('');
const resetResult = ref(null);

async function doClear() {
  if (clearPhrase.value.trim() !== 'CLEAR-ALL') {
    alert('Type CLEAR-ALL to confirm.');
    return;
  }
  if (
    !confirm(
      `This will delete ALL sessions, events, and submissions for campaign ${clearCampaign.value}. Are you sure?`,
    )
  )
    return;

  const res = await apiAdminClearCampaignData(clearCampaign.value);
  if (res.ok) {
    clearResult.value = res.data;
    clearPhrase.value = '';
  } else {
    alert(res.data?.message || 'Failed to clear');
  }
}

async function doReset() {
  if (resetPhrase.value.trim() !== 'RESET-BOARD') {
    alert('Type RESET-BOARD to confirm.');
    return;
  }
  if (
    !confirm(`This will delete ALL submissions for campaign ${resetCampaign.value}. Are you sure?`)
  )
    return;

  const res = await apiAdminResetLeaderboard(resetCampaign.value);
  if (res.ok) {
    resetResult.value = res.data;
    resetPhrase.value = '';
  } else {
    alert(res.data?.message || 'Failed to reset');
  }
}
</script>

<template>
  <div>
    <h3 class="mb-4 text-base font-extrabold text-error">
      ⚠️ Danger Zone
    </h3>
    <p class="mb-5 text-label-lg text-on-surface-variant">
      These operations are destructive and cannot be undone. Each requires a confirmation phrase.
    </p>

    <!-- Clear Campaign Data -->
    <div class="mb-5 rounded-[14px] border border-error/20 bg-error/5 p-5">
      <h4 class="mb-2 text-xs font-bold uppercase tracking-[1px] text-error">
        Clear Campaign Data
      </h4>
      <p class="mb-3 text-label-md text-on-surface-variant">
        Deletes all sessions, tile events, and submissions for a campaign. Players and organizations
        are preserved.
      </p>
      <div class="flex flex-wrap gap-2">
        <input
          v-model="clearCampaign"
          class="field-input max-w-[120px]"
          placeholder="Campaign ID"
        >
        <input
          v-model="clearPhrase"
          class="field-input max-w-[150px]"
          placeholder="Type CLEAR-ALL"
        >
        <button
          class="btn-danger px-3 py-1.5 text-label-md"
          @click="doClear"
        >
          Clear All Data
        </button>
      </div>
      <div
        v-if="clearResult"
        class="mt-2 text-label-md text-success"
      >
        ✅ Cleared: {{ clearResult.deleted.sessions }} sessions,
        {{ clearResult.deleted.events }} events, {{ clearResult.deleted.submissions }} submissions
      </div>
    </div>

    <!-- Reset Leaderboard -->
    <div class="rounded-[14px] border border-error/20 bg-error/5 p-5">
      <h4 class="mb-2 text-xs font-bold uppercase tracking-[1px] text-error">
        Reset Leaderboard
      </h4>
      <p class="mb-3 text-label-md text-on-surface-variant">
        Deletes all submissions for a campaign. Sessions and events are preserved.
      </p>
      <div class="flex flex-wrap gap-2">
        <input
          v-model="resetCampaign"
          class="field-input max-w-[120px]"
          placeholder="Campaign ID"
        >
        <input
          v-model="resetPhrase"
          class="field-input max-w-[160px]"
          placeholder="Type RESET-BOARD"
        >
        <button
          class="btn-danger px-3 py-1.5 text-label-md"
          @click="doReset"
        >
          Reset Leaderboard
        </button>
      </div>
      <div
        v-if="resetResult"
        class="mt-2 text-label-md text-success"
      >
        ✅ Deleted: {{ resetResult.deleted.submissions }} submissions
      </div>
    </div>
  </div>
</template>
