<script setup>
import { ref, onMounted } from 'vue';
import {
  apiAdminGetOrganizations,
  apiAdminCreateOrganization,
  apiAdminUpdateOrganization,
  apiAdminDeleteOrganization,
  apiAdminAddDomain,
  apiAdminRemoveDomain,
} from '../lib/api.js';

const orgs = ref([]);
const loading = ref(true);
const newOrgName = ref('');
const newDomain = ref({});
const editingOrg = ref(null);
const editName = ref('');
const error = ref('');

async function loadOrgs() {
  loading.value = true;
  const res = await apiAdminGetOrganizations();
  if (res.ok && res.data) {
    orgs.value = res.data.organizations;
  }
  loading.value = false;
}

onMounted(loadOrgs);

async function createOrg() {
  if (!newOrgName.value.trim()) return;
  error.value = '';
  const res = await apiAdminCreateOrganization(newOrgName.value.trim());
  if (res.ok) {
    newOrgName.value = '';
    await loadOrgs();
  } else {
    error.value = res.data?.message || 'Failed to create';
  }
}

async function saveEdit(id) {
  if (!editName.value.trim()) return;
  await apiAdminUpdateOrganization(id, editName.value.trim());
  editingOrg.value = null;
  await loadOrgs();
}

async function deleteOrg(id) {
  if (!confirm('Delete this organization?')) return;
  const res = await apiAdminDeleteOrganization(id);
  if (!res.ok) {
    alert(res.data?.message || 'Cannot delete');
  }
  await loadOrgs();
}

async function addDomain(orgId) {
  const domain = (newDomain.value[orgId] || '').trim().toLowerCase();
  if (!domain) return;
  const res = await apiAdminAddDomain(orgId, domain);
  if (res.ok) {
    newDomain.value[orgId] = '';
    await loadOrgs();
  } else {
    alert(res.data?.message || 'Failed to add domain');
  }
}

async function removeDomain(orgId, domainId) {
  await apiAdminRemoveDomain(orgId, domainId);
  await loadOrgs();
}

function startEdit(org) {
  editingOrg.value = org.id;
  editName.value = org.name;
}
</script>

<template>
  <div>
    <h3 class="mb-4 text-base font-extrabold text-primary">🏢 Organizations</h3>

    <div v-if="loading" class="text-on-surface-variant">Loading…</div>
    <template v-else>
      <!-- Add new org -->
      <div class="mb-5 flex gap-2">
        <input
          v-model="newOrgName"
          class="field-input max-w-[250px]"
          placeholder="New organization name"
          @keyup.enter="createOrg"
        />
        <button class="btn btn-primary btn-sm" @click="createOrg">+ Add</button>
      </div>
      <div v-if="error" class="mb-3 text-label-md text-error">
        {{ error }}
      </div>

      <!-- Org list -->
      <div v-for="org in orgs" :key="org.id" class="glass mb-3 rounded-xl p-4">
        <div class="mb-2 flex items-center justify-between">
          <template v-if="editingOrg === org.id">
            <input
              v-model="editName"
              class="field-input max-w-[200px]"
              @keyup.enter="saveEdit(org.id)"
            />
            <div class="flex gap-1">
              <button class="btn btn-primary btn-xs" @click="saveEdit(org.id)">Save</button>
              <button class="btn btn-ghost btn-xs" @click="editingOrg = null">Cancel</button>
            </div>
          </template>
          <template v-else>
            <strong class="text-on-surface">{{ org.name }}</strong>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-xs" @click="startEdit(org)">Edit</button>
              <button class="btn-danger btn-xs px-2 py-1 text-label-sm" @click="deleteOrg(org.id)">
                Delete
              </button>
            </div>
          </template>
        </div>

        <!-- Domains -->
        <div class="ml-2 text-label-md text-on-surface-variant">
          <div v-for="d in org.domains" :key="d.id" class="mb-1 flex items-center gap-2">
            <code class="text-primary">{{ d.domain }}</code>
            <button class="text-error hover:underline" @click="removeDomain(org.id, d.id)">
              ✕
            </button>
          </div>
          <div class="mt-1 flex gap-1">
            <input
              v-model="newDomain[org.id]"
              class="field-input max-w-[200px] text-label-md"
              placeholder="add domain"
              @keyup.enter="addDomain(org.id)"
            />
            <button class="btn btn-ghost btn-xs" @click="addDomain(org.id)">+</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
