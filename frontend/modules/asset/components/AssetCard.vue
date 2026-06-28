<template>
  <div class="asset-card" :style="{ borderLeftColor: cardColor }">
    <!-- Header -->
    <div class="asset-card-header">
      <span class="asset-card-type-badge" :style="{ background: cardColor + '20', color: cardColor }">
        {{ asset.type }}
      </span>
      <span class="asset-card-status" :class="asset.status">
        {{ statusLabel }}
      </span>
      <span v-if="asset.source" class="asset-card-source">{{ asset.source }}</span>
    </div>

    <!-- Title -->
    <h3 class="asset-card-title">{{ asset.title || '未命名' }}</h3>

    <!-- Summary -->
    <p v-if="asset.summary" class="asset-card-summary">{{ truncate(asset.summary, 120) }}</p>
    <p v-else-if="asset.content" class="asset-card-summary">{{ truncate(asset.content, 120) }}</p>

    <!-- Tags -->
    <div v-if="asset.tags && asset.tags.length > 0" class="asset-card-tags">
      <span
        v-for="tag in asset.tags.slice(0, 5)"
        :key="tag.id"
        class="asset-tag"
      >{{ tag.tag }}</span>
      <span v-if="asset.tags.length > 5" class="asset-tag-more">+{{ asset.tags.length - 5 }}</span>
    </div>

    <!-- Footer -->
    <div class="asset-card-footer">
      <span class="asset-card-meta" v-if="asset.sourceUrl">
        🔗 {{ truncate(new URL(asset.sourceUrl).hostname, 30) }}
      </span>
      <span class="asset-card-meta">📅 {{ formatDate(asset.updatedAt) }}</span>
      <span v-if="asset.versions && asset.versions.length > 0" class="asset-card-versions">
        📋 v{{ asset.versions.length }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { UnifiedAsset } from '../types/index'

const props = defineProps<{
  asset: UnifiedAsset
}>()

const TYPE_COLORS: Record<string, string> = {
  Article: '#06b6d4',
  Blog: '#06b6d4',
  News: '#06b6d4',
  FAQ: '#10b981',
  Pricing: '#f59e0b',
  Product: '#8b5cf6',
  Service: '#6366f1',
  Document: '#3b82f6',
  API: '#ef4444',
  Image: '#ec4899',
  Video: '#f43f5e',
  Prompt: '#a855f7',
  Website: '#14b8a6',
  Brand: '#6366f1',
}

const cardColor = computed(() => TYPE_COLORS[props.asset.type] || '#6b7280')

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  }
  return labels[props.asset.status] || props.asset.status
})

function truncate(text: string, len: number): string {
  if (text.length <= len) return text
  return text.slice(0, len) + '...'
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.asset-card {
  background: #11151c; border-radius: 12px; padding: 16px;
  border-left: 3px solid #6b7280; border-top: 1px solid rgba(255,255,255,0.04);
  border-right: 1px solid rgba(255,255,255,0.04);
  border-bottom: 1px solid rgba(255,255,255,0.04);
  cursor: pointer; transition: all 0.15s;
}
.asset-card:hover {
  transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  background: #161c26;
}
.asset-card-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.asset-card-type-badge {
  font-size: 10px; padding: 2px 8px; border-radius: 4px;
  font-weight: 500; letter-spacing: 0.3px;
}
.asset-card-status {
  font-size: 10px; padding: 1px 6px; border-radius: 3px;
  background: rgba(107,114,128,0.1); color: #9ca3af;
}
.asset-card-status.published { background: rgba(52,211,153,0.1); color: #6ee7b7; }
.asset-card-status.archived { background: rgba(239,68,68,0.1); color: #fca5a5; }
.asset-card-source { font-size: 10px; color: #4b5563; }
.asset-card-title {
  font-size: 15px; font-weight: 600; color: #e2e8f0; margin: 0 0 6px;
  line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.asset-card-summary {
  font-size: 12px; color: #6b7280; margin: 0 0 10px; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.asset-card-tags {
  display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;
}
.asset-tag {
  font-size: 10px; background: rgba(99,102,241,0.1); color: #a5b4fc;
  padding: 2px 6px; border-radius: 4px;
}
.asset-tag-more { font-size: 10px; color: #4b5563; }
.asset-card-footer {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  border-top: 1px solid rgba(255,255,255,0.03); padding-top: 10px;
}
.asset-card-meta { font-size: 11px; color: #4b5563; }
.asset-card-versions { font-size: 11px; color: #6366f1; }
</style>
