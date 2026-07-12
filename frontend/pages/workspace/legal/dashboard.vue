<template>
  <LegalWorkspaceLayout>
    <LegalDashboard />
  </LegalWorkspaceLayout>
</template>

<script setup lang="ts">
import LegalWorkspaceLayout from 'workspaces/legal/layouts/LegalWorkspaceLayout.vue'
import LegalDashboard from 'workspaces/legal/pages/LegalDashboard.vue'

definePageMeta({
  layout: false,
})
</script>
