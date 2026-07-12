<template>
  <div />
</template>

<script setup lang="ts">
// Redirect /workspace/geo to the dashboard
navigateTo('/workspace/geo/dashboard', { replace: true })
</script>

<script lang="ts">
definePageMeta({
  title: 'GEO工作台',
})
</script>
