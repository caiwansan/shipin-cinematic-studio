<template>
  <NuxtLink :to="`/community/post/${post.id}`" class="post-card">
    <div class="post-card-header">
      <span class="post-card-title">{{ post.title }}</span>
      <span v-if="post.isPinned" class="badge">📌</span>
      <span v-if="post.isEssence" class="badge">⭐</span>
    </div>
    <div class="post-card-excerpt">{{ excerpt }}</div>
    <div class="post-card-meta">
      <span>👤 {{ post.user?.username || '匿名' }}</span>
      <span>👁️ {{ post.viewCount }}</span>
      <span>💬 {{ post.commentCount }}</span>
      <span>👍 {{ post.likeCount }}</span>
      <span class="post-card-time">{{ formatTime(post.createdAt) }}</span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  post: any
}>()

const excerpt = computed(() => {
  const text = props.post.content || ''
  const clean = text.replace(/\[video:[^\]]+\]/g, '[视频]').replace(/\[img:[^\]]+\]/g, '[图片]').replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1').replace(/[#*>`~]/g, '').trim()
  return clean.length > 120 ? clean.substring(0, 120) + '...' : clean
})

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.post-card {
  display: block;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 16px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}
.post-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}
.post-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.post-card-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e0e0e0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  font-size: 0.75rem;
  flex-shrink: 0;
}
.post-card-excerpt {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.post-card-meta {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}
.post-card-time {
  margin-left: auto;
}
</style>
