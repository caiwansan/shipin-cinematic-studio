<template>
  <div class="new-post-page cn-page">
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
              <div class="nav-user-avatar" :class="`nav-user-avatar--${tierClass}`">{{ avatarChar }}</div>
              <span class="nav-tier-tag" :class="`nav-tier-tag--${tierClass}`">{{ tierLabel }}</span>
            </div>
          </template>
        </div>
      </div>
    </nav>

    <div class="page-content">
      <NuxtLink to="/community" class="back-link">← 返回社区</NuxtLink>

      <div class="form-card cn-card">
        <h1 class="form-title">发布新帖子</h1>
        <p class="form-desc">分享你的 AI 创作、技巧或疑问</p>
        <p class="form-tip">💎 每日限发 <b>{{ dailyLimit }}</b> 篇 · 审核通过奖励 <b>{{ rewardDiamonds }}</b> 钻石</p>

        <form @submit.prevent="submitPost" class="post-form">
          <div class="form-group">
            <label>标题</label>
            <input v-model="title" type="text" placeholder="给你的帖子起个标题" class="form-input" maxlength="100" />
          </div>

          <div class="form-group">
            <label>分类</label>
            <select v-model="category" class="form-select">
              <option value="">选择分类...</option>
              <option v-for="cat in categories" :key="cat.slug" :value="cat.slug">{{ cat.icon || '#' }} {{ cat.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>内容</label>
            <div class="content-editor-area">
              <textarea
                ref="contentTextarea"
                v-model="content"
                placeholder="写下你的内容...&#10;&#10;点击下方按钮插入图片或视频，标记会出现在光标位置或末尾"
                rows="10"
                class="form-textarea"
              />
              <div class="content-toolbar">
                <button class="cn-ink-btn btn-tool" @click.prevent="$refs.imageInput.click()">
                  📷 插入图片
                </button>
                <button class="cn-ink-btn btn-tool" @click.prevent="$refs.videoInput.click()">
                  🎥 插入视频
                </button>
                <span v-if="uploadingText" class="upload-status">{{ uploadingText }}</span>
                <input ref="imageInput" type="file" accept="image/*" style="display:none" @change="onFileChange($event, 'image')" />
                <input ref="videoInput" type="file" accept="video/*" style="display:none" @change="onFileChange($event, 'video')" />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>标签（可选，逗号分隔）</label>
            <input v-model="tags" type="text" placeholder="如: AI, 短剧, 角色设计" class="form-input" />
          </div>

          <p v-if="error" class="form-error">{{ error }}</p>

          <div class="form-actions">
            <NuxtLink to="/community" class="cn-ink-btn">取消</NuxtLink>
            <button type="submit" class="cn-seal-btn" :disabled="!title.trim() || !content.trim() || submitting">
              {{ submitting ? '发布中...' : '发布帖子' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 登录 Modal（中式） -->
    <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
      <div class="modal-card">
        <button class="modal-close" @click="showLogin = false">✕</button>
        <div class="modal-header">
          <img src="/logo.png" alt="" class="modal-logo" />
          <h2>{{ isRegisterMode ? '创建账号' : '登录' }}</h2>
        </div>
        <div class="modal-body">
          <div class="input-group"><input v-model="authEmail" type="email" placeholder="邮箱" class="modal-input" /></div>
          <div v-if="isRegisterMode" class="input-group"><input v-model="authName" type="text" placeholder="用户名" class="modal-input" /></div>
          <div class="input-group"><input v-model="authPassword" type="password" placeholder="密码" class="modal-input" /></div>
          <p v-if="authError" class="auth-error">{{ authError }}</p>
          <button class="cn-seal-btn modal-btn" :disabled="authLoading" @click="doAuth">{{ authLoading ? '处理中...' : (isRegisterMode ? '注册' : '登录') }}</button>
          <p class="modal-switch" @click="isRegisterMode = !isRegisterMode">{{ isRegisterMode ? '已有账号？去登录' : '没有账号？去注册' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAsyncData } from '#app'

// SSR 端直连后端（/api/* 是外部 4002 服务）；客户端用相对路径走 nginx
const apiBase = import.meta.server ? (process.env.BACKEND_URL || 'http://127.0.0.1:4002') : ''

const router = useRouter()
const isLoggedIn = ref(false)
const isRegisterMode = ref(false)
const showLogin = ref(false)
const authUser = ref<any>(null)
const authEmail = ref('')
const authName = ref('')
const authPassword = ref('')
const authError = ref('')
const authLoading = ref(false)

const title = ref('')
const content = ref('')
const category = ref('')
const tags = ref('')
const error = ref('')
const submitting = ref(false)

// 社区发帖规则（SystemConfig 后台可调：每日上限/每篇奖励钻石）
const dailyLimit = ref(20)
const rewardDiamonds = ref(2)
async function loadPostRules() {
  try {
    const res = await fetch('/api/system/config')
    if (!res.ok) return
    const cfg = await res.json()
    dailyLimit.value = Math.max(1, Number(cfg?.community_daily_post_limit || 20) || 20)
    rewardDiamonds.value = Math.max(1, Number(cfg?.community_post_reward_diamonds || 2) || 2)
  } catch { /* 配置加载失败用默认值 */ }
}

// ─── SSR 数据获取 ───
const { data: categoriesData } = await useAsyncData('community-categories-new', async () => {
  const res = await $fetch(`${apiBase}/api/community/categories`)
  return (res.categories || []) as Array<{ slug: string; name: string; icon?: string }>
})

const categories = computed(() => categoriesData.value || [])

// ─── 动态 Meta ───
useHead({
  title: '发布帖子 - 昆仑镜社区',
  meta: [
    { name: 'description', content: '在昆仑镜社区发布新帖子，分享你的 AI 短剧创作经验、技巧或疑问。' },
    { property: 'og:title', content: '发布帖子 - 昆仑镜社区' },
    { property: 'og:description', content: '在昆仑镜社区发布新帖子，分享你的 AI 短剧创作经验、技巧或疑问。' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://aigc.fushtn.com/community/new' },
    { property: 'og:image', content: 'https://aigc.fushtn.com/logo.png' },
  ],
  link: [
    { rel: 'canonical', href: 'https://aigc.fushtn.com/community/new' },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: '发布帖子 - 昆仑镜社区',
        description: '在昆仑镜社区发布新帖子',
        url: 'https://aigc.fushtn.com/community/new',
        isPartOf: {
          '@type': 'WebSite',
          name: '昆仑镜',
          url: 'https://aigc.fushtn.com',
        },
      }),
    },
  ],
})

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

const contentTextarea = ref<HTMLTextAreaElement | null>(null)
const uploadingText = ref('')

function goMemberCenter() { router.push('/user/center') }

async function doAuth() {
  authError.value = ''
  if (!authEmail.value || !authPassword.value) { authError.value = '请输入邮箱和密码'; return }
  if (isRegisterMode.value && !authName.value.trim()) { authError.value = '请输入用户名'; return }
  authLoading.value = true
  try {
    const url = isRegisterMode.value ? '/api/auth/register' : '/api/auth/login'
    const body: any = isRegisterMode.value
      ? { username: authName.value, email: authEmail.value, password: authPassword.value, code: '' }
      : { email: authEmail.value, password: authPassword.value }
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '操作失败')
    const token = data.accessToken || data.token
    if (token) {
      const { setToken, setUser } = await import('~/utils/token-cache')
      setToken(token)
      document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
      if (data.user) setUser(data.user)
      isLoggedIn.value = true
      authUser.value = data.user
      showLogin.value = false
    }
  } catch (err: any) { authError.value = err.message }
  finally { authLoading.value = false }
}

async function onFileChange(event: Event, type: 'image' | 'video') {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  const formData = new FormData()
  formData.append('file', file)
  uploadingText.value = `正在上传 ${file.name}...`
  try {
    const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
    const res = await fetch('/api/v1/upload/local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '上传失败')
    // 兼容两种返回：{success,data:{url}} 与 {url}
    const url = data.data?.url || data.url
    if (!url) throw new Error('上传返回异常，未获取到文件地址')
    const tag = type === 'image' ? `[img:${url}]` : `[video:${url}]`
    content.value = (content.value || '') + '\n' + tag + '\n'
    await nextTick()
    if (contentTextarea.value) {
      contentTextarea.value.scrollTop = contentTextarea.value.scrollHeight
    }
  } catch (err: any) {
    error.value = `上传失败: ${err.message}`
  }
  uploadingText.value = ''
  input.value = ''
}

onMounted(() => {
  loadPostRules()
  const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
  isLoggedIn.value = !!token
  const authUserRaw = localStorage.getItem('auth_user')
  if (authUserRaw) { try { authUser.value = JSON.parse(authUserRaw) } catch {} }
})

async function submitPost() {
  if (!title.value.trim() || !content.value.trim()) { error.value = '标题和内容不能为空'; return }
  submitting.value = true; error.value = ''
  try {
    const { getToken: _gtok } = require("~/utils/token-cache") as typeof import("~/utils/token-cache"); const token = _gtok()
    if (!token) { error.value = '请先登录'; return }
    // 从内容提取 [img:url]/[video:url] 标记 → media 数组（详情页图库/OG 图使用）
    const media: Array<{ type: 'image' | 'video'; url: string; thumbnail?: string }> = []
    const imgRe = /\[img:([^\]]+)\]/g
    const vidRe = /\[video:([^\]]+)\]/g
    let m: RegExpExecArray | null
    while ((m = imgRe.exec(content.value))) { if (m[1] && m[1] !== 'undefined') media.push({ type: 'image', url: m[1] }) }
    while ((m = vidRe.exec(content.value))) { if (m[1] && m[1] !== 'undefined') media.push({ type: 'video', url: m[1] }) }
    const res = await fetch('/api/community/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: title.value.trim(),
        content: content.value.trim(),
        category: category.value,
        tags: tags.value.trim(),
        media,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '发布失败')
    // 已提交后台审核：跳详情页（作者本人可见待审帖）
    error.value = ''
    router.push(`/community/post/${data.post.id}?pending=1`)
  } catch (err: any) { error.value = err.message || '发布失败，请重试' }
  finally { submitting.value = false }
}
</script>

<style scoped>
.new-post-page {
  min-height: 100vh;
  font-family: var(--cn-body);
}

/* 导航栏（中式浅色） */
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
  max-width: 700px;
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

.form-card {
  padding: 32px;
}
.form-title {
  font-size: 1.4rem; font-weight: 700; color: var(--cn-cobalt-deep);
  margin: 0 0 6px; font-family: var(--cn-serif); letter-spacing: 2px;
}
.form-desc { font-size: 0.85rem; color: var(--cn-ink-soft); margin: 0 0 28px; }

.form-tip {
  display: inline-block;
  font-size: 0.8rem;
  color: var(--cn-cobalt, #26547C);
  background: rgba(95, 168, 190, 0.12);
  border: 1px dashed rgba(38, 84, 124, 0.35);
  border-radius: 8px;
  padding: 6px 14px;
  margin: -14px 0 24px;
}
.form-tip b { color: var(--cn-cinnabar, #B03A2E); }

.form-group { margin-bottom: 20px; }
.form-group label {
  display: block; font-size: 0.78rem;
  color: var(--cn-cobalt-deep); margin-bottom: 6px; font-weight: 600;
  font-family: var(--cn-serif); letter-spacing: 1px;
}
.form-input, .form-select, .form-textarea {
  width: 100%; box-sizing: border-box;
  background: rgba(246, 241, 227, 0.7);
  border: 1px solid rgba(38, 84, 124, 0.22);
  border-radius: 5px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: var(--cn-ink);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}
.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--cn-celadon-deep);
  box-shadow: 0 0 0 3px rgba(95, 168, 190, 0.15);
}
.form-select { cursor: pointer; appearance: auto; }
.form-textarea { resize: vertical; min-height: 200px; line-height: 1.7; }

/* 内容编辑区 */
.content-editor-area { display: flex; flex-direction: column; gap: 8px; }
.content-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.btn-tool {
  font-size: 0.78rem;
  padding: 5px 14px;
}
.upload-status { font-size: 0.78rem; color: var(--cn-cobalt); margin: 0; }

.form-error { color: var(--cn-cinnabar); font-size: 0.8rem; margin-bottom: 16px; text-align: center; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; padding-top: 8px; }

/* 登录 Modal（中式） */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(22, 38, 46, 0.55); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
}
.modal-card {
  width: 88%; max-width: 340px;
  background: var(--cn-paper-card);
  border: 1px solid rgba(38, 84, 124, 0.35);
  border-radius: 8px;
  box-shadow: inset 0 0 0 3px rgba(246, 241, 227, 0.9), inset 0 0 0 4px rgba(38, 84, 124, 0.12), 0 18px 50px rgba(22, 38, 46, 0.28);
  padding: 28px 24px; position: relative;
}
.modal-close {
  position: absolute; top: 14px; right: 14px;
  background: none; border: none; color: var(--cn-ink-faint);
  font-size: 1.2rem; cursor: pointer;
}
.modal-header { text-align: center; margin-bottom: 24px; }
.modal-logo { width: 36px; height: 36px; border-radius: 8px; margin-bottom: 8px; }
.modal-header h2 {
  font-size: 1.1rem; font-weight: 700; color: var(--cn-cobalt-deep);
  margin: 0; font-family: var(--cn-serif); letter-spacing: 2px;
}
.modal-body { display: flex; flex-direction: column; gap: 12px; }
.input-group { margin: 0; }
.modal-input {
  width: 100%; box-sizing: border-box;
  background: rgba(246, 241, 227, 0.7);
  border: 1px solid rgba(38, 84, 124, 0.22);
  border-radius: 5px;
  padding: 12px 14px; font-size: 0.85rem;
  color: var(--cn-ink); outline: none; font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.modal-input:focus { border-color: var(--cn-celadon-deep); box-shadow: 0 0 0 3px rgba(95, 168, 190, 0.15); }
.auth-error { color: var(--cn-cinnabar); font-size: 0.78rem; text-align: center; margin: 0; }
.modal-btn {
  width: 100%; padding: 12px; justify-content: center;
  font-size: 0.9rem; font-weight: 700;
}
.modal-btn:disabled { opacity: 0.5; }
.modal-switch {
  text-align: center; font-size: 0.78rem;
  color: var(--cn-cobalt); cursor: pointer; margin: 4px 0 0;
}

/* ─── 移动端适配 ─── */
@media (max-width: 768px) {
  .form-card { padding: 20px; }
  .form-title { font-size: 1.2rem; }
  .form-actions { flex-direction: column-reverse; }
  .form-actions .cn-seal-btn, .form-actions .cn-ink-btn { width: 100%; justify-content: center; }
  .content-toolbar { flex-wrap: wrap; }
}
</style>
