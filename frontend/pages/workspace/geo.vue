<template>
  <div style="width: 100%; height: 100%;">
    <BrandGEOWorkspace />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

console.log('[BrandGEO] geo.vue page mounted')

// Debug token status
if (import.meta.client) {
  const lsToken = window.localStorage?.getItem('auth_token')
  const cookieMatch = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/)
  console.log('[BrandGEO] 🔑 Token debug:', {
    localStorage: lsToken ? lsToken.slice(0, 20) + '...' : null,
    cookie: cookieMatch ? cookieMatch[1].slice(0, 20) + '...' : null,
    allCookies: document.cookie
  })
}

import BrandGEOWorkspace from '~/studio-v2/workspace/brand-geo-v2/GeoWorkspaceV1.vue'
</script>

<style>
/* Full height page reset for BrandGEO workspace */
html, body, #__nuxt {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
