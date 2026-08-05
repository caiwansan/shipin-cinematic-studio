<template>
  <div class="post-detail-page">
    <!-- 导航栏 -->
    <nav class="nav-bar">
      <div class="nav-inner">
        <div class="nav-logo">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="nav-logo-img" /></span>
          <span class="logo-text">昆仑镜</span>
        </div>
        <div class="nav-links">
          <a href="/" class="nav-link">首页</a>
          <a href="/community" class="nav-link nav-link-active">社区</a>
        </div>
        <div class="nav-actions">
          <button v-if="!isLoggedIn" class="btn btn-outline" @click="showLogin = true">登录</button>
          <button v-if="!isLoggedIn" class="btn btn-primary" @click="showLogin = true; isRegisterMode = true">免费注册</button>
          <template v-else>
              <button class="btn btn-primary" @click="goToStudio">进入工作台 →</button>
              <div class="nav-user-badge" @click="goMemberCenter" title="会员中心">
                <div class="nav-user-avatar" :class="`nav-user-avatar--${tierClass}`">
                  {{ avatarChar }}
                </div>
                <span class="nav-tier-tag" :class="`nav-tier-tag--${tierClass}`">
                  {{ tierLabel }}
                </span>
              </div>
            </template>
        </div>
      </div>
    </nav>
    <div class="page-content">
      <NuxtLink to="/community" class="back-link">← 返回社区</NuxtLink>

      <div v-if="pending" class="loading-state">
        <div class="spinner" />
        <p>加载中...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error.value?.message || '加载失败' }}</p>
        <NuxtLink to="/community" class="back-link">返回社区</NuxtLink>
      </div>

      <template v-else-if="post">
        <!-- 帖子主体 -->
        <article class="post-main" itemprop="mainEntity" itemscope itemtype="https://schema.org/Article">
          <div class="post-header">
            <div class="post-badges">
              <span v-if="post.isPinned" class="badge badge-pin">📌 置顶</span>
              <span v-if="post.isEssence" class="badge badge-essence">⭐ 精华</span>
              <span class="badge badge-category">{{ post.category }}</span>
            </div>
            <h1 class="post-title" itemprop="headline">{{ post.title }}</h1>
            <div class="post-meta">
              <span class="meta-author" itemprop="author">👤 {{ post.user?.username || '匿名' }}</span>
              <span>👁️ {{ post.viewCount }}</span>
              <span>👍 {{ post.likeCount }}</span>
              <span>💬 {{ post.commentCount }}</span>
              <span class="meta-time">
                <time itemprop="datePublished" :datetime="post.createdAt">{{ formatTime(post.createdAt) }}</time>
              </span>
            </div>
          </div>

          <div class="post-content" itemprop="articleBody" v-html="renderContent(post.content)" />

          <!-- 附件媒体 -->
          <div v-if="postMedia.length > 0" class="post-media">
            <div v-for="(m, i) in postMedia" :key="i" class="post-media-item">
              <img v-if="m.type === 'image'" :src="m.url" class="post-media-img" @click="previewImage(m.url)" />
              <video v-else :src="m.url" class="post-media-video" controls />
            </div>
          </div>
        </article>

        <!-- 评论区 -->
        <section class="comments-section">
          <h2 class="section-title">评论 ({{ post.commentCount }})</h2>

          <!-- 评论输入 -->
          <div class="comment-form">
            <textarea
              v-model="commentContent"
              placeholder="写下你的评论..."
              rows="3"
              class="comment-input"
            />
            <button
              class="btn btn-primary"
              :disabled="!commentContent.trim() || submitting"
              @click="submitComment"
            >
              {{ submitting ? '提交中...' : '发表评论' }}
            </button>
          </div>

          <!-- 评论列表 -->
          <div v-if="post.comments && post.comments.length > 0" class="comments-list">
            <div v-for="comment in post.comments" :key="comment.id" class="comment-item" itemprop="comment" itemscope itemtype="https://schema.org/Comment">
              <div class="comment-header">
                <span class="comment-author" itemprop="author">👤 {{ comment.user?.username || '匿名' }}</span>
                <span class="comment-time">
                  <time itemprop="dateCreated" :datetime="comment.createdAt">{{ formatTime(comment.createdAt) }}</time>
                </span>
              </div>
              <div class="comment-content" itemprop="text">{{ comment.content }}</div>
              <div class="comment-actions">
                <button class="action-btn" @click="toggleReply(comment.id)">
                  💬 回复 ({{ comment.replies?.length || 0 }})
                </button>
              </div>

              <!-- 回复表单 -->
              <div v-if="replyToId === comment.id" class="reply-form">
                <textarea
                  v-model="replyContent"
                  placeholder="回复..."
                  rows="2"
                  class="comment-input"
                />
                <button
                  class="btn btn-sm"
                  :disabled="!replyContent.trim() || submitting"
                  @click="submitReply(comment.id)"
                >
                  回复
                </button>
              </div>

              <!-- 子回复 -->
              <div v-if="comment.replies && comment.replies.length > 0" class="replies-list">
                <div v-for="reply in comment.replies" :key="reply.id" class="reply-item" itemprop="comment" itemscope itemtype="https://schema.org/Comment">
                  <div class="comment-header">
                    <span class="comment-author" itemprop="author">👤 {{ reply.user?.username || '匿名' }}</span>
                    <span class="comment-time">
                      <time itemprop="dateCreated" :datetime="reply.createdAt">{{ formatTime(reply.createdAt) }}</time>
                    </span>
                  </div>
                  <div class="comment-content" itemprop="text">{{ reply.content }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="no-comments">
            <p>暂无评论，来抢沙发吧！</p>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAsyncData } from '#app'

