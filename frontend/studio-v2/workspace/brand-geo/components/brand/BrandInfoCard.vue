<template>
  <div class="geo-card">
    <div class="geo-card-header">
      <h3 class="geo-card-title">{{ brand.name }}</h3>
      <span :class="['geo-status-badge', `geo-status--${brand.status}`]">{{ brand.status }}</span>
    </div>
    <div class="geo-card-body">
      <div class="geo-info-grid">
        <div class="geo-info-item">
          <span class="geo-info-label">行业</span>
          <span class="geo-info-value">{{ brand.industry || '-' }}</span>
        </div>
        <div class="geo-info-item">
          <span class="geo-info-label">语言</span>
          <span class="geo-info-value">{{ brand.language || 'zh' }}</span>
        </div>
        <div class="geo-info-item">
          <span class="geo-info-label">官网</span>
          <span class="geo-info-value">{{ setting?.website || '-' }}</span>
        </div>
        <div class="geo-info-item">
          <span class="geo-info-label">地区</span>
          <span class="geo-info-value">{{ setting?.region || '-' }}</span>
        </div>
        <div class="geo-info-item" v-if="setting?.description">
          <span class="geo-info-label">描述</span>
          <span class="geo-info-value">{{ setting.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BrandItem, BrandSetting } from './types'

defineProps<{
  brand: BrandItem
  setting: BrandSetting | null
}>()
</script>

<style scoped>
.geo-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 16px; overflow: hidden; }
.geo-card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-card-title { margin: 0; font-size: 15px; font-weight: 600; color: #e0e0e0; }
.geo-card-body { padding: 16px 20px; }
.geo-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-status--active { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-status--draft { background: rgba(156,163,175,0.15); color: #9ca3af; }
.geo-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.geo-info-item { }
.geo-info-label { display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
.geo-info-value { font-size: 14px; color: #e0e0e0; }
</style>
