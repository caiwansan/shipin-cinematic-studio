<template>
  <div class="semantic-explorer">
    <!-- Header -->
    <div class="sem-ex-header">
      <h1 class="sem-ex-title">🧠 语义资源管理器</h1>
      <p class="sem-ex-subtitle">浏览和管理实体、主题、分类法、别名和关键词</p>
    </div>

    <!-- Tabs -->
    <div class="sem-ex-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="sem-ex-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.icon }} {{ tab.label }}
        <span class="sem-ex-tab-badge">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="sem-ex-loading">
      <span class="sem-ex-spinner"></span>
      <span>加载语义数据...</span>
    </div>

    <!-- Entity Tab -->
    <div v-else-if="activeTab === 'entities'" class="sem-ex-panel">
      <div class="sem-ex-panel-header">
        <input
          v-model="entitySearch"
          placeholder="搜索实体..."
          class="sem-ex-search"
          @input="onEntitySearch"
        />
        <select v-model="entityTypeFilter" class="sem-ex-filter" @change="onEntityFilter">
          <option value="">全部类型</option>
          <option v-for="t in entityTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <span class="sem-ex-count">{{ store.entitiesTotal.value }} 个实体</span>
      </div>
      <div class="sem-ex-list">
        <div v-for="entity in store.entities.value" :key="entity.id" class="sem-ex-card">
          <div class="sem-ex-card-header">
            <span class="sem-ex-card-type" :class="'type-' + entity.type.toLowerCase()">{{ entity.type }}</span>
            <span class="sem-ex-card-name">{{ entity.name }}</span>
            <span class="sem-ex-card-conf">{{ (entity.confidence * 100).toFixed(0) }}%</span>
          </div>
          <div v-if="entity.description" class="sem-ex-card-desc">{{ entity.description }}</div>
          <div v-if="entity.aliases && entity.aliases.length" class="sem-ex-card-meta">
            <span>别名: {{ entity.aliases.map(a => a.alias).join(', ') }}</span>
          </div>
          <div v-if="entity.assetId" class="sem-ex-card-meta">来源资产: {{ entity.assetId.substring(0, 8) }}...</div>
        </div>
        <div v-if="store.entities.value.length === 0" class="sem-ex-empty">暂无实体数据</div>
      </div>
    </div>

    <!-- Topic Tab -->
    <div v-else-if="activeTab === 'topics'" class="sem-ex-panel">
      <div class="sem-ex-panel-header">
        <span class="sem-ex-count">{{ store.topicsTotal.value }} 个主题</span>
      </div>
      <div class="sem-ex-list">
        <div v-for="topic in store.topics.value" :key="topic.id" class="sem-ex-card">
          <div class="sem-ex-card-header">
            <span class="sem-ex-card-name">{{ topic.name }}</span>
            <span class="sem-ex-card-conf">{{ (topic.confidence * 100).toFixed(0) }}%</span>
          </div>
          <div v-if="topic.description" class="sem-ex-card-desc">{{ topic.description }}</div>
          <div v-if="topic.entities && topic.entities.length" class="sem-ex-card-meta">
            <span>关联实体: {{ topic.entities.length }}</span>
          </div>
        </div>
        <div v-if="store.topics.value.length === 0" class="sem-ex-empty">暂无主题数据</div>
      </div>
    </div>

    <!-- Taxonomy Tab -->
    <div v-else-if="activeTab === 'taxonomy'" class="sem-ex-panel">
      <div class="sem-ex-panel-header">
        <span class="sem-ex-count">{{ store.taxonomyTree.value.length }} 个分类节点</span>
      </div>
      <div class="sem-ex-list">
        <div v-for="node in store.taxonomyTree.value" :key="node.id" class="sem-ex-card" :style="{ marginLeft: (node.depth || 0) * 20 + 'px' }">
          <div class="sem-ex-card-header">
            <span class="sem-ex-card-depth-indicator">{{ '─'.repeat(node.depth || 0) }} </span>
            <span class="sem-ex-card-name">{{ node.name }}</span>
            <span v-if="node.path" class="sem-ex-card-path">{{ node.path }}</span>
          </div>
          <div v-if="node.description" class="sem-ex-card-desc">{{ node.description }}</div>
          <div v-if="node.children && node.children.length" class="sem-ex-card-meta">
            <span>子节点: {{ node.children.length }}</span>
          </div>
        </div>
        <div v-if="store.taxonomyTree.value.length === 0" class="sem-ex-empty">暂无分类数据</div>
      </div>
    </div>

    <!-- Alias Tab -->
    <div v-else-if="activeTab === 'aliases'" class="sem-ex-panel">
      <div class="sem-ex-panel-header">
        <span class="sem-ex-count">{{ store.aliases.value.length }} 个别名</span>
      </div>
      <div class="sem-ex-list">
        <div v-for="alias in store.aliases.value" :key="alias.id" class="sem-ex-card">
          <div class="sem-ex-card-header">
            <span class="sem-ex-card-name">{{ alias.alias }}</span>
            <span class="sem-ex-card-type">{{ alias.language }}</span>
            <span class="sem-ex-card-conf">{{ (alias.confidence * 100).toFixed(0) }}%</span>
          </div>
          <div v-if="alias.entity" class="sem-ex-card-meta">
            <span>对应实体: {{ alias.entity.name }} ({{ alias.entity.type }})</span>
          </div>
        </div>
        <div v-if="store.aliases.value.length === 0" class="sem-ex-empty">暂无别名数据</div>
      </div>
    </div>

    <!-- Keyword Tab -->
    <div v-else-if="activeTab === 'keywords'" class="sem-ex-panel">
      <div class="sem-ex-panel-header">
        <span class="sem-ex-count">{{ store.keywords.value.length }} 个关键词</span>
      </div>
      <div class="sem-ex-list">
        <div v-for="kw in store.keywords.value" :key="kw.id" class="sem-ex-card">
          <div class="sem-ex-card-header">
            <span class="sem-ex-card-name">{{ kw.keyword }}</span>
            <span class="sem-ex-card-type">{{ kw.language }}</span>
            <span class="sem-ex-card-conf">{{ (kw.confidence * 100).toFixed(0) }}%</span>
          </div>
          <div v-if="kw.entity" class="sem-ex-card-meta">
            <span>关联实体: {{ kw.entity.name }}</span>
          </div>
        </div>
        <div v-if="store.keywords.value.length === 0" class="sem-ex-empty">暂无关键词数据</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useSemanticStore } from '~/modules/semantic/store/useSemanticStore'

