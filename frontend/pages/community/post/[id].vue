<template>
  <div class="post-detail-page cn-page">
    <!-- 导航栏（中式浅色） -->
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
          <button v-if="!isLoggedIn" class="cn-ink-btn" @click="showLogin = true">登录</button>
          <button v-if="!isLoggedIn" class="cn-seal-btn" @click="showLogin = true; isRegisterMode = true">免费注册</button>
          <template v-else>
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
        <!-- 待审核提示条（仅作者本人可见） -->
        <div v-if="post.status && post.status !== 'approved'" class="pending-banner">
          {{ post.status === 'rejected' ? `⛔ 帖子未通过审核：${post.rejectReason || '不符合社区规范'}` : '⏳ 帖子已提交，等待后台审核通过后公开展示' }}
        </div>
        <!-- 帖子主体 -->
        <article class="post-main cn-card" itemprop="mainEntity" itemscope itemtype="https://schema.org/Article">
          <div class="post-header">
            <div class="post-badges">
              <span v-if="post.isPinned" class="cn-stamp cn-stamp--red">置顶</span>
              <span v-if="post.isEssence" class="cn-stamp cn-stamp--gold">精华</span>
              <span class="badge-category">{{ post.category }}</span>
            </div>
            <h1 class="post-title" :class="{ 'post-title-tipped': (post.giftCount || 0) > 0 }" itemprop="headline">{{ post.title }}</h1>
            <div class="post-meta">
              <span class="meta-author" itemprop="author">👤 {{ post.user?.username || '匿名' }}</span>
              <span>👁️ {{ post.viewCount }}</span>
              <span>👍 {{ post.likeCount }}</span>
              <span>💬 {{ post.commentCount }}</span>
              <span class="meta-time">
                <time itemprop="datePublished" :datetime="post.createdAt">{{ formatTime(post.createdAt) }}</time>
              </span>
            </div>
            <!-- MODERATOR-UX-01.1 版主操作条：仅版主可见（置顶/加精/删帖） -->
            <div v-if="isModerator" class="mod-actions">
              <span class="mod-actions-label">🛡️ 版主操作</span>
              <button class="mod-act-btn" :class="{ 'mod-act-on': post.isPinned }" :disabled="modActionBusy" @click="modAction('pin')">
                {{ post.isPinned ? '取消置顶' : '📌 置顶' }}
              </button>
              <button class="mod-act-btn" :class="{ 'mod-act-on': post.isEssence }" :disabled="modActionBusy" @click="modAction('essence')">
                {{ post.isEssence ? '取消精华' : '⭐ 加精' }}
              </button>
              <button class="mod-act-btn mod-act-del" :disabled="modActionBusy" @click="modAction('delete')">🗑️ 删帖</button>
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

        <!-- COMMUNITY-TIP-01 打赏区：打赏按钮 + 打赏人名单 + 礼物记录 -->
        <section class="tips-section cn-card">
          <div class="tips-header">
            <h2 class="section-title tips-title">🎁 打赏 <span v-if="tipsData.total > 0" class="tips-total">共 {{ tipsData.total }} 次 · {{ tipsData.totalDiamonds }} 钻</span></h2>
            <button class="cn-seal-btn btn-tip" :disabled="tipping" @click="openTipModal">
              {{ tipping ? '赠送中...' : '🎁 打赏楼主' }}
            </button>
          </div>

          <!-- 打赏名单 + 礼物记录 -->
          <div v-if="tipsData.records.length > 0" class="tips-list">
            <div v-for="(t, i) in tipsData.records" :key="i" class="tip-item">
              <span class="tip-avatar clickable" :title="`查看 ${t.senderName} 资料`" @click="openUserCard(t, $event)">{{ t.senderAvatar ? '' : '👤' }}<img v-if="t.senderAvatar" :src="t.senderAvatar" class="tip-avatar-img" /></span>
              <span class="tip-name clickable" :title="`查看 ${t.senderName} 资料`" @click="openUserCard(t, $event)">{{ t.senderName }}</span>
              <span class="tip-gift">送 <span class="tip-gift-icon">{{ t.giftIcon || '🎁' }}</span> {{ t.giftName }} × {{ t.count }}</span>
              <span class="tip-diamonds">{{ t.totalDiamonds }} 钻</span>
              <span class="tip-time">{{ formatTime(t.lastAt) }}</span>
            </div>
          </div>
          <p v-else class="tips-empty">还没有人打赏，喜欢这个帖子就送楼主一份礼物吧～</p>
        </section>

        <!-- COMMUNITY-TIP-01.1 打赏人资料卡（点头像/名字弹出） -->
        <CommunityUserCardPopover ref="userCardRef" @require-login="showLogin = true" />

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
              class="cn-seal-btn"
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
                  class="cn-ink-btn btn-sm"
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

  <!-- COMMUNITY-TIP-01 礼物选择弹窗 -->
  <div v-if="tipModalOpen" class="tip-modal-overlay" @click.self="tipModalOpen = false">
    <div class="tip-modal">
      <div class="tip-modal-header">
        <h3>🎁 打赏楼主</h3>
        <button class="tip-modal-close" @click="tipModalOpen = false">✕</button>
      </div>
      <p class="tip-modal-sub">礼物将直接结算为金币给发帖人（{{ coinsPercent }}% 到账）</p>
      <div v-if="giftLoading" class="tip-gift-loading">加载礼物中...</div>
      <div v-else class="tip-gift-grid">
        <button
          v-for="g in giftList"
          :key="g.id"
          class="tip-gift-item"
          :class="{ 'tip-gift-selected': selectedGiftId === g.id }"
          @click="selectedGiftId = g.id"
        >
          <span class="tip-gift-item-icon" :style="{ background: g.iconGradient || 'linear-gradient(135deg,#fdf3e7,#f5e6d3)' }">{{ g.iconUrl || '🎁' }}</span>
          <span class="tip-gift-item-name">{{ g.name }}</span>
          <span class="tip-gift-item-price">💎 {{ g.priceDiamonds }}</span>
        </button>
      </div>
      <div class="tip-modal-footer">
        <button class="cn-ink-btn" @click="tipModalOpen = false">取消</button>
        <button class="cn-seal-btn" :disabled="!selectedGiftId || tipSending" @click="sendTip">
          {{ tipSending ? '赠送中...' : '确认打赏' }}
        </button>
      </div>
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
const isModerator = ref(false)
const modActionBusy = ref(false)
const isRegisterMode = ref(false)
const showLogin = ref(false)
const authUser = ref<any>(null)
const commentContent = ref('')
const replyContent = ref('')
const replyToId = ref<string | null>(null)
const submitting = ref(false)

