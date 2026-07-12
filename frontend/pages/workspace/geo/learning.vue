<template>
  <GeoWorkspaceLayout>
    <div class="geo-route-learning">
      <h1>🧠 Learning</h1>
      <UIEmptyState icon="🧠" title="等待信号" />
    </div>
  </GeoWorkspaceLayout>
</template>

<script setup lang="ts">
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import UIEmptyState from '~/components/ui/UIEmptyState.vue'
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
