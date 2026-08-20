<template>
  <MPageShell title="我的作品" @close="$emit('close')">
    <div class="mp-sec">我发过的帖子（{{ posts.length }}）</div>
    <div v-if="!posts.length" class="mp-empty">还没有发过帖子 · 去公共/城市/宗亲社区发帖吧</div>
    <div v-for="p in posts" :key="p.kind + p.id" class="mp-row" @click="openDetail(p)">
      <div class="mp-kind">{{ kindIcon(p.kind) }}{{ kindName(p.kind) }}</div>
      <div class="mp-title">{{ p.title || p.content || '帖子' }}</div>
      <div class="mp-time">{{ fmtTime(p.time) }}</div>
      <button class="mp-del" @click.stop="delPost(p)">🗑</button>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detail" class="mp-mask" @click.self="detail = null">
      <div class="mp-modal mp-scroll">
        <div class="mp-modal-title">{{ detail.title || '帖子' }}</div>
        <div class="mp-modal-kind">{{ kindIcon(detail.kind) }}{{ kindName(detail.kind) }} · {{ fmtTime(detail.time) }}</div>
        <div class="mp-content">{{ detail.content }}</div>
        <div class="mp-imgs" v-if="detail.images && detail.images.length">
          <img v-for="(im, ix) in detail.images" :key="ix" :src="absCover(im)" class="mp-img" @error="hideImg" />
        </div>
        <button class="mp-btn ghost" @click="detail = null">关闭</button>
        <button class="mp-btn del" @click="delPost(detail)">🗑 删除此帖</button>
      </div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()

const posts = ref<any[]>([])
const detail = ref<any>(null)

async function load() {
  try {
    const r = await mobileAuthFetch('/api/tea/posts/mine')
    const j = await r.json()
    const d = j.data || j
    posts.value = d.posts || []
  } catch { posts.value = [] }
}
function kindIcon(k: string) { return k === 'city' ? '🏙' : k === 'family' ? '🏮' : '🌍' }
function kindName(k: string) { return k === 'city' ? '城市' : k === 'family' ? '宗亲' : '公共' }
function fmtTime(t: any) {
  if (!t) return ''
  const n = Number(t); const d = n > 10000000000 ? new Date(n) : new Date(n * 1000)
  return d.toISOString().slice(0, 10).replace('T', ' ')
}
function absCover(u: string) {
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  return 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u)
}
function hideImg(e: any) { try { e.target.style.display = 'none' } catch { } }
function openDetail(p: any) { detail.value = { ...p, images: p.images || [] } }

async function delPost(p: any) {
  if (!confirm('确定删除这条帖子？')) return
  try {
    let r
    if (p.kind === 'public') r = await mobileAuthFetch('/api/tea/posts/delete', { method: 'POST', body: JSON.stringify({ postId: p.id }) })
    else if (p.kind === 'city') r = await mobileAuthFetch('/api/city/post/' + p.id + '/delete', { method: 'POST' })
    else { mobileToast('⚠ 宗亲帖子暂不支持删除'); return }
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('🗑 已删除'); detail.value = null; load() }
    else mobileToast('❌ ' + (j.error || '删除失败'))
  } catch { mobileToast('⚠ 网络错误') }
}

onMounted(load)
</script>

<style scoped>
.mp-sec { font-size: 13px; font-weight: 700; color: #374151; margin: 0 0 10px; }
.mp-empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 30px 0; }
.mp-row { display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
.mp-kind { font-size: 12px; color: #6366f1; background: #eef2ff; padding: 2px 8px; border-radius: 6px; flex-shrink: 0; font-weight: 600; }
.mp-title { flex: 1; font-size: 14px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.mp-time { font-size: 11px; color: #9ca3af; flex-shrink: 0; }
.mp-del { border: none; background: none; font-size: 16px; flex-shrink: 0; }
.mp-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 70; display: flex; align-items: center; justify-content: center; padding: 20px; }
.mp-modal { background: #fff; border-radius: 14px; padding: 18px; width: 100%; max-width: 340px; }
.mp-scroll { max-height: 82vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.mp-modal-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.mp-modal-kind { font-size: 12px; color: #6366f1; margin-bottom: 8px; }
.mp-content { font-size: 14px; color: #374151; line-height: 1.8; white-space: pre-wrap; word-break: break-word; }
.mp-imgs { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.mp-img { width: 100px; height: 100px; object-fit: cover; border-radius: 8px; }
.mp-btn { width: 100%; padding: 11px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 8px; }
.mp-btn.ghost { background: #f3f4f6; color: #374151; }
.mp-btn.del { background: #fee2e2; color: #dc2626; }
</style>
