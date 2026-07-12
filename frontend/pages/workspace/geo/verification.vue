<template>
  <GeoWorkspaceLayout>
    <VerificationPage />
  </GeoWorkspaceLayout>
</template>
<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import VerificationPage from 'workspaces/geo/pages/VerificationPage.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
