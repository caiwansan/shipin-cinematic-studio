<template>
  <div v-if="relatedLinks.length > 0" class="bg-white">
    <div class="max-w-4xl mx-auto px-4 pb-8">
      <h2 class="text-2xl font-semibold text-gray-800 mb-4">相关链接</h2>
      <ul class="space-y-2">
        <li v-for="(link, i) in relatedLinks" :key="i">
          <a
            :href="link.url"
            class="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {{ link.label || link.url }}
          </a>
        </li>
      </ul>
    </div>
  </div>
  <!-- Empty state: reserved slot -->
  <div v-else class="hidden"></div>
</template>

<script setup lang="ts">
const props = defineProps<{ manifest: any }>()

const relatedLinks = computed(() => {
  // From discoverability.links (non-canonical), or navigation.relatedLinks
  const navLinks = props.manifest?.renderer?.navigation?.relatedLinks || []
  if (navLinks.length > 0) return navLinks

  // Fall back to discoverability alternate links
  const discLinks = props.manifest?.discoverability?.links || []
  return discLinks
    .filter((l: any) => l.rel !== 'canonical')
    .map((l: any) => ({ label: l.title || l.href, url: l.href }))
})
</script>
