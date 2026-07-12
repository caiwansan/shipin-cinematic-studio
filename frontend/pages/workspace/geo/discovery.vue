<template>
  <GeoWorkspaceLayout>
    <DiscoveryLabPage />
  </GeoWorkspaceLayout>
</template>
<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import DiscoveryLabPage from 'workspaces/geo/pages/DiscoveryLabPage.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
