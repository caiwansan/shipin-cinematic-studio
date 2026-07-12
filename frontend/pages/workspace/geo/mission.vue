<template>
  <GeoWorkspaceLayout>
    <MissionWorkspacePage />
  </GeoWorkspaceLayout>
</template>

<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import MissionWorkspacePage from 'workspaces/geo/pages/MissionWorkspacePage.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
