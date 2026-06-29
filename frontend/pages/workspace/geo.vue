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
import BrandGEOWorkspace from '~/studio-v2/workspace/brand-geo/BrandGEOWorkspace.vue'
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
