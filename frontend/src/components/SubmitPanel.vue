<script setup>
import { ref, computed } from 'vue';
import { useSubmissions } from '../composables/useSubmissions.js';
import { useToast } from '../composables/useToast.js';
import { clearAllGameData } from '../lib/storage.js';
import LeaderboardTable from './LeaderboardTable.vue';

const { detectOrg, submit } = useSubmissions();
const { show: showToast } = useToast();

const org = ref('');
const name = ref('');
const email = ref('');
const kw = ref('');
const result = ref({ kind: '', message: '' });

const detection = computed(() => detectOrg(email.value));
const orgReadOnly = computed(() => !!detection.value.org);

function onEmailInput() {
  if (detection.value.org) {
    org.value = detection.value.org;
  }
}

function onKwInput(e) {
  kw.value = e.target.value.toUpperCase().trim();
}

function onSubmit() {
  const r = submit({
    org: org.value,
    name: name.value,
    email: email.value,
    kw: kw.value,
  });
  result.value = { kind: r.ok ? 'ok' : 'fail', message: r.message };
  if (r.ok) {
    showToast({
      icon: '🎉',
      title: 'Keyword Submitted!',
      sub: `Scored for ${org.value.trim()}`,
    });
  }
}

const adminPhrase = ref('');
function adminClear() {
  if (adminPhrase.value.trim() !== 'RESET-BINGO') {
    alert('Incorrect phrase. Type RESET-BINGO to confirm.');
    return;
  }
  if (
    !confirm(
      'This will delete ALL local data (game state, submissions, profiles). Are you sure?',
    )
  )
    return;
  clearAllGameData();
  location.reload();
}
</script>

<template>
  <div class="mx-auto max-w-[680px]">
    <div class="glass mb-5 rounded-[14px] p-[22px]">
      <h3 class="mb-3.5 text-base font-extrabold text-lilac">
        📬 Submit a Keyword
      </h3>

      <div class="mb-3">
        <label class="field-label">Organization</label>
        <input
          v-model="org"
          class="field-input"
          type="text"
          placeholder="e.g. NUS, SMU, NTU…"
          :readonly="orgReadOnly"
        />
      </div>
      <div class="mb-3">
        <label class="field-label">First Name</label>
        <input
          v-model="name"
          class="field-input"
          type="text"
          placeholder="Your first name"
        />
      </div>
      <div class="mb-3">
        <label class="field-label">Work / School Email</label>
        <input
          v-model="email"
          class="field-input"
          type="email"
          placeholder="you@university.edu.sg"
          @input="onEmailInput"
        />
        <div
          v-if="email && detection.org"
          class="mt-1 text-[11px] text-success"
        >
          ✓ Detected org: {{ detection.org }}
        </div>
        <div
          v-else-if="email && detection.domain && !detection.org"
          class="mt-1 text-[11px] text-success"
        >
          Domain not recognised — please type your organisation.
        </div>
      </div>
      <div class="mb-3">
        <label class="field-label">Keyword</label>
        <input
          :value="kw"
          class="field-input font-mono text-[13px]"
          placeholder="CO-APR26-001-R1-XXXXXXXX or CO-APR26-W1-001-XXXXXXXX"
          @input="onKwInput"
        />
        <div class="mt-1 text-[11px] leading-relaxed text-muted">
          Line keyword:
          <code>CO-{CampaignId}-{PackId}-{LineId}-{Token}</code><br />
          Weekly Clear:
          <code>CO-{CampaignId}-W{weekNo}-{PackId}-{Token}</code><br />
          Uppercase letters, digits, hyphens only.
        </div>
      </div>

      <button class="btn btn-primary" @click="onSubmit">Submit Keyword</button>
      <div
        v-if="result.kind"
        class="verify-result"
        :class="result.kind"
      >
        {{ result.message }}
      </div>
    </div>

    <div class="glass mb-5 rounded-[14px] p-[22px]">
      <div class="mb-3.5 flex items-center justify-between">
        <h3 class="m-0 text-base font-extrabold text-lilac">
          🏆 Organization Leaderboard
        </h3>
      </div>
      <LeaderboardTable />
    </div>

    <div
      class="mt-5 max-w-[480px] rounded-[14px] border border-error/20 bg-error/5 p-[18px]"
    >
      <h4
        class="mb-2.5 text-xs font-bold uppercase tracking-[1px] text-error"
      >
        ⚠️ Admin — Clear Local Data
      </h4>
      <p class="mb-2.5 text-xs text-muted">
        Type <strong>RESET-BINGO</strong> to wipe all local data (game state,
        submissions, profiles). This cannot be undone.
      </p>
      <div class="flex gap-2">
        <input
          v-model="adminPhrase"
          class="field-input max-w-[200px]"
          type="text"
          placeholder="RESET-BINGO"
        />
        <button class="btn-danger" @click="adminClear">Clear All Data</button>
      </div>
    </div>
  </div>
</template>
