<!-- KnowledgeBrowser.vue — Card Grid Workbench -->
<template>
  <section class="geo-kb">
    <KnowledgeFilterBar
      :vm="vm"
      :active-filter="activeFilter"
      :active-sort="activeSort"
      @update:activeFilter="activeFilter = $event"
      @update:activeSort="activeSort = $event"
    />

    <div v-if="vm.visibleObjects.length === 0" class="geo-kb__empty">
      No matching knowledge
    </div>
    <div v-else class="geo-kb__grid">
      <KnowledgeCard
        v-for="obj in vm.visibleObjects"
        :key="obj.id"
        :knowledge-object="obj"
        @view-insight="onViewInsight"
      />
    </div>

    <div class="geo-kb__summary">{{ vm.summary }}</div>

    <!-- Insight Panel Overlay -->
    <KnowledgeInsightPanel
      v-if="selectedInsight"
      :insight="selectedInsight"
      :evidence="selectedInsight.evidence"
      @close="onCloseInsight"
      @go-to-object="onGoToObject"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { KnowledgeBrowserVM, KnowledgeObjectInsight } from '../../viewmodels/KnowledgeBrowserVM'
import { buildBrowserVM } from '../../viewmodels/KnowledgeBrowserVM'
import { useKnowledgeStore } from '../../stores/useKnowledgeStore'
import KnowledgeCard from './KnowledgeCard.vue'
import KnowledgeFilterBar from './KnowledgeFilterBar.vue'
import KnowledgeInsightPanel from './KnowledgeInsightPanel.vue'

const store = useKnowledgeStore()

const activeFilter = ref('all')
const activeSort = ref('recent')

const vm = computed<KnowledgeBrowserVM>(() =>
  buildBrowserVM(store, activeFilter.value, activeSort.value)
)

// ── Insight Panel State ──
const selectedInsight = ref<KnowledgeObjectInsight | null>(null)
const selectedTitle = ref('')
const selectedCategory = ref('')

function onViewInsight(objectId: string) {
  const obj = vm.value.visibleObjects.find(o => o.id === objectId)
  if (!obj) return
  selectedInsight.value = obj.insight
  selectedTitle.value = obj.content
  selectedCategory.value = obj.category
}

function onCloseInsight() {
  selectedInsight.value = null
  selectedTitle.value = ''
  selectedCategory.value = ''
}

function onGoToObject() {
  // Action: navigates user to improve this knowledge object
  // Future: open editor or knowledge workspace for the selected object
  if (selectedInsight.value) {
    // Close panel on action — user will be navigated
    onCloseInsight()
  }
}
</script>

<style scoped>
.geo-kb {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.geo-kb__empty {
  text-align: center;
  padding: 48px 24px;
  color: #94a3b8;
  font-size: 14px;
}

.geo-kb__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 1024px) {
  .geo-kb__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .geo-kb__grid {
    grid-template-columns: 1fr;
  }
}

.geo-kb__summary {
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  padding-top: 4px;
  border-top: 1px solid #f1f5f9;
}
</style>
