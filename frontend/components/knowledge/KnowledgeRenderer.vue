<template>
  <div v-if="!manifest" class="min-h-screen bg-white flex items-center justify-center">
    <div class="text-gray-400 text-lg">内容不存在</div>
  </div>

  <div v-else class="min-h-screen bg-white">
    <component
      v-for="section in activeSections"
      :key="section"
      :is="getComponent(section)"
      :manifest="manifest"
    />
  </div>
</template>

<script setup lang="ts">
import { resolveComponent } from './registry'
import { registerAllComponents } from './registry.setup'

// Register all components at setup time
registerAllComponents()

const props = defineProps<{ manifest: any }>()

// Default sections for a brand page — not hardcoded per pageType
// Future types will define their own section arrays
const activeSections = [
  'knowledge-jsonld',
  'knowledge-hero',
  'knowledge-summary',
  'knowledge-body-renderer',
  'knowledge-related',
  'knowledge-faq',
  'knowledge-metadata',
  'knowledge-footer',
]

// Resolve component from registry on each render
function getComponent(name: string): any {
  return resolveComponent(name)
}
</script>