const props = defineProps<{
  projectId: string
}>()

const store = useSemanticStore()

const tabs = computed(() => [
  { id: 'entities', label: '实体', icon: '🏷️', count: store.stats.value.entityCount },
  { id: 'topics', label: '主题', icon: '📌', count: store.stats.value.topicCount },
  { id: 'taxonomy', label: '分类法', icon: '🌳', count: store.stats.value.taxonomyCount },
  { id: 'aliases', label: '别名', icon: '🔀', count: store.stats.value.aliasCount },
  { id: 'keywords', label: '关键词', icon: '🔑', count: store.stats.value.keywordCount },
])

const activeTab = ref('entities')
const entitySearch = ref('')
const entityTypeFilter = ref('')
const loading = ref(false)

const entityTypes = [
  'Brand', 'Company', 'Organization', 'Person', 'Product', 'Service',
  'Feature', 'Capability', 'Workflow', 'Prompt', 'API', 'Document',
  'Technology', 'Concept', 'Location', 'Event',
]

function onEntitySearch() {
  store.fetchEntities(props.projectId, {
    search: entitySearch.value || undefined,
    type: entityTypeFilter.value || undefined,
    limit: 50,
  })
}

function onEntityFilter() {
  store.fetchEntities(props.projectId, {
    type: entityTypeFilter.value || undefined,
    search: entitySearch.value || undefined,
    limit: 50,
  })
}

watch(() => props.projectId, async (newId) => {
  if (newId) {
    loading.value = true
    await store.loadAll(newId)
    loading.value = false
  }
})

onMounted(async () => {
  if (props.projectId) {
    loading.value = true
    await store.loadAll(props.projectId)
    loading.value = false
  }
})
</script>

<style scoped>
.semantic-explorer {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
  color: #e2e8f0;
}

.sem-ex-header {
  margin-bottom: 20px;
}
.sem-ex-title {
  font-size: 22px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0 0 4px;
}
.sem-ex-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

/* Tabs */
.sem-ex-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 8px;
}
.sem-ex-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.sem-ex-tab:hover {
  background: rgba(99, 102, 241, 0.08);
  color: #a5b4fc;
}
.sem-ex-tab.active {
  background: rgba(99, 102, 241, 0.12);
  color: #a5b4fc;
  border-color: rgba(99, 102, 241, 0.2);
}
.sem-ex-tab-badge {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 10px;
  color: #6b7280;
}

/* Loading */
.sem-ex-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 40px;
  justify-content: center;
  color: #6b7280;
}
.sem-ex-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(99, 102, 241, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Panel */
.sem-ex-panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.sem-ex-search {
  flex: 1;
  max-width: 300px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: #11151c;
  color: #e2e8f0;
  font-size: 13px;
}
.sem-ex-search::placeholder {
  color: #4b5563;
}
.sem-ex-filter {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: #11151c;
  color: #e2e8f0;
  font-size: 13px;
}
.sem-ex-count {
  font-size: 12px;
  color: #6b7280;
  margin-left: auto;
}

/* Card List */
.sem-ex-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sem-ex-card {
  background: #11151c;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 12px 16px;
  transition: all 0.15s;
}
.sem-ex-card:hover {
  border-color: rgba(99, 102, 241, 0.15);
  background: #161c26;
}
.sem-ex-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sem-ex-card-type {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.1);
  color: #818cf8;
  font-weight: 600;
  text-transform: uppercase;
}
.sem-ex-card-name {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}
.sem-ex-card-conf {
  font-size: 11px;
  color: #6b7280;
  margin-left: auto;
}
.sem-ex-card-desc {
  font-size: 12px;
  color: #6b7280;
  margin-top: 6px;
  line-height: 1.4;
}
.sem-ex-card-meta {
  font-size: 11px;
  color: #4b5563;
  margin-top: 4px;
}
.sem-ex-card-depth-indicator {
  color: #374151;
  font-size: 12px;
}
.sem-ex-card-path {
  font-size: 11px;
  color: #4b5563;
  margin-left: 8px;
}
.sem-ex-empty {
  text-align: center;
  padding: 40px;
  color: #4b5563;
  font-size: 14px;
}
</style>
