<template>
  <div v-if="faqItems.length > 0" class="bg-white">
    <div class="max-w-4xl mx-auto px-4 pb-8">
      <h2 class="text-2xl font-semibold text-gray-800 mb-4">常见问题</h2>
      <div class="space-y-6">
        <div v-for="(item, i) in faqItems" :key="i">
          <h3 class="text-lg font-medium text-gray-800 mb-2">{{ item.question }}</h3>
          <div
            class="text-gray-600 prose prose-sm max-w-none"
            v-html="renderMarkdown(item.answer)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ manifest: any }>()

const faqItems = computed(() => {
  if (!props.manifest?.content?.body) return []

  // Find FAQ blocks in body
  const faqBlocks = props.manifest.content.body.filter(
    (b: any) => b.label === 'FAQ' && b.content
  )
  if (faqBlocks.length === 0) return []

  // Try to parse structured FAQ
  const items: { question: string; answer: string }[] = []

  for (const block of faqBlocks) {
    if (block.type === 'markdown' || block.type === 'text') {
      // Parse Q&A from markdown/text: Q: ... A: ...
      const lines = block.content.split('\n')
      let currentQ = ''
      let currentA = ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        const qMatch = trimmed.match(/^(?:Q：|Q:|问：|问:|Question:)\s*(.+)/i)
        const aMatch = trimmed.match(/^(?:A：|A:|答：|答:|Answer:)\s*(.+)/i)

        if (qMatch) {
          if (currentQ && currentA) {
            items.push({ question: currentQ, answer: currentA })
          }
          currentQ = qMatch[1]
          currentA = ''
        } else if (aMatch) {
          currentA = aMatch[1]
        } else if (currentQ) {
          // Continuation of answer
          currentA += (currentA ? '\n' : '') + trimmed
        }
      }

      // Push the last Q&A
      if (currentQ && currentA) {
        items.push({ question: currentQ, answer: currentA })
      }
    }
  }

  return items
})

function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
}
</script>
