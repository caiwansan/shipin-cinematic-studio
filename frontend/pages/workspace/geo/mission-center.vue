<template>
  <GeoWorkspaceLayout>
    <MissionCenterShell />
  </GeoWorkspaceLayout>
</template>

<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import MissionCenterShell from 'workspaces/geo/pages/MissionCenterShell.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
