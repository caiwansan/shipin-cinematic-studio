<template>
  <div class="kh-page">
    <NuxtLink to="/workspace/knowledge-hub" class="kh-float-back">
      ← 返回 AI 知识中心
    </NuxtLink>
    <div class="kh-header">
      <h1>产品中心</h1>
      <p class="kh-subtitle">产品功能、定价、用例与文档</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="kh-loading-grid">
      <div v-for="n in 4" :key="n" class="kh-skeleton-card"><div class="skeleton-block" style="height:1.2rem;width:50%"></div><div class="skeleton-block" style="height:0.85rem;width:80%;margin-top:12px"></div><div class="skeleton-block" style="height:1rem;width:60%;margin-top:12px"></div></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-banner">
      ⚠️ 产品数据加载失败，请稍后重试
    </div>

    <!-- Empty -->
    <div v-else-if="products.length === 0" class="kh-empty">
      <div class="kh-empty-icon">📦</div>
      <h3>暂无产品数据</h3>
      <p>产品信息会在配置品牌资料后通过 API 接入。</p>
      <p class="kh-hint">涵盖：产品功能、能力、定价、使用案例、FAQ、文档、下载、竞品</p>
    </div>

    <!-- Data -->
    <div v-else class="kh-content-list">
      <div v-for="product in products" :key="product.id" class="kh-card">
        <div class="kh-card-header">
          <span class="kh-card-icon">📦</span>
          <div class="kh-card-title-group">
            <h3 class="kh-card-title">{{ product.name }}</h3>
            <span class="kh-card-badge">{{ product.brandId }}</span>
          </div>
        </div>
        <p class="kh-card-desc">{{ product.description }}</p>
        <div v-if="product.features && product.features.length" class="kh-features">
          <span class="kh-label">核心功能</span>
          <ul class="kh-feature-list">
            <li v-for="(f, i) in product.features.slice(0, 5)" :key="i" class="kh-feature-item">{{ f }}</li>
            <li v-if="product.features.length > 5" class="kh-feature-more">+{{ product.features.length - 5 }} 项更多</li>
          </ul>
        </div>
        <div v-if="product.pricing" class="kh-card-meta">
          <span class="kh-tag">💰 {{ product.pricing }}</span>
        </div>
        <div v-if="product.useCases && product.useCases.length" class="kh-card-meta">
          <span v-for="(uc, i) in product.useCases.slice(0, 3)" :key="i" class="kh-tag">🔹 {{ uc }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { knowledgeApi } from '~/modules/knowledge-hub/api/index';
import type { Product } from '~/modules/knowledge-hub/types/index';

definePageMeta({ layout: 'default' });

const loading = ref(true);
const error = ref(false);
const products = ref<Product[]>([]);

onMounted(async () => {
  try {
    products.value = await knowledgeApi.getProducts();
  } catch (e) {
    console.error('KH Product load error:', e);
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
.kh-loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
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
.kh-card-title { font-size: 1rem; font-weight: 600; color: #111827; margin: 0; }
.kh-card-badge { display: inline-block; font-size: 0.7rem; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; margin-top: 4px; }
.kh-card-desc { font-size: 0.82rem; color: #6b7280; line-height: 1.5; margin: 0 0 12px; }
.kh-features { margin-bottom: 10px; }
.kh-label { font-size: 0.75rem; font-weight: 600; color: #374151; display: block; margin-bottom: 6px; }
.kh-feature-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
.kh-feature-item { font-size: 0.75rem; color: #374151; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 2px 8px; border-radius: 4px; }
.kh-feature-more { font-size: 0.72rem; color: #9ca3af; padding: 2px 8px; }
.kh-card-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.kh-tag { font-size: 0.72rem; color: #374151; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
</style>
