<template>
  <div class="kh-page">
    <NuxtLink to="/workspace/knowledge-hub" class="kh-float-back">
      ← 返回 AI 知识中心
    </NuxtLink>
    <div class="kh-header">
      <h1>品牌中心</h1>
      <p class="kh-subtitle">品牌资料唯一事实来源（Single Source of Truth）</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="kh-loading-grid">
      <div v-for="n in 4" :key="n" class="kh-skeleton-card"><div class="skeleton-block" style="height:1.2rem;width:60%"></div><div class="skeleton-block" style="height:0.85rem;width:40%;margin-top:12px"></div><div class="skeleton-block" style="height:2rem;width:100%;margin-top:12px"></div></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-banner">
      ⚠️ 品牌数据加载失败，请稍后重试
    </div>

    <!-- Empty -->
    <div v-else-if="brands.length === 0" class="kh-empty">
      <div class="kh-empty-icon">🏢</div>
      <h3>创建品牌</h3>
      <p>你还没有创建任何品牌。品牌资料会在创建 GEO 项目或通过 API 接入后自动显示。</p>
      <p class="kh-hint">涵盖：品牌档案、使命、愿景、价值观、时间线、品牌故事、Logo、FAQ</p>
    </div>

    <!-- Data -->
    <div v-else class="kh-content-list">
      <div v-for="brand in brands" :key="brand.id" class="kh-card">
        <div class="kh-card-header">
          <span class="kh-card-icon">🏢</span>
          <div class="kh-card-title-group">
            <h3 class="kh-card-title">{{ brand.name }}</h3>
            <span class="kh-card-badge">{{ brand.industry }}</span>
          </div>
        </div>
        <p class="kh-card-desc">{{ brand.description }}</p>
        <div v-if="brand.website" class="kh-card-link">
          <a :href="brand.website" target="_blank" rel="noopener">{{ brand.website }}</a>
        </div>
        <div class="kh-card-meta">
          <span v-if="brand.mission" class="kh-tag">🎯 {{ brand.mission.substring(0, 40) }}{{ brand.mission.length > 40 ? '…' : '' }}</span>
          <span v-if="brand.values && brand.values.length" class="kh-tag">📋 {{ brand.values.length }} 个价值观</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { knowledgeApi } from '~/modules/knowledge-hub/api/index';
import type { Brand } from '~/modules/knowledge-hub/types/index';

definePageMeta({ layout: 'default' });

const loading = ref(true);
const error = ref(false);
const brands = ref<Brand[]>([]);

onMounted(async () => {
  try {
    brands.value = await knowledgeApi.getBrands();
  } catch (e) {
    console.error('KH Brand load error:', e);
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
.kh-content-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.kh-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; transition: border-color .2s, box-shadow .2s; }
.kh-card:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(59,130,246,0.08); }
.kh-card-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.kh-card-icon { font-size: 1.3rem; flex-shrink: 0; margin-top: 2px; }
.kh-card-title-group { flex: 1; min-width: 0; }
.kh-card-title { font-size: 1rem; font-weight: 600; color: #111827; margin: 0; }
.kh-card-badge { display: inline-block; font-size: 0.7rem; color: #3b82f6; background: #eff6ff; padding: 2px 8px; border-radius: 4px; margin-top: 4px; }
.kh-card-desc { font-size: 0.82rem; color: #6b7280; line-height: 1.5; margin: 0 0 10px; }
.kh-card-link { font-size: 0.8rem; margin-bottom: 10px; }
.kh-card-link a { color: #3b82f6; text-decoration: none; word-break: break-all; }
.kh-card-link a:hover { text-decoration: underline; }
.kh-card-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.kh-tag { font-size: 0.72rem; color: #374151; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; }
</style>