// SSR 端直连后端（/api/* 是外部 4002 服务）；客户端用相对路径走 nginx
const apiBase = import.meta.server ? (process.env.BACKEND_URL || 'http://127.0.0.1:4002') : ''

const route = useRoute()
const router = useRouter()
const isLoggedIn = ref(false)
const isRegisterMode = ref(false)
const showLogin = ref(false)
const authUser = ref<any>(null)
const commentContent = ref('')
const replyContent = ref('')
const replyToId = ref<string | null>(null)
const submitting = ref(false)

// ─── SSR 数据获取 ───
const { data: post, pending, error, refresh } = await useAsyncData(
  `post-${route.params.id}`,
  async () => {
    const data = await $fetch(`${apiBase}/api/community/posts/${route.params.id}`)
    if (!data || !data.post) throw new Error('帖子不存在或已被删除')
    return data.post
  },
  { lazy: false }
)

// ─── 动态 Meta 标签 ───
const postDescription = computed(() => {
  if (!post.value?.content) return '昆仑镜社区 - AI 短剧制作交流平台'
  const text = post.value.content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!?\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/[#*>`~\[\]()]/g, '')
    .trim()
  return text.length > 160 ? text.substring(0, 160) + '...' : text
})

const postImageUrl = computed(() => {
  if (!post.value?.mediaJson) return 'https://aigc.fushtn.com/logo.png'
  try {
    const media = JSON.parse(post.value.mediaJson)
    if (Array.isArray(media) && media.length > 0 && media[0].type === 'image') {
      return media[0].url
    }
  } catch {}
  return 'https://aigc.fushtn.com/logo.png'
})

const postUrl = computed(() => `https://aigc.fushtn.com/community/post/${route.params.id}`)

useHead({
  title: post.value ? `${post.value.title} - 昆仑镜社区` : '帖子详情 - 昆仑镜社区',
  meta: [
    { name: 'description', content: postDescription },
    // Open Graph
    { property: 'og:title', content: post.value?.title || '昆仑镜社区' },
    { property: 'og:description', content: postDescription },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: postUrl },
    { property: 'og:image', content: postImageUrl },
    { property: 'og:site_name', content: '昆仑镜' },
    { property: 'article:published_time', content: post.value?.createdAt || '' },
    { property: 'article:modified_time', content: post.value?.updatedAt || post.value?.createdAt || '' },
    { property: 'article:section', content: post.value?.category || '社区' },
    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: post.value?.title || '昆仑镜社区' },
    { name: 'twitter:description', content: postDescription },
    { name: 'twitter:image', content: postImageUrl },
  ],
  link: [
    { rel: 'canonical', href: postUrl },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.value?.title || '',
        description: postDescription.value,
        image: postImageUrl.value,
        datePublished: post.value?.createdAt || '',
        dateModified: post.value?.updatedAt || post.value?.createdAt || '',
        author: {
          '@type': 'Person',
          name: post.value?.user?.username || '匿名',
        },
        publisher: {
          '@type': 'Organization',
          name: '昆仑镜',
          logo: {
            '@type': 'ImageObject',
            url: 'https://aigc.fushtn.com/logo.png',
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': postUrl.value,
        },
        interactionStatistic: [
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/CommentAction',
            userInteractionCount: post.value?.commentCount || 0,
          },
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: post.value?.likeCount || 0,
          },
        ],
      }),
    },
  ],
})