// ─── COMMUNITY-TIP-01 打赏状态 ───
const tipModalOpen = ref(false)
const giftList = ref<any[]>([])
const giftLoading = ref(false)
const selectedGiftId = ref('')
const tipSending = ref(false)
const tipping = ref(false)
const coinsPercent = ref(65)
const tipsData = ref<{ total: number; totalDiamonds: number; records: any[] }>({ total: 0, totalDiamonds: 0, records: [] })

// ─── COMMUNITY-TIP-01.1 打赏人资料卡 ───
const userCardRef = ref<any>(null)
function openUserCard(t: any, event: MouseEvent) {
  userCardRef.value?.open({ id: t.senderId, name: t.senderName, avatar: t.senderAvatar || '' }, event)
}

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

// 客户端补救：SSR 无 token 时待审帖会 404 → 挂载后带 token 重试（作者可见自己的待审/被驳帖；管理员可看全部）
onMounted(async () => {
  if (error.value || !post.value) {
    const { getAuthToken } = await import('~/utils/auth/token')
    const token = getAuthToken()
    if (token) {
      try {
        const res = await fetch(`/api/community/posts/${route.params.id}`, {
          headers: { Authorization: `Bearer ${token}`, 'x-admin-token': token },
        })
        const data = await res.json()
        if (data?.post) {
          post.value = data.post
          error.value = null
        }
      } catch { /* 保持原错误 */ }
    }
  }
})

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
function goMemberCenter() { router.push('/user/center') }

