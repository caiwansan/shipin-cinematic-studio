<template>
  <div class="kh-page">
    <NuxtLink to="/workspace/knowledge-hub" class="kh-float-back">
      ← 返回 AI 知识中心
    </NuxtLink>
    <div class="kh-header">
      <h1>发布中心</h1>
      <p class="kh-subtitle">结构化数据与内容发布管理</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="kh-loading-grid">
      <div v-for="n in 4" :key="n" class="kh-skeleton-card"><div class="skeleton-block" style="height:1.2rem;width:40%"></div><div class="skeleton-block" style="height:0.85rem;width:30%;margin-top:10px"></div><div class="skeleton-block" style="height:0.85rem;width:60%;margin-top:10px"></div></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-banner">
      ⚠️ 发布记录加载失败，请稍后重试
    </div>

    <!-- Empty -->
    <div v-else-if="publications.length === 0" class="kh-empty">
      <div class="kh-empty-icon">📡</div>
      <h3>暂无发布记录</h3>
      <p>内容发布状态在配置品牌知识后自动更新。</p>
      <p class="kh-hint">涵盖：JSON-LD、Schema.org、OpenGraph、FAQ Schema、Organization Schema、Software Schema、RSS、Sitemap、Robots、索引状态</p>
    </div>

    <!-- Data -->
    <div v-else class="kh-content-list">
      <div v-for="pub in publications" :key="pub.id" class="kh-card">
        <div class="kh-card-header">
          <span class="kh-card-icon">📡</span>
          <div class="kh-card-title-group">
            <h3 class="kh-card-title">{{ pub.type }}</h3>
            <div class="kh-card-badges">
              <span :class="['kh-badge-status', pub.status]">{{ pub.status }}</span>
            </div>
          </div>
        </div>
        <div class="kh-card-target">
          <span class="kh-label">发布目标</span>
          <span class="kh-target-text">{{ pub.target }}</span>
        </div>
        <div class="kh-card-footer">
          <span class="kh-footer-meta">创建于 {{ formatDate(pub.createdAt) }}</span>
          <span v-if="pub.publishedAt" class="kh-footer-meta">发布于 {{ formatDate(pub.publishedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { knowledgeApi } from '~/modules/knowledge-hub/api/index';
import type { Publication } from '~/modules/knowledge-hub/types/index';

definePageMeta({ layout: 'default' });

const loading = ref(true);
const error = ref(false);
const publications = ref<Publication[]>([]);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

onMounted(async () => {
  try {
    publications.value = await knowledgeApi.getPublications();
  } catch (e) {
    console.error('KH Publication load error:', e);
    error.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.kh-page { max-width: 1200px; margin: 0 auto; padding: 32px 24px; position: relative; }
.kh-float-back {
  position: fixed; top: 12px; left: 12px; z-index: 100;
  background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 6px 14px; font-size: 0.82rem; color: #3b82f6; text-decoration: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: background .2s, box-shadow .2s;
}
.kh-float-back:hover { background: #eff6ff; box-shadow: 0 2px 6px rgba(0,0,0,0.12); }
.kh-header { margin-top: 24px; margin-bottom: 32px; }
.kh-header h1 { font-size: 1.8rem; font-weight: 700; color: #111827; margin: 0 0 4px; }
.kh-subtitle { color: #6b7280; font-size: 0.9rem; margin: 0; }

/* Loading */
.kh-loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.kh-skeleton-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
.skeleton-block { background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Error */
.error-banner { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; }

/* Empty */
.kh-empty { text-align: center; padding: 80px 20px; background: #f9fafb; border-radius: 16px; border: 1px dashed #d1d5db; }
.kh-empty-icon { font-size: 3rem; margin-bottom: 16px; }
.kh-empty h3 { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 0 0 8px; }
.kh-empty p { color: #6b7280; font-size: 0.85rem; margin: 0 0 4px; }
.kh-hint { font-size: 0.78rem; margin-top: 12px; color: #9ca3af; }

/* Card List */
.kh-content-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.kh-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; transition: border-color .2s, box-shadow .2s; }
.kh-card:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(59,130,246,0.08); }
.kh-card-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.kh-card-icon { font-size: 1.3rem; flex-shrink: 0; margin-top: 2px; }
.kh-card-title-group { flex: 1; min-width: 0; }
.kh-card-title { font-size: 1rem; font-weight: 600; color: #111827; margin: 0 0 6px; text-transform: uppercase; }
.kh-card-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.kh-badge-status { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; text-transform: capitalize; }
.kh-badge-status.pending { color: #92400e; background: #fef3c7; }
.kh-badge-status.published { color: #166534; background: #dcfce7; }
.kh-badge-status.failed { color: #991b1b; background: #fef2f2; }
.kh-card-target { margin-bottom: 12px; }
.kh-label { font-size: 0.75rem; font-weight: 600; color: #374151; display: block; margin-bottom: 4px; }
.kh-target-text { font-size: 0.82rem; color: #6b7280; word-break: break-all; }
.kh-card-footer { display: flex; gap: 16px; border-top: 1px solid #f3f4f6; padding-top: 10px; }
.kh-footer-meta { font-size: 0.75rem; color: #9ca3af; }
</style>