// ─── 客户端-only 逻辑 ───
const tierClass = computed(() => {
  const coins = authUser.value?.coins ?? 0
  if (coins >= 10000) return 'ultra'
  if (coins >= 5000) return 'flagship'
  if (coins >= 1000) return 'premium'
  if (coins >= 500) return 'standard'
  return 'basic'
})
const tierLabel = computed(() => {
  const map: Record<string, string> = { ultra: '至尊', flagship: '旗舰', premium: '高级', standard: '标准', basic: '基础' }
  return map[tierClass.value] || '基础'
})
const avatarChar = computed(() => {
  return (authUser.value?.username || authUser.value?.email || 'U').charAt(0).toUpperCase()
})
function goToStudio() { router.push('/studio/v2') }
function goMemberCenter() { router.push('/user/center') }

// 解析媒体附件
const postMedia = computed(() => {
  if (!post.value?.mediaJson) return []
  try {
    const parsed = typeof post.value.mediaJson === 'string'
      ? JSON.parse(post.value.mediaJson)
      : post.value.mediaJson
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
})

function previewImage(url: string) {
  window.open(url, '_blank')
}

// ─── HTML 净化 ───
const SAFE_TAGS = new Set(['a','img','video','source','br','p','b','i','strong','em','ul','ol','li','div','span','h1','h2','h3','h4','h5','h6','pre','code','blockquote'])
const SAFE_ATTR = new Set(['href','src','target','rel','class','controls','alt','title','width','height','loading','preload'])
const DANGEROUS_ATTR_PREFIX = /^on/i

function sanitizeHtml(html: string): string {
  if (!html) return ''
  if (typeof document === 'undefined') return html
  const div = document.createElement('div')
  div.innerHTML = html
  function clean(node: Element): void {
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase()
      if (!SAFE_TAGS.has(tag)) {
        const fragment = document.createDocumentFragment()
        while (node.firstChild) fragment.appendChild(node.firstChild)
        node.parentNode?.replaceChild(fragment, node)
        return
      }
      for (let i = node.attributes.length - 1; i >= 0; i--) {
        const attrName = node.attributes[i].name.toLowerCase()
        const attrVal = node.attributes[i].value
        if (!SAFE_ATTR.has(attrName) || DANGEROUS_ATTR_PREFIX.test(attrName) || attrVal.trim().startsWith('javascript:')) {
          node.removeAttribute(attrName)
        }
      }
    }
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes[i]
      if (child.nodeType === 1) clean(child as Element)
    }
  }
  for (let i = div.childNodes.length - 1; i >= 0; i--) {
    const child = div.childNodes[i]
    if (child.nodeType === 1) clean(child as Element)
  }
  return div.innerHTML
}