// 解析媒体附件（排除 content 已内联渲染的 [img:]/[video:] → 防止同一媒体显示两遍）
const postMedia = computed(() => {
  if (!post.value?.mediaJson) return []
  try {
    const parsed = typeof post.value.mediaJson === 'string'
      ? JSON.parse(post.value.mediaJson)
      : post.value.mediaJson
    const arr = Array.isArray(parsed) ? parsed : []
    if (!arr.length) return []
    // content 内联媒体 URL 集合（正文里已渲染过，附件区不再重复）
    const inlineUrls = new Set<string>()
    const content = post.value?.content || ''
    let m: RegExpExecArray | null
    const imgRe = /\[img:([^\]]+)\]/g
    const vidRe = /\[video:([^\]]+)\]/g
    while ((m = imgRe.exec(content))) if (m[1]) inlineUrls.add(m[1])
    while ((m = vidRe.exec(content))) if (m[1]) inlineUrls.add(m[1])
    return arr.filter((x: any) => !(x?.url && inlineUrls.has(x.url)))
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
  // URL 链接化：先保护已生成标签内的 URL（href/src 属性值），防止二次匹配把 <a href="URL"><img src="URL"/></a> 嵌套损坏
  const tagUrls: string[] = []
  html = html.replace(/((?:href|src)=")(https?:\/\/[^"\s]+)"/g, (_match: string, prefix: string, url: string) => {
    const idx = tagUrls.length
    tagUrls.push(url)
    return `${prefix}\x00TAGURL${idx}\x00"`
  })
  html = html.replace(/(https?:\/\/[^\s<"']+)/g, (_match: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener" class="post-link">${url}</a>`
  })
  html = html.replace(/\x00TAGURL(\d+)\x00/g, (_match: string, idx: string) => tagUrls[parseInt(idx)])
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

// ─── COMMUNITY-TIP-01 打赏逻辑 ───
async function loadTips() {
  try {
    const res = await fetch(`${apiBase}/api/community/posts/${route.params.id}/tips`)
    if (!res.ok) return
    const data = await res.json()
    if (data.success) tipsData.value = data.data
  } catch {}
}

async function openTipModal() {
  if (!isLoggedIn.value) {
    showLogin.value = true
    return
  }
  tipModalOpen.value = true
  selectedGiftId.value = ''
  if (giftList.value.length > 0) return
  giftLoading.value = true
  try {
    const res = await fetch('/api/gifts/products')
    if (!res.ok) throw new Error('加载礼物失败')
    const data = await res.json()
    const groups = data.data?.gifts || []
    giftList.value = groups.flatMap((g: any) => g.items || [])
    coinsPercent.value = data.data?.coinsAwardedPercent || 65
  } catch (err: any) {
    alert(err.message)
  } finally {
    giftLoading.value = false
  }
}

async function sendTip() {
  if (!selectedGiftId.value) return
  tipSending.value = true
  tipping.value = true
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/community/posts/${route.params.id}/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ giftId: selectedGiftId.value }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || data.message || '打赏失败')
    }
    tipModalOpen.value = false
    await loadTips()
    await refresh()
  } catch (err: any) {
    alert(err.message)
  } finally {
    tipSending.value = false
    tipping.value = false
  }
}

async function loadModMe() {
  const token = window.localStorage?.getItem('auth_token') || ''
  if (!token) return
  try {
    const res = await fetch(`/api/community/moderator/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) isModerator.value = !!data.isModerator
  } catch {}
}

