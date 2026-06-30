/**
 * geo.vue — GEO Workspace Entry Page (Redirect)
 *
 * Replaced legacy workspace entry (brand-geo-v2) with direct redirect.
 * All GEO pages are served via /workspace/geo/health, /workspace/geo/recommendations, etc.
 *
 * Legacy cleanup (Phase 9): references to brand-geo and brand-geo-v2 removed.
 * Routes are registered via frontend/plugins/geo-router.ts → frontend/workspaces/geo/router.ts
 */
<template>
  <div />
</template>

<script setup lang="ts">
if (process.client) {
  window.location.replace('/workspace/geo/health')
}
</script>
