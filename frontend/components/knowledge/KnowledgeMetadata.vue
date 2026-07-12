<template>
  <div v-if="versionStr || compiledAt" class="bg-white">
    <div class="max-w-4xl mx-auto px-4 pb-8">
      <div class="border-t border-gray-200 pt-6 text-sm text-gray-400">
        <p v-if="versionStr">版本: {{ versionStr }}</p>
        <p v-if="compiledAt">编译时间: {{ compiledAt }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ manifest: any }>()

const versionStr = computed(() => {
  const v = props.manifest?.version
  if (!v) return null
  return `${v.manifestVersion || '?'}.${v.contentVersion || '?'}`
})

const compiledAt = computed(() => {
  return props.manifest?.version?.compiledAt || null
})
</script>