// MODERATOR-UX-01.1 版主操作：置顶/加精/删帖（moderatorCheck 鉴权接口）
async function modAction(type: string) {
  if (modActionBusy.value) return
  const token = window.localStorage?.getItem('auth_token') || ''
  if (!token) { showLogin.value = true; return }
  if (type === 'delete' && !confirm('确定删除这篇帖子吗？删除后不可恢复。')) return
  modActionBusy.value = true
  try {
    const url = type === 'delete'
      ? `/api/community/moderator/posts/${route.params.id}`
      : `/api/community/moderator/posts/${route.params.id}/${type}`
    const res = await fetch(url, {
      method: type === 'delete' ? 'DELETE' : 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { alert(data.error || '操作失败'); return }
    if (type === 'delete') { router.push('/community'); return }
    await refresh()
  } finally {
    modActionBusy.value = false
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
  loadTips()
  loadModMe()
})
</script>

<style scoped>
.post-detail-page {
  min-height: 100vh;
  font-family: var(--cn-body);
}

/* === 导航栏（中式浅色） === */
.nav-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(251, 248, 239, 0.88);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(38, 84, 124, 0.14);
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
.nav-logo { display: flex; align-items: center; gap: 8px; }
.logo-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
.nav-logo-img { width: 28px; height: 28px; border-radius: 6px; }
.logo-text {
  font-size: 1.05rem; font-weight: 700; color: var(--cn-cobalt-deep);
  font-family: var(--cn-serif); letter-spacing: 2px;
}
.nav-links { display: flex; gap: 24px; flex: 1; }
.nav-link {
  color: var(--cn-ink-soft); text-decoration: none; font-size: 0.85rem;
  transition: color 0.2s; font-family: var(--cn-serif); letter-spacing: 1px;
}
.nav-link:hover, .nav-link-active { color: var(--cn-cobalt-deep); font-weight: 600; }
.nav-actions { display: flex; align-items: center; gap: 10px; }
.nav-user-badge {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 4px 8px; border-radius: 8px; transition: background 0.2s;
}
.nav-user-badge:hover { background: rgba(38, 84, 124, 0.06); }
.nav-user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 600; color: #fff;
}
.nav-user-avatar--basic { background: #8a8578; }
.nav-user-avatar--standard { background: #3f7fa3; }
.nav-user-avatar--premium { background: #6d5ba6; }
.nav-user-avatar--flagship { background: #b07f2e; }
.nav-user-avatar--ultra { background: linear-gradient(135deg, #b03a2e, #c9732a); }
.nav-tier-tag { font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 500; }
.nav-tier-tag--basic { background: rgba(138,133,120,0.14); color: #8a8578; }
.nav-tier-tag--standard { background: rgba(63,127,163,0.14); color: #3f7fa3; }
.nav-tier-tag--premium { background: rgba(109,91,166,0.14); color: #6d5ba6; }
.nav-tier-tag--flagship { background: rgba(176,127,46,0.14); color: #a87a2c; }
.nav-tier-tag--ultra { background: rgba(176,58,46,0.14); color: #b03a2e; }

@media (max-width: 768px) { .nav-links { display: none; } }

.page-content {
  max-width: 820px;
  margin: 0 auto;
  padding: 24px 24px 60px;
}
.back-link {
  display: inline-block;
  color: var(--cn-cobalt);
  text-decoration: none;
  font-size: 0.85rem;
  margin-bottom: 20px;
  transition: color 0.2s;
  font-family: var(--cn-serif);
  letter-spacing: 1px;
}
.back-link:hover { color: var(--cn-cobalt-deep); }

/* 待审核/被驳回提示条 */
.pending-banner {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 5px;
  font-size: 0.82rem;
  line-height: 1.6;
  background: rgba(176, 127, 46, 0.1);
  border: 1px solid rgba(176, 127, 46, 0.35);
  color: #a87a2c;
  font-family: var(--cn-serif);
  letter-spacing: 0.5px;
}

/* Loading & Error */
.loading-state, .error-state {
  text-align: center;
  padding: 60px 0;
  color: var(--cn-ink-faint);
  font-family: var(--cn-serif);
}
.spinner {
  width: 32px; height: 32px;
  border: 2px solid rgba(38, 84, 124, 0.12);
  border-top-color: var(--cn-celadon-deep);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Post */
.post-main {
  padding: 32px;
  margin-bottom: 24px;
}
.post-header { margin-bottom: 24px; }
.post-badges { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.badge-category {
  font-size: 0.68rem; padding: 2px 10px; border-radius: 3px;
  background: rgba(95, 168, 190, 0.14); color: var(--cn-cobalt-deep);
  font-family: var(--cn-serif); letter-spacing: 1px;
  border: 1px solid rgba(38, 84, 124, 0.16);
}
.post-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--cn-ink);
  margin: 0 0 12px;
  line-height: 1.35;
  font-family: var(--cn-serif);
  letter-spacing: 1px;
}
/* COMMUNITY-TIP-01 被打赏的帖子标题变朱砂色 */
.post-title-tipped { color: var(--cn-cinnabar); }
.post-meta {
  display: flex; gap: 16px; font-size: 0.78rem;
  color: var(--cn-ink-faint); flex-wrap: wrap;
}
.meta-author { color: var(--cn-cobalt); font-family: var(--cn-serif); }
.meta-time { margin-left: auto; }
.mod-actions {
  display: flex; align-items: center; gap: 8px; margin-top: 10px;
  padding: 8px 12px; border: 1px dashed var(--cn-red, #c0392b); border-radius: 8px;
  background: rgba(192, 57, 43, 0.04); flex-wrap: wrap;
}
.mod-actions-label { font-size: 0.75rem; color: #c0392b; font-weight: 600; margin-right: 4px; }
.mod-act-btn {
  font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--cn-ink-line, #d8d0c0); background: #fff; color: var(--cn-ink);
  transition: all 0.2s;
}
.mod-act-btn:hover:not(:disabled) { border-color: var(--cn-cobalt, #3b5b92); color: var(--cn-cobalt, #3b5b92); }
.mod-act-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.mod-act-on { border-color: #c0392b; color: #c0392b; background: rgba(192, 57, 43, 0.06); }
.mod-act-del { border-color: #c0392b; color: #c0392b; }
.mod-act-del:hover:not(:disabled) { background: #c0392b; color: #fff; border-color: #c0392b; }
.post-content {
  font-size: 0.95rem;
  line-height: 1.9;
  color: var(--cn-ink);
}

/* v-html 内部元素使用 :deep() 选择器 */
:deep(.post-link) {
  color: var(--cn-cobalt);
  text-decoration: underline;
  transition: color 0.2s;
}
:deep(.post-link:hover) { color: var(--cn-cobalt-deep); }
:deep(.inline-media) {
  margin: 12px 0;
  max-width: 500px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(38, 84, 124, 0.18);
}
:deep(.inline-img) { width: 100%; display: block; cursor: pointer; transition: opacity 0.2s; }
:deep(.inline-img:hover) { opacity: 0.9; }
:deep(.inline-video) { width: 100%; display: block; max-height: 400px; }

/* ─── Markdown 块级元素（墨色） ─── */
:deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
  color: var(--cn-ink);
  font-weight: 700;
  line-height: 1.35;
  margin: 1.2em 0 0.6em;
  font-family: var(--cn-serif);
}
:deep(h1) { font-size: 1.6rem; border-bottom: 1px solid rgba(38, 84, 124, 0.16); padding-bottom: 8px; }
:deep(h2) { font-size: 1.35rem; border-bottom: 1px solid rgba(38, 84, 124, 0.12); padding-bottom: 6px; }
:deep(h3) { font-size: 1.15rem; }
:deep(h4) { font-size: 1rem; }
:deep(h5) { font-size: 0.9rem; }
:deep(h6) { font-size: 0.85rem; color: var(--cn-ink-soft); }
:deep(p) { margin: 0.4em 0; }
:deep(ul), :deep(ol) { margin: 0.5em 0; padding-left: 1.5em; }
:deep(li) { margin: 0.25em 0; line-height: 1.8; }
:deep(strong) { color: var(--cn-cobalt-deep); font-weight: 700; }
:deep(em) { color: var(--cn-ink-soft); font-style: italic; }
:deep(blockquote) {
  border-left: 3px solid var(--cn-celadon-deep);
  background: rgba(95, 168, 190, 0.08);
  margin: 0.8em 0;
  padding: 8px 16px;
  color: var(--cn-ink-soft);
  border-radius: 0 6px 6px 0;
}
:deep(code) {
  background: rgba(38, 84, 124, 0.06);
  border: 1px solid rgba(38, 84, 124, 0.16);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.85em;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
:deep(pre) {
  background: #2b2b26;
  border: 1px solid rgba(38, 84, 124, 0.18);
  border-radius: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  margin: 1em 0;
}
:deep(pre code) {
  background: none; border: none; padding: 0;
  font-size: 0.85rem; line-height: 1.6;
  color: #e8e4d8;
}

/* 附件媒体 */
.post-media {
  display: flex; flex-wrap: wrap; gap: 12px;
  margin-top: 20px; padding-top: 20px;
  border-top: 1px dashed rgba(38, 84, 124, 0.2);
}
.post-media-item {
  width: 100%; max-width: 500px;
  border-radius: 6px; overflow: hidden;
  border: 1px solid rgba(38, 84, 124, 0.18);
}
.post-media-img { width: 100%; display: block; cursor: pointer; transition: opacity 0.2s; }
.post-media-img:hover { opacity: 0.9; }
.post-media-video { width: 100%; display: block; max-height: 400px; }

/* Comments */
.comments-section { margin-top: 24px; }
.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--cn-cobalt-deep);
  margin: 0 0 20px;
  font-family: var(--cn-serif);
  letter-spacing: 2px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-title::after {
  content: '';
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, rgba(38, 84, 124, 0.25), transparent);
}

.comment-form {
  background: var(--cn-paper-card);
  border: 1px solid rgba(38, 84, 124, 0.22);
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 24px;
}
.comment-input {
  width: 100%; box-sizing: border-box;
  background: rgba(246, 241, 227, 0.7);
  border: 1px solid rgba(38, 84, 124, 0.22);
  border-radius: 5px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: var(--cn-ink);
  outline: none;
  resize: vertical;
  font-family: inherit;
  margin-bottom: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.comment-input:focus {
  border-color: var(--cn-celadon-deep);
  box-shadow: 0 0 0 3px rgba(95, 168, 190, 0.15);
}

.comments-list { display: flex; flex-direction: column; gap: 16px; }
.comment-item {
  background: rgba(251, 248, 239, 0.65);
  border: 1px solid rgba(38, 84, 124, 0.14);
  border-radius: 6px;
  padding: 16px 20px;
}
.comment-header {
  display: flex; gap: 12px; font-size: 0.78rem;
  color: var(--cn-ink-faint); margin-bottom: 8px;
}
.comment-author { color: var(--cn-cobalt); font-family: var(--cn-serif); }
.comment-content {
  font-size: 0.88rem; line-height: 1.7;
  color: var(--cn-ink); margin-bottom: 8px;
}
.comment-actions { display: flex; gap: 12px; }
.action-btn {
  font-size: 0.75rem; cursor: pointer;
  background: none; border: none;
  color: var(--cn-ink-faint);
  padding: 4px 0;
  transition: color 0.2s;
}
.action-btn:hover { color: var(--cn-cobalt); }

.reply-form {
  margin-top: 12px; padding-left: 16px;
  border-left: 2px solid rgba(95, 168, 190, 0.4);
}
.replies-list {
  margin-top: 12px; padding-left: 16px;
  border-left: 1px solid rgba(38, 84, 124, 0.14);
}
.reply-item { padding: 10px 0; border-bottom: 1px dashed rgba(38, 84, 124, 0.1); }
.reply-item:last-child { border-bottom: none; }

.no-comments {
  text-align: center; padding: 40px;
  color: var(--cn-ink-faint);
  font-family: var(--cn-serif);
}

.btn-sm {
  padding: 5px 14px;
  font-size: 0.75rem;
}

/* ─── COMMUNITY-TIP-01 打赏区 ─── */
.tips-section {
  margin-top: 24px;
  padding: 20px 24px;
  background: rgba(95, 168, 190, 0.05);
}
.tips-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 14px; flex-wrap: wrap;
}
.tips-title { font-size: 1rem; margin: 0; }
.tips-total {
  font-size: 0.75rem;
  color: var(--cn-cobalt);
  font-weight: 400;
  margin-left: 6px;
}
.btn-tip { padding: 8px 18px; font-size: 0.8rem; }
.tips-list { display: flex; flex-direction: column; gap: 8px; }
.tip-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  background: rgba(251, 248, 239, 0.8);
  border: 1px solid rgba(38, 84, 124, 0.1);
  border-radius: 4px;
  font-size: 0.8rem;
  flex-wrap: wrap;
}
.tip-avatar {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.9rem; border-radius: 50%;
  background: rgba(95, 168, 190, 0.18);
  overflow: hidden;
}
.tip-avatar.clickable, .tip-name.clickable { cursor: pointer; }
.tip-avatar.clickable:hover, .tip-name.clickable:hover { filter: brightness(1.15); }
.tip-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.tip-name { color: var(--cn-cobalt-deep); font-weight: 600; font-family: var(--cn-serif); }
.tip-gift { color: var(--cn-ink-soft); }
.tip-gift-icon { font-size: 1rem; }
.tip-diamonds { color: var(--cn-gold); font-weight: 600; }
.tip-time { margin-left: auto; color: var(--cn-ink-faint); font-size: 0.7rem; }
.tips-empty {
  font-size: 0.8rem; color: var(--cn-ink-faint);
  text-align: center; padding: 10px 0;
  font-family: var(--cn-serif);
}

/* 礼物选择弹窗（中式） */
.tip-modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(22, 38, 46, 0.55);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.tip-modal {
  width: min(560px, 100%);
  max-height: 80vh; overflow-y: auto;
  background: var(--cn-paper-card);
  border: 1px solid rgba(38, 84, 124, 0.35);
  border-radius: 8px;
  box-shadow: inset 0 0 0 3px rgba(246, 241, 227, 0.9), inset 0 0 0 4px rgba(38, 84, 124, 0.12), 0 18px 50px rgba(22, 38, 46, 0.28);
  padding: 22px;
}
.tip-modal-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;
}
.tip-modal-header h3 { margin: 0; font-size: 1.05rem; color: var(--cn-cobalt-deep); font-family: var(--cn-serif); letter-spacing: 2px; }
.tip-modal-close {
  background: none; border: none;
  color: var(--cn-ink-faint); font-size: 1.1rem; cursor: pointer;
}
.tip-modal-sub { font-size: 0.75rem; color: var(--cn-ink-soft); margin: 0 0 14px; }
.tip-gift-loading { text-align: center; color: var(--cn-ink-faint); padding: 24px 0; }
.tip-gift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}
.tip-gift-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 12px 8px;
  background: rgba(246, 241, 227, 0.6);
  border: 1px solid rgba(38, 84, 124, 0.16);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.tip-gift-item:hover { border-color: var(--cn-cobalt); }
.tip-gift-selected {
  border-color: var(--cn-cinnabar) !important;
  background: rgba(176, 58, 46, 0.06) !important;
  box-shadow: 0 0 0 1px var(--cn-cinnabar);
}
.tip-gift-item-icon { width: 2.4rem; height: 2.4rem; border-radius: 0.6rem; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: inset 0 -4px 8px rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.12); }
.tip-gift-item-name { font-size: 0.72rem; color: var(--cn-ink); font-family: var(--cn-serif); }
.tip-gift-item-price { font-size: 0.68rem; color: var(--cn-gold); }
.tip-modal-footer {
  display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;
}

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
