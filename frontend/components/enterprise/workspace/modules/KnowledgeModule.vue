<template>
  <div class="knowledge-module">
    <section class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ knowledgeCount }}</span><span class="stat-label">知识条目</span></div>
      <div class="stat-item"><span class="stat-value text-purple">{{ aiRefs }}</span><span class="stat-label">AI 引用次数</span></div>
      <div class="stat-item"><span class="stat-value">{{ coverage }}%</span><span class="stat-label">知识覆盖率</span></div>
    </section>
    <section class="section">
      <h2 class="section-title">企业知识资产</h2>
      <div v-if="knowledgeItems.length > 0" class="knowledge-list">
        <div v-for="item in knowledgeItems" :key="item.id" class="knowledge-card">
          <h3 class="knowledge-title">{{ item.title }}</h3>
          <p class="knowledge-desc">{{ item.description }}</p>
          <div class="knowledge-meta"><span class="meta-tag">{{ item.category }}</span><span class="meta-ref">引用 {{ item.refCount }} 次</span></div>
        </div>
      </div>
      <EmptyState v-else icon="📚" title="知识库为空" description="积累企业知识资产，供 AI 和员工随时调用。" helper-text="支持文档、FAQ、流程手册" :action="'上传知识'" />
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'
interface KnowledgeItem { id: string; title: string; description: string; category: string; refCount: number }
const knowledgeCount = ref(0)
const aiRefs = ref(0)
const coverage = ref(0)
const knowledgeItems = ref<KnowledgeItem[]>([])
onMounted(() => { /* TODO: 接入 Knowledge API */ })
</script>
<style scoped>
.knowledge-module { display: flex; flex-direction: column; gap: var(--space-lg); }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); }
.stat-item { background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-lg); padding: var(--space-lg); display: flex; flex-direction: column; align-items: center; }
.stat-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-intelligence); }
.stat-value.text-purple { color: #8b5cf6; }
.stat-label { font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: var(--space-xs); }
.section { background: var(--color-bg-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--radius-xl); padding: var(--space-xl); }
.section-title { font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--space-lg); color: var(--color-text-primary); }
.knowledge-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); }
.knowledge-card { padding: var(--space-md); background: var(--color-bg-elevated); border-radius: var(--radius-md); border: 1px solid var(--color-border-primary); }
.knowledge-title { font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-xs); }
.knowledge-desc { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-sm); }
.knowledge-meta { display: flex; justify-content: space-between; font-size: var(--font-size-xs); }
.meta-tag { color: var(--color-intelligence); }
.meta-ref { color: var(--color-text-muted); }
@media (max-width: 768px) { .stats-row { grid-template-columns: 1fr; } .knowledge-list { grid-template-columns: 1fr; } }
</style>
