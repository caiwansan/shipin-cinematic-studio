<template>
  <LegalWorkspaceLayout>
    <CaseWorkspace />
  </LegalWorkspaceLayout>
</template>

<script setup lang="ts">
import LegalWorkspaceLayout from 'workspaces/legal/layouts/LegalWorkspaceLayout.vue'
import CaseWorkspace from 'workspaces/legal/pages/CaseWorkspace.vue'

definePageMeta({ layout: false })
</script>
