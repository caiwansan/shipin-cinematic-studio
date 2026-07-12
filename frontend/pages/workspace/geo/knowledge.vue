<template>
  <GeoWorkspaceLayout>
    <KnowledgePage />
  </GeoWorkspaceLayout>
</template>
<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import KnowledgePage from 'workspaces/geo/pages/KnowledgePage.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
