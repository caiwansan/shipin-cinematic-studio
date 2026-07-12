<template>
  <GeoWorkspaceLayout>
    <RecommendationsPage />
  </GeoWorkspaceLayout>
</template>
<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import RecommendationsPage from 'workspaces/geo/pages/RecommendationsPage.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
