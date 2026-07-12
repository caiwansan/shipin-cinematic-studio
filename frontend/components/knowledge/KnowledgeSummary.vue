<template>
  <div v-if="summaryText" class="bg-white">
    <div class="max-w-4xl mx-auto px-4 pb-8">
      <h2 class="text-2xl font-semibold text-gray-800 mb-4">内容摘要</h2>
      <p class="text-gray-600 leading-relaxed">{{ summaryText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ manifest: any }>()

const summaryText = computed(() => {
  if (!props.manifest?.content?.body) return null
  const textBlock = props.manifest.content.body.find(
    (b: any) => b.type === 'text'
  )
  return textBlock?.content || null
})
</script>
