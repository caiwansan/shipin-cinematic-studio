<template>
  <NuxtLink :to="`/community/post/${post.id}`" class="post-card cn-card">
    <div class="card-header">
      <span v-if="post.isPinned" class="cn-stamp cn-stamp--red">置顶</span>
      <span v-if="post.isEssence" class="cn-stamp cn-stamp--gold">精华</span>
      <span class="category-tag">{{ post.category }}</span>
    </div>
    <h3 class="card-title" :class="{ 'card-title-tipped': (post.giftCount || 0) > 0 }">{{ post.title }}</h3>
    <p class="card-excerpt">{{ excerpt }}</p>
    <div v-if="tagList.length > 0" class="card-tags">
      <span v-for="tag in tagList" :key="tag" class="tag">{{ tag }}</span>
    </div>
    <div class="card-meta">
      <span class="meta-author">👤 {{ post.user?.username || '匿名' }}</span>
      <span class="meta-stat">👁️ {{ post.viewCount }}</span>
      <span class="meta-stat">👍 {{ post.likeCount }}</span>
      <span class="meta-stat">💬 {{ post.commentCount }}</span>
      <span v-if="(post.giftCount || 0) > 0" class="meta-stat tip-stat" title="被打赏">🎁 {{ post.giftCount }}</span>
      <span class="meta-time">{{ timeAgo }}</span>
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
  // 优先用作者摘要（无符号）；否则清洗 markdown 符号后截取
  const raw = (props.post as any).summary?.trim() || props.post.content || ''
  const text = stripMarkdown(raw)
  return text.length > 150 ? text.substring(0, 150) + '...' : text
})

const tagList = computed(() => {
  const tags = props.post.tags || ''
  return tags.split(',').map(t => t.trim()).filter(Boolean)
})

// ─── 时间显示（hydration-safe）───
// SSR 首帧输出时区无关的绝对时间（服务器/客户端完全一致），
// 客户端 onMounted 后切换为相对时间并定时刷新，避免 hydration mismatch。
function formatAbsolute(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  // 用 UTC 组件，避免服务器/客户端时区差异
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

// 初始值：绝对时间（SSR 与客户端 hydration 首帧一致）
const timeAgo = ref<string>(formatAbsolute(props.post.createdAt))

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  // 挂载后切换为相对时间
  timeAgo.value = formatRelative(props.post.createdAt)
  // 每分钟刷新，保持相对时间新鲜
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
  padding: 20px 24px;
  text-decoration: none;
  color: inherit;
}
.card-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.category-tag {
  font-size: 0.68rem;
  padding: 2px 10px;
  border-radius: 3px;
  background: rgba(95, 168, 190, 0.14);
  color: var(--cn-cobalt-deep);
  font-family: var(--cn-serif);
  letter-spacing: 1px;
  border: 1px solid rgba(38, 84, 124, 0.16);
}
.card-title {
  font-size: 1.08rem;
  font-weight: 700;
  color: var(--cn-ink);
  margin: 0 0 8px;
  line-height: 1.45;
  font-family: var(--cn-serif);
  letter-spacing: 0.5px;
}
/* COMMUNITY-TIP-01 被打赏的帖子标题变朱砂色 */
.card-title-tipped {
  color: var(--cn-cinnabar);
}
.tip-stat {
  color: var(--cn-cinnabar) !important;
}
.card-excerpt {
  font-size: 0.83rem;
  color: var(--cn-ink-soft);
  line-height: 1.75;
  margin-bottom: 12px;
}
.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tag {
  font-size: 0.66rem;
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(38, 84, 124, 0.06);
  color: var(--cn-cobalt-soft);
  font-family: var(--cn-serif);
  letter-spacing: 0.5px;
}
.card-meta {
  display: flex;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--cn-ink-faint);
  flex-wrap: wrap;
}
.meta-author {
  color: var(--cn-cobalt);
  font-family: var(--cn-serif);
}
.meta-time {
  margin-left: auto;
}
</style>