// ─── Markdown 渲染 ───
function renderContent(text: string): string {
  if (!text) return ''
  const codeBlocks: string[] = []
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match: string, lang: string, code: string) => {
    const idx = codeBlocks.length
    const langClass = lang ? ` language-${lang}` : ''
    codeBlocks.push(`<pre><code class="${langClass}">${escapeHtml(code.trim())}</code></pre>`)
    return `\x00CODEBLOCK${idx}\x00`
  })
  const inlineCodes: string[] = []
  text = text.replace(/`([^`]+)`/g, (_match: string, code: string) => {
    const idx = inlineCodes.length
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`)
    return `\x00INLINECODE${idx}\x00`
  })
  const lines = text.split('\n')
  const blocks: string[] = []
  let inList = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { if (inList) { blocks.push('</ul>'); inList = false } continue }
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      if (inList) { blocks.push('</ul>'); inList = false }
      const level = headerMatch[1].length
      blocks.push(`<h${level}>${headerMatch[2]}</h${level}>`)
      continue
    }
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (ulMatch) {
      if (!inList) { blocks.push('<ul>'); inList = true }
      blocks.push(`<li>${ulMatch[1]}</li>`)
      continue
    }
    const quoteMatch = trimmed.match(/^>\s*(.*)$/)
    if (quoteMatch) {
      if (inList) { blocks.push('</ul>'); inList = false }
      blocks.push(`<blockquote>${quoteMatch[1]}</blockquote>`)
      continue
    }
    if (inList) { blocks.push('</ul>'); inList = false }
    blocks.push(`<p>${line}</p>`)
  }
  if (inList) blocks.push('</ul>')
  let html = blocks.join('\n')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/\x00INLINECODE(\d+)\x00/g, (_match: string, idx: string) => inlineCodes[parseInt(idx)])
  html = html.replace(/\x00CODEBLOCK(\d+)\x00/g, (_match: string, idx: string) => codeBlocks[parseInt(idx)])
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match: string, alt: string, url: string) => {
    return `<div class="inline-media"><img src="${url}" alt="${alt}" class="inline-img" loading="lazy" /></div>`
  })
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match: string, linkText: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener" class="post-link">${linkText}</a>`
  })
  html = html.replace(/\[img:([^\]]+)\]/g, (_match: string, url: string) => {
    return `<div class="inline-media"><a href="${url}" target="_blank" rel="noopener" class="post-link"><img src="${url}" class="inline-img" loading="lazy" /></a></div>`
  })
  html = html.replace(/\[video:([^\]]+)\]/g, (_match: string, url: string) => {
    return `<div class="inline-media"><video src="${url}" class="inline-video" controls preload="none"></video></div>`
  })
  html = html.replace(/(https?:\/\/[^\s<]+)/g, (_match: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener" class="post-link">${url}</a>`
  })
  return sanitizeHtml(html)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── 评论交互 ───
function toggleReply(commentId: string) {
  replyToId.value = replyToId.value === commentId ? null : commentId
  replyContent.value = ''
}

async function submitComment() {
  if (!commentContent.value.trim()) return
  submitting.value = true
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/community/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ postId: route.params.id, content: commentContent.value.trim() }),
    })
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || '提交失败') }
    commentContent.value = ''
    await refresh()
  } catch (err: any) {
    alert(err.message)
  } finally {
    submitting.value = false
  }
}

