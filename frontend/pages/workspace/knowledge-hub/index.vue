<template>
  <div class="knowledge-dashboard">
    <div class="page-header">
      <NuxtLink to="/workspace/geo/dashboard" class="back-link">← 返回 GEO 工作台</NuxtLink>
      <h1>AI 知识中心</h1>
      <p class="subtitle">品牌知识资产管理、实体图谱与 AI 收录建设</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="metrics-grid">
      <div v-for="n in 6" :key="n" class="metric-card"><div class="metric-value skeleton">&nbsp;</div></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-banner">⚠️ 数据加载失败</div>

    <!-- Metrics -->
    <div v-else class="metrics-grid">
      <div class="metric-card"><div class="metric-label">AI Ready</div><div class="metric-value">{{ metrics.aiReadiness }}</div></div>
      <div class="metric-card"><div class="metric-label">品牌资产</div><div class="metric-value">{{ metrics.brandCount }}</div></div>
      <div class="metric-card"><div class="metric-label">知识文章</div><div class="metric-value">{{ metrics.articleCount }}</div></div>
      <div class="metric-card"><div class="metric-label">实体数量</div><div class="metric-value">{{ metrics.entityCount }}</div></div>
      <div class="metric-card"><div class="metric-label">结构化数据</div><div class="metric-value">{{ metrics.structuredData }}</div></div>
      <div class="metric-card"><div class="metric-label">已发布资产</div><div class="metric-value">{{ metrics.publishedAssets }}</div></div>
    </div>

    <!-- Quick Access -->
    <div class="quick-access">
      <h2>快速入口</h2>
      <div class="quick-grid">
        <NuxtLink to="/workspace/knowledge-hub/brand" class="quick-card">
          <span class="quick-icon">🏢</span><span class="quick-label">品牌中心</span><span class="quick-desc">管理品牌资料与身份（{{ metrics.brandCount }}）</span>
        </NuxtLink>
        <NuxtLink to="/workspace/knowledge-hub/product" class="quick-card">
          <span class="quick-icon">📦</span><span class="quick-label">产品中心</span><span class="quick-desc">产品能力与定价（{{ metrics.productCount }}）</span>
        </NuxtLink>
        <NuxtLink to="/workspace/knowledge-hub/knowledge" class="quick-card">
          <span class="quick-icon">📚</span><span class="quick-label">知识中心</span><span class="quick-desc">AI 可消费知识（{{ metrics.articleCount }} 篇）</span>
        </NuxtLink>
        <NuxtLink to="/workspace/knowledge-hub/entity" class="quick-card">
          <span class="quick-icon">🔗</span><span class="quick-label">实体图谱</span><span class="quick-desc">实体关系与信号（{{ metrics.entityCount }}）</span>
        </NuxtLink>
        <NuxtLink to="/workspace/knowledge-hub/publishing" class="quick-card">
          <span class="quick-icon">📡</span><span class="quick-label">发布中心</span><span class="quick-desc">Schema & 内容发布（{{ metrics.publishedAssets }}）</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Readiness -->
    <div class="readiness-section">
      <h2>AI Readiness</h2>
      <div class="readiness-grid">
        <div class="readiness-item"><span class="readiness-label">知识评分</span><div class="readiness-bar"><div class="bar-fill" :style="{width: readiness.knowledgeScore+'%'}"></div></div><span class="readiness-value">{{ readiness.knowledgeScore }}%</span></div>
        <div class="readiness-item"><span class="readiness-label">Schema 覆盖</span><div class="readiness-bar"><div class="bar-fill" :style="{width: readiness.schemaCoverage+'%'}"></div></div><span class="readiness-value">{{ readiness.schemaCoverage }}%</span></div>
        <div class="readiness-item"><span class="readiness-label">FAQ 覆盖</span><div class="readiness-bar"><div class="bar-fill" :style="{width: readiness.faqCoverage+'%'}"></div></div><span class="readiness-value">{{ readiness.faqCoverage }}%</span></div>
        <div class="readiness-item"><span class="readiness-label">证据覆盖</span><div class="readiness-bar"><div class="bar-fill" :style="{width: readiness.evidenceCoverage+'%'}"></div></div><span class="readiness-value">{{ readiness.evidenceCoverage }}%</span></div>
        <div class="readiness-item"><span class="readiness-label">实体覆盖</span><div class="readiness-bar"><div class="bar-fill" :style="{width: readiness.entityCoverage+'%'}"></div></div><span class="readiness-value">{{ readiness.entityCoverage }}%</span></div>
        <div class="readiness-item"><span class="readiness-label">内容新鲜度</span><div class="readiness-bar"><div class="bar-fill" :style="{width: readiness.contentFreshness+'%'}"></div></div><span class="readiness-value">{{ readiness.contentFreshness }}%</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { knowledgeApi } from '~/modules/knowledge-hub/api/index';

definePageMeta({ layout: 'default' });

const loading = ref(true);
const error = ref(false);
const metrics = ref({
  aiReadiness: 0, brandCount: 0, articleCount: 0,
  entityCount: 0, structuredData: 0, publishedAssets: 0, productCount: 0,
});
const readiness = ref({
  knowledgeScore: 0, schemaCoverage: 0, faqCoverage: 0,
  evidenceCoverage: 0, entityCoverage: 0, contentFreshness: 0,
});

onMounted(async () => {
  try {
    const data = await knowledgeApi.getDashboard();
    metrics.value = data;
    readiness.value = data.readiness;
    metrics.value.aiReadiness = data.aiReadiness;
  } catch (e) {
    console.error('KH Dashboard error:', e);
    error.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.knowledge-dashboard { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 1.8rem; font-weight: 700; color: #111827; margin: 8px 0 0; }
.subtitle { color: #6b7280; font-size: 0.9rem; margin: 4px 0 0; }
.back-link { color: #3b82f6; font-size: 0.85rem; text-decoration: none; display: inline-block; margin-bottom: 4px; }
.back-link:hover { color: #2563eb; text-decoration: underline; }
.metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
.metric-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
.metric-label { font-size: 0.78rem; color: #6b7280; margin-bottom: 8px; }
.metric-value { font-size: 1.8rem; font-weight: 700; color: #111827; }
.quick-access { margin-bottom: 32px; }
.quick-access h2, .readiness-section h2 { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 0 0 16px; }
.quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 12px; }
.quick-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-decoration: none; display: flex; flex-direction: column; gap: 8px; transition: border-color .3s, background .3s; }
.quick-card:hover { border-color: #3b82f6; background: #eff6ff; }
.quick-icon { font-size: 1.5rem; }
.quick-label { font-size: 0.9rem; font-weight: 600; color: #111827; }
.quick-desc { font-size: 0.78rem; color: #6b7280; }
.readiness-grid { display: flex; flex-direction: column; gap: 12px; }
.readiness-item { display: flex; align-items: center; gap: 12px; }
.readiness-label { width: 120px; font-size: 0.85rem; color: #374151; flex-shrink: 0; }
.readiness-bar { flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #22c55e); border-radius: 4px; transition: width .6s; }
.readiness-value { width: 40px; font-size: 0.82rem; color: #111827; text-align: right; flex-shrink: 0; }
.error-banner { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; }
.skeleton { background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; height: 2rem; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
