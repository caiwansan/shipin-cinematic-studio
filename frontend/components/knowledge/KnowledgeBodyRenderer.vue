<template>
  <div v-if="body.length > 0" class="bg-white">
    <div class="max-w-4xl mx-auto px-4 pb-8">
      <div v-for="block in body" :key="block.order" class="mb-8">
        <h2 v-if="block.label && block.label !== 'Summary'" class="text-2xl font-semibold text-gray-800 mb-4">
          {{ block.label }}
        </h2>

        <!-- text -->
        <p v-if="block.type === 'text'" class="text-gray-700 leading-relaxed">
          {{ block.content }}
        </p>

        <!-- markdown -->
        <div
          v-else-if="block.type === 'markdown'"
          class="prose prose-gray max-w-none"
          v-html="renderMarkdown(block.content)"
        ></div>

        <!-- html -->
        <div
          v-else-if="block.type === 'html'"
          class="prose prose-gray max-w-none"
          v-html="block.content"
        ></div>

        <!-- list -->
        <ul
          v-else-if="block.type === 'list'"
          class="list-disc list-inside space-y-2 text-gray-700"
        >
          <li v-for="(item, i) in parseList(block.content)" :key="i">{{ item }}</li>
        </ul>

        <!-- fallback -->
        <p v-else class="text-gray-700 leading-relaxed">{{ block.content }}</p>
      </div>

      <!-- features section -->
      <div v-if="manifest.content?.features?.length > 0" class="mt-8">
        <h2 class="text-2xl font-semibold text-gray-800 mb-4">关键特征</h2>
        <ul class="list-disc list-inside space-y-2 text-gray-700">
          <li v-for="(f, i) in manifest.content.features" :key="i">{{ f }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ manifest: any }>()

const body = computed(() => {
  // Filter out FAQ blocks — handled by KnowledgeFAQ
  return (props.manifest?.content?.body || []).filter(
    (b: any) => b.label !== 'FAQ'
  )
})

function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
}

function parseList(content: string): string[] {
  if (!content) return []
  return content.split('\n').filter((item: string) => item.trim())
}
</script>
