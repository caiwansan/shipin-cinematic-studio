<template>
  <GeoWorkspaceLayout>
    <PublishingPage />
  </GeoWorkspaceLayout>
</template>
<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import PublishingPage from 'workspaces/geo/pages/PublishingPage.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
