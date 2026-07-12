<template>
  <GeoWorkspaceLayout>
    <GrowthPage />
  </GeoWorkspaceLayout>
</template>
<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import GrowthPage from 'workspaces/geo/pages/GrowthPage.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
