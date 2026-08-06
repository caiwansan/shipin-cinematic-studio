<template>
  <MPageShell :title="post ? post.title : '帖子详情'" @close="$emit('close')">
    <div v-if="!post" class="mpd-empty">{{ loading ? '加载中…' : '帖子不存在或已被删除' }}</div>
    <template v-else>
      <div class="mpd-card">
        <div class="mpd-author">
          <span class="mpd-author-name">{{ post.authorName || post.author?.name || '茶友' }}</span>
          <span class="mpd-time">{{ timeAgo(post.createdAt) }}</span>
        </div>
        <h2 class="mpd-title">{{ post.title }}</h2>
        <div class="mpd-content" v-html="renderedContent" />
        <div v-if="mediaList.length" class="mpd-media">
          <img v-for="(m, i) in mediaList" :key="i" :src="absUrl(m.url)" class="mpd-img" @click="preview = absUrl(m.url)" />
        </div>
        <div class="mpd-actions">
          <button class="mpd-act" :class="{ liked: liked }" @click="toggleLike">👍 {{ likeCount }}</button>
          <button class="mpd-act" @click="tipPost">💰 打赏</button>
        </div>
      </div>

      <div class="mpd-card">
        <div class="mpd-card-title">💬 评论（{{ comments.length }}）</div>
        <div v-if="!comments.length" class="mpd-empty">暂无评论，抢个沙发～</div>
        <div v-for="c in comments" :key="c.id" class="mpd-comment">
          <div class="mpd-comment-head">
            <span class="mpd-comment-author">{{ c.user?.username || '匿名' }}</span>
            <span class="mpd-comment-time">{{ timeAgo(c.createdAt) }}</span>
          </div>
          <div class="mpd-comment-body">{{ c.content }}</div>
        </div>
        <div class="mpd-comment-form">
          <input v-model="commentText" class="mpd-input" placeholder="写下你的评论…" @keyup.enter="submitComment" />
          <button class="mpd-send" :disabled="!commentText.trim() || submitting" @click="submitComment">发布</button>
        </div>
      </div>
    </template>
    <div v-if="preview" class="mpd-mask" @click="preview = ''"><img :src="preview" class="mpd-preview-img" /></div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, computed, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'

const props = defineProps<{ postId: string }>()
defineEmits<{ (e: 'close'): void }>()

const post = ref<any>(null)
const comments = ref<any[]>([])
const loading = ref(true)
const liked = ref(false)
const likeCount = ref(0)
const commentText = ref('')
const submitting = ref(false)
const preview = ref('')

function absUrl(u: string) {
  if (!u) return ''
  return /^https?:\/\//.test(u) ? u : 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u)
}
function timeAgo(iso: string) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

const mediaList = computed(() => {
  if (!post.value?.mediaJson) return []
  try {
    const m = JSON.parse(post.value.mediaJson)
    return Array.isArray(m) ? m.filter((x) => x.type === 'image' && x.url) : []
  } catch { return [] }
})

const renderedContent = computed(() => {
  if (!post.value?.content) return ''
  return post.value.content
    .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
})

onMounted(async () => {
  try {
    const r = await mobileAuthFetch(`/api/community/posts/${props.postId}`)
    const j = await r.json()
    if (j.post) {
      post.value = j.post
      likeCount.value = j.post.likeCount ?? j.post.likes ?? 0
      comments.value = j.post.comments || []
    } else {
      post.value = null
    }
  } catch {
    post.value = null
  } finally { loading.value = false }
})

async function toggleLike() {
  try {
    const r = await mobileAuthFetch(`/api/community/posts/${props.postId}/like`, { method: 'POST' })
    const j = await r.json()
    if (j.success) {
      liked.value = !liked.value
      likeCount.value += liked.value ? 1 : -1
    }
  } catch { mobileToast('操作失败') }
}

async function submitComment() {
  if (!commentText.value.trim()) return
  submitting.value = true
  try {
    const r = await mobileAuthFetch('/api/community/comments', {
      method: 'POST',
      body: JSON.stringify({ postId: props.postId, content: commentText.value.trim() }),
    })
    const j = await r.json()
    if (j.success) {
      comments.value.push(j.comment || { content: commentText.value, user: { username: '我' }, createdAt: new Date().toISOString() })
      commentText.value = ''
      mobileToast('✅ 评论已发布')
    } else {
      mobileToast('⚠ ' + (j.error || '评论失败'))
    }
  } catch { mobileToast('⚠ 网络错误') } finally { submitting.value = false }
}

async function tipPost() {
  try {
    const r = await mobileAuthFetch(`/api/community/posts/${props.postId}/tip`, { method: 'POST', body: JSON.stringify({ diamonds: 1 }) })
    const j = await r.json()
    if (j.success) mobileToast('✅ 打赏成功')
    else mobileToast('⚠ ' + (j.error || '打赏失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
</script>

<style scoped>
.mpd-empty { text-align: center; color: #999; padding: 40px 0; font-size: 14px; }
.mpd-card { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.mpd-author { display: flex; align-items: center; gap: 8px; }
.mpd-author-name { font-size: 13px; font-weight: 600; }
.mpd-time { font-size: 12px; color: #aaa; }
.mpd-title { font-size: 17px; font-weight: 700; margin: 8px 0; }
.mpd-content { font-size: 14px; line-height: 1.7; color: #333; word-break: break-word; }
.mpd-media { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.mpd-img { width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; }
.mpd-actions { display: flex; gap: 10px; margin-top: 12px; }
.mpd-act { flex: 1; padding: 9px 0; border: 1px solid #e5e5e5; border-radius: 18px; background: #fff; font-size: 13px; }
.mpd-act.liked { border-color: #ff4d4f; color: #ff4d4f; background: #fff5f5; }
.mpd-card-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.mpd-comment { padding: 10px 0; border-bottom: 1px solid #f4f4f4; }
.mpd-comment-head { display: flex; gap: 8px; align-items: center; }
.mpd-comment-author { font-size: 13px; font-weight: 600; }
.mpd-comment-time { font-size: 11px; color: #aaa; }
.mpd-comment-body { font-size: 14px; margin-top: 4px; word-break: break-word; }
.mpd-comment-form { display: flex; gap: 8px; margin-top: 12px; }
.mpd-input { flex: 1; padding: 9px 12px; border: 1px solid #e5e5e5; border-radius: 18px; font-size: 14px; outline: none; }
.mpd-send { padding: 0 16px; border: none; border-radius: 18px; background: #4f7df9; color: #fff; font-size: 13px; }
.mpd-send:disabled { opacity: .4; }
.mpd-mask { position: absolute; inset: 0; background: rgba(0,0,0,.85); z-index: 80; display: flex; align-items: center; justify-content: center; }
.mpd-preview-img { max-width: 94%; max-height: 82%; border-radius: 8px; }
</style>
