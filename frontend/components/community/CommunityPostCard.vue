<template>
  <NuxtLink :to="`/community/post/${post.id}`" class="post-card cn-card">
    <!-- 顶部辉光线 -->
    <div class="card-top-glow" />
    
    <div class="card-body">
      <div class="card-header">
        <div class="card-header-left">
          <span v-if="post.isPinned" class="cn-stamp cn-stamp--blue">📌 PINNED</span>
          <span v-if="post.isEssence" class="cn-stamp cn-stamp--gold">✦ ESSENCE</span>
          <span class="category-tag">{{ post.category }}</span>
        </div>
        <span v-if="(post as any).hotScore" class="hot-badge" :title="hotTip">
          🔥 {{ Number((post as any).hotScore).toFixed(1) }}
        </span>
      </div>
      
      <h3 class="card-title" :class="{ 'card-title-tipped': (post.giftCount || 0) > 0 }">
        {{ post.title }}
      </h3>
      <p class="card-excerpt">{{ excerpt }}</p>
      
      <div v-if="tagList.length > 0" class="card-tags">
        <span v-for="tag in tagList" :key="tag" class="tag">#{{ tag }}</span>
      </div>
      
      <div class="card-footer">
        <div class="card-author">
          <span class="author-avatar">{{ (post.user?.username || 'U').charAt(0).toUpperCase() }}</span>
          <span class="author-name">{{ post.user?.username || '匿名' }}</span>
        </div>
        <div class="card-stats">
          <span class="stat" title="浏览">👁 {{ post.viewCount }}</span>
          <span class="stat" title="点赞">👍 {{ post.likeCount }}</span>
          <span class="stat" title="评论">💬 {{ post.commentCount }}</span>
          <span v-if="(post.giftCount || 0) > 0" class="stat stat-tipped" title="打赏">🎁 {{ post.giftCount }}</span>
          <span class="stat-time">{{ timeAgo }}</span>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { stripMarkdown } from '~/utils/markdown'

const props = defineProps<{
  post: {
    id: string
    title: string
    content: string
    tags?: string
    category: string
    viewCount: number
    likeCount: number
    commentCount: number
    favoriteCount?: number
    shareCount?: number
    giftCount?: number
    isPinned?: boolean
    isEssence?: boolean
    createdAt: string
    user?: {
      id: string
      username: string
    }
  }
}>()

const excerpt = computed(() => {
  const raw = (props.post as any).summary?.trim() || props.post.content || ''
  const text = stripMarkdown(raw)
  return text.length > 150 ? text.substring(0, 150) + '...' : text
})

const tagList = computed(() => {
  const tags = props.post.tags || ''
  return tags.split(',').map(t => t.trim()).filter(Boolean)
})

const hotTip = computed(() => {
  const h = (props.post as any).hotBreakdown
  if (!h) return ''
  const f = (n: number) => (Number(n) || 0).toFixed(2)
  return [
    `🔥 热力值 ${Number((props.post as any).hotScore).toFixed(2)}`,
    `打赏 ${f(h.giftScore)} · 点赞 ${f(h.likeScore)} · 评论 ${f(h.commentScore)}`,
    `转发 ${f(h.shareScore)} · 收藏 ${f(h.favoriteScore)}`,
    `时间衰减 ×1/${f(h.decayFactor)}${h.newPostBoost > 1 ? ' · 新帖红利 ×' + f(h.newPostBoost) : ''}`,
    `（对数缩放防霸榜 · 打赏信号最强）`,
  ].join('\n')
})

function formatAbsolute(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

function formatRelative(iso: string) {
  const now = Date.now()
  const created = new Date(iso).getTime()
  const diff = now - created
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  return `${months}个月前`
}

const timeAgo = ref<string>(formatAbsolute(props.post.createdAt))

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timeAgo.value = formatRelative(props.post.createdAt)
  timer = setInterval(() => {
    timeAgo.value = formatRelative(props.post.createdAt)
  }, 60000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.post-card {
  display: block;
  padding: 0;
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  position: relative;
  animation: sf-rise 0.5s var(--ease-out-expo) both;
}

/* 标题 hover 渐变（顶级质感） */
.card-title {
  transition: color var(--duration-normal) var(--ease-out-expo), text-shadow var(--duration-normal);
}
.post-card:hover .card-title:not(.card-title-tipped) {
  color: var(--sf-cyan-bright);
  text-shadow: 0 0 18px var(--sf-cyan-glow);
}

/* 顶部辉光线 */
.card-top-glow {
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--sf-cyan), var(--sf-purple), transparent);
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out-expo);
}
.post-card:hover .card-top-glow {
  opacity: 1;
}

.card-body {
  padding: 20px 24px;
}

.card-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.card-header-left {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.category-tag {
  font-family: var(--sf-mono);
  font-size: 0.62rem;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--sf-cyan-subtle);
  color: var(--sf-cyan);
  border: 1px solid var(--sf-border-subtle);
  text-transform: uppercase;
}

.hot-badge {
  font-family: var(--sf-mono);
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--sf-gold);
  background: var(--sf-gold-glow);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.2);
  flex-shrink: 0;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--sf-text-primary);
  margin: 0 0 8px;
  line-height: 1.5;
}
.card-title-tipped {
  color: var(--sf-magenta);
}

.card-excerpt {
  font-size: 0.82rem;
  color: var(--sf-text-secondary);
  line-height: 1.75;
  margin-bottom: 14px;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.tag {
  font-family: var(--sf-mono);
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(168, 85, 247, 0.08);
  color: var(--sf-purple-bright);
  border: 1px solid rgba(168, 85, 247, 0.15);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 1px solid var(--sf-border-subtle);
}

.card-author {
  display: flex;
  align-items: center;
  gap: 8px;
}
.author-avatar {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--sf-cyan-deep), var(--sf-purple-deep));
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.author-name {
  font-size: 0.78rem;
  color: var(--sf-text-secondary);
  font-weight: 500;
}

.card-stats {
  display: flex;
  gap: 12px;
  font-size: 0.72rem;
  color: var(--sf-text-tertiary);
  flex-wrap: wrap;
}
.stat {
  display: flex;
  align-items: center;
  gap: 3px;
}
.stat-tipped {
  color: var(--sf-magenta);
}
.stat-time {
  font-family: var(--sf-mono);
  font-size: 0.65rem;
  opacity: 0.6;
}
</style>
