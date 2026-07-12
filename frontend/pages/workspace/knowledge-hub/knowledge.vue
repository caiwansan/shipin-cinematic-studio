<template>
  <div class="kh-page">
    <NuxtLink to="/workspace/knowledge-hub" class="kh-float-back">
      ← 返回 AI 知识中心
    </NuxtLink>
    <div class="kh-header">
      <h1>知识中心</h1>
      <p class="kh-subtitle">AI 可消费知识内容管理</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="kh-loading-grid">
      <div v-for="n in 4" :key="n" class="kh-skeleton-card"><div class="skeleton-block" style="height:1.2rem;width:55%"></div><div class="skeleton-block" style="height:0.85rem;width:30%;margin-top:10px"></div><div class="skeleton-block" style="height:2rem;width:100%;margin-top:10px"></div></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-banner">
      ⚠️ 知识文章加载失败，请稍后重试
    </div>

    <!-- Empty -->
    <div v-else-if="articles.length === 0" class="kh-empty">
      <div class="kh-empty-icon">📚</div>
      <h3>暂无知识文章</h3>
      <p>知识内容通过 AI 自动生成或手动创建后显示。</p>
      <p class="kh-hint">涵盖：文章、白皮书、案例研究、研究、术语表、文档、新闻、新闻稿、FAQ、教程</p>
    </div>

    <!-- Data -->
    <div v-else class="kh-content-list kh-article-list">
      <div v-for="article in articles" :key="article.id" class="kh-card">
        <div class="kh-card-header">
          <span class="kh-card-icon">📄</span>
          <div class="kh-card-title-group">
            <h3 class="kh-card-title">{{ article.title }}</h3>
            <div class="kh-card-badges">
              <span class="kh-badge-type">{{ article.type }}</span>
              <span v-if="article.category" class="kh-badge-cat">{{ article.category }}</span>
              <span :class="['kh-badge-status', article.status]">{{ article.status }}</span>
            </div>
          </div>
        </div>
        <div v-if="article.tags && article.tags.length" class="kh-tags">
          <span v-for="(tag, i) in article.tags.slice(0, 6)" :key="i" class="kh-tag">{{ tag }}</span>
          <span v-if="article.tags.length > 6" class="kh-tag-more">+{{ article.tags.length - 6 }}</span>
        </div>
        <div class="kh-card-footer">
          <span class="kh-footer-meta">v{{ article.version }}</span>
          <span class="kh-footer-meta">{{ formatDate(article.updatedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { knowledgeApi } from '~/modules/knowledge-hub/api/index';
import type { KnowledgeArticle } from '~/modules/knowledge-hub/types/index';

definePageMeta({ layout: 'default' });

const loading = ref(true);
const error = ref(false);
const articles = ref<KnowledgeArticle[]>([]);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

onMounted(async () => {
  try {
    articles.value = await knowledgeApi.getArticles();
  } catch (e) {
    console.error('KH Article load error:', e);
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
.kh-loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
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
.kh-content-list { display: grid; gap: 16px; }
.kh-article-list { grid-template-columns: 1fr; }
.kh-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; transition: border-color .2s, box-shadow .2s; }
.kh-card:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(59,130,246,0.08); }
.kh-card-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.kh-card-icon { font-size: 1.3rem; flex-shrink: 0; margin-top: 2px; }
.kh-card-title-group { flex: 1; min-width: 0; }
.kh-card-title { font-size: 1rem; font-weight: 600; color: #111827; margin: 0 0 6px; }
.kh-card-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.kh-badge-type { font-size: 0.7rem; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
.kh-badge-cat { font-size: 0.7rem; color: #3b82f6; background: #eff6ff; padding: 2px 8px; border-radius: 4px; }
.kh-badge-status { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; text-transform: capitalize; }
.kh-badge-status.draft { color: #92400e; background: #fef3c7; }
.kh-badge-status.published { color: #166534; background: #dcfce7; }
.kh-badge-status.archived { color: #6b7280; background: #f3f4f6; }
.kh-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
.kh-tag { font-size: 0.72rem; color: #374151; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
.kh-tag-more { font-size: 0.72rem; color: #9ca3af; padding: 2px 8px; }
.kh-card-footer { display: flex; gap: 16px; border-top: 1px solid #f3f4f6; padding-top: 10px; }
.kh-footer-meta { font-size: 0.75rem; color: #9ca3af; }
</style>