async function submitReply(parentId: string) {
  if (!replyContent.value.trim()) return
  submitting.value = true
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/community/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ postId: route.params.id, content: replyContent.value.trim(), parentId }),
    })
    if (!res.ok) { const data = await res.json(); throw new Error(data.error || '提交失败') }
    replyContent.value = ''
    replyToId.value = null
    await refresh()
  } catch (err: any) {
    alert(err.message)
  } finally {
    submitting.value = false
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  // 固定 UTC pad 格式：服务器（UTC+8）与客户端浏览器（可能任何时区）输出完全一致，避免 hydration mismatch
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

onMounted(() => {
  const token = window.localStorage?.getItem('auth_token') || ''
  isLoggedIn.value = !!token
  try {
    const authUserRaw = window.localStorage?.getItem('auth_user')
    if (authUserRaw) { try { authUser.value = JSON.parse(authUserRaw) } catch {} }
  } catch {}
})
</script>

<style scoped>
.post-detail-page {
  min-height: 100vh;
  background: #050508;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* === 导航栏 === */
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(5,5,8,0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 32px;
}
.nav-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-logo-img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}
.logo-text {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}
.nav-links {
  display: flex;
  gap: 24px;
  flex: 1;
}
.nav-link {
  color: rgba(255,255,255,0.5);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.2s;
}
.nav-link:hover, .nav-link-active {
  color: rgba(255,255,255,0.8);
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nav-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}
.nav-user-badge:hover {
  background: rgba(255,255,255,0.04);
}
.nav-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
}
.nav-user-avatar--basic { background: #6b7280; }
.nav-user-avatar--standard { background: #3b82f6; }
.nav-user-avatar--premium { background: #8b5cf6; }
.nav-user-avatar--flagship { background: #f59e0b; }
.nav-user-avatar--ultra { background: linear-gradient(135deg, #f97316, #ef4444); }
.nav-tier-tag {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.nav-tier-tag--basic { background: rgba(107,114,128,0.15); color: #9ca3af; }
.nav-tier-tag--standard { background: rgba(59,130,246,0.15); color: #60a5fa; }
.nav-tier-tag--premium { background: rgba(139,92,246,0.15); color: #a78bfa; }
.nav-tier-tag--flagship { background: rgba(245,158,11,0.15); color: #fbbf24; }
.nav-tier-tag--ultra { background: rgba(249,115,22,0.15); color: #fb923c; }
.btn-outline {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}
.btn-outline:hover {
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}

@media (max-width: 768px) {
  .nav-links { display: none; }
}

.page-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 24px 60px;
}
.back-link {
  display: inline-block;
  color: rgba(249,115,22,0.6);
  text-decoration: none;
  font-size: 0.85rem;
  margin-bottom: 20px;
  transition: color 0.2s;
}
.back-link:hover {
  color: #f97316;
}

/* Loading & Error */
.loading-state, .error-state {
  text-align: center;
  padding: 60px 0;
  color: rgba(255,255,255,0.3);
}
.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255,255,255,0.05);
  border-top-color: #f97316;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Post */
.post-main {
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 32px;
}
.post-header { margin-bottom: 24px; }
.post-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.badge {
  font-size: 0.65rem;
  padding: 2px 10px;
  border-radius: 6px;
  font-weight: 600;
}
.badge-pin { background: rgba(249,115,22,0.1); color: #f97316; }
.badge-essence { background: rgba(250,204,21,0.1); color: #eab308; }
.badge-category { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4); }
.post-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px;
  line-height: 1.3;
}
.post-meta {
  display: flex;
  gap: 16px;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.25);
  flex-wrap: wrap;
}
.meta-author { color: rgba(249,115,22,0.6); }
.meta-time { margin-left: auto; }
.post-content {
  font-size: 0.95rem;
  line-height: 1.8;
  color: rgba(255,255,255,0.7);
  white-space: normal;
}

/* v-html 内部元素使用 :deep() 选择器
 * scoped 样式默认不作用于 v-html 动态插入的内容，
 * 必须用 :deep() 穿透才能渲染帖子内的图片、视频、链接样式 */
:deep(.post-link) {
  color: #60a5fa;
  text-decoration: underline;
  transition: color 0.2s;
}
:deep(.post-link:hover) { color: #93c5fd; }
:deep(.inline-media) {
  margin: 12px 0;
  max-width: 500px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.04);
}
:deep(.inline-img) {
  width: 100%;
  display: block;
  cursor: pointer;
  transition: opacity 0.2s;
}
:deep(.inline-img:hover) { opacity: 0.9; }
:deep(.inline-video) {
  width: 100%;
  display: block;
  max-height: 400px;
}

/* ─── Markdown 块级元素 ─── */
:deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
  color: #fff;
  font-weight: 700;
  line-height: 1.3;
  margin: 1.2em 0 0.6em;
}
:deep(h1) { font-size: 1.6rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; }
:deep(h2) { font-size: 1.35rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; }
:deep(h3) { font-size: 1.15rem; }
:deep(h4) { font-size: 1rem; }
:deep(h5) { font-size: 0.9rem; }
:deep(h6) { font-size: 0.85rem; color: rgba(255,255,255,0.6); }
:deep(p) { margin: 0.4em 0; }
:deep(ul), :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
:deep(li) {
  margin: 0.25em 0;
  line-height: 1.7;
}
:deep(strong) { color: #fff; font-weight: 600; }
:deep(em) { color: rgba(255,255,255,0.75); font-style: italic; }
:deep(blockquote) {
  border-left: 3px solid rgba(249,115,22,0.4);
  background: rgba(249,115,22,0.04);
  margin: 0.8em 0;
  padding: 8px 16px;
  color: rgba(255,255,255,0.6);
  border-radius: 0 8px 8px 0;
}
:deep(code) {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.85em;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
:deep(pre) {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 16px 20px;
  overflow-x: auto;
  margin: 1em 0;
}
:deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.85rem;
  line-height: 1.6;
}

/* 附件媒体 */
.post-media {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.post-media-item {
  width: 100%;
  max-width: 500px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.04);
}
.post-media-img {
  width: 100%;
  display: block;
  cursor: pointer;
  transition: opacity 0.2s;
}
.post-media-img:hover { opacity: 0.9; }
.post-media-video {
  width: 100%;
  display: block;
  max-height: 400px;
}

/* 内联媒体样式已移至上方 :deep() 选择器中 */

/* Comments */
.comments-section { margin-top: 24px; }
.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 20px;
}

.comment-form {
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}
.comment-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
  outline: none;
  resize: vertical;
  font-family: inherit;
  margin-bottom: 12px;
}
.comment-input:focus {
  border-color: rgba(249,115,22,0.4);
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.comment-item {
  background: rgba(255,255,255,0.01);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 16px 20px;
}
.comment-header {
  display: flex;
  gap: 12px;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.25);
  margin-bottom: 8px;
}
.comment-author { color: rgba(249,115,22,0.5); }
.comment-content {
  font-size: 0.88rem;
  line-height: 1.6;
  color: rgba(255,255,255,0.65);
  margin-bottom: 8px;
}
.comment-actions {
  display: flex;
  gap: 12px;
}
.action-btn {
  font-size: 0.75rem;
  cursor: pointer;
  background: none;
  border: none;
  color: rgba(255,255,255,0.25);
  padding: 4px 0;
  transition: color 0.2s;
}
.action-btn:hover { color: rgba(249,115,22,0.6); }

.reply-form {
  margin-top: 12px;
  padding-left: 16px;
  border-left: 2px solid rgba(249,115,22,0.15);
}
.replies-list {
  margin-top: 12px;
  padding-left: 16px;
  border-left: 1px solid rgba(255,255,255,0.04);
}
.reply-item {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.02);
}
.reply-item:last-child { border-bottom: none; }

.no-comments {
  text-align: center;
  padding: 40px;
  color: rgba(255,255,255,0.3);
}

.btn {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-primary {
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-sm {
  padding: 6px 14px;
  font-size: 0.75rem;
  background: rgba(249,115,22,0.1);
  color: #f97316;
  border: 1px solid rgba(249,115,22,0.2);
}
.btn-sm:hover { background: rgba(249,115,22,0.15); }

/* ─── 移动端适配 ─── */
@media (max-width: 768px) {
  .post-main { padding: 20px; }
  .post-title { font-size: 1.2rem; }
  .post-meta { gap: 10px; }
  .meta-time { margin-left: 0; width: 100%; }
  .comment-form { padding: 12px; }
  .comment-item { padding: 12px 14px; }
  .replies-list, .reply-form { padding-left: 10px; }
}
</style>
