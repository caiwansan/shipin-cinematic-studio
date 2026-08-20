<template>
  <MPageShell title="影像空间" @close="$emit('close')">
    <div class="sp-head">
      <button class="sp-btn primary" @click="pickUpload">📷 上传图片</button>
      <span class="sp-hint">仅本人可见 · 本地+分布式存储</span>
    </div>

    <div v-if="loading" class="sp-empty">加载中…</div>
    <div v-else-if="!items.length" class="sp-empty">还没有影像，点击上方「上传图片」开始</div>
    <div v-else class="sp-grid">
      <div v-for="it in items" :key="it.id" class="sp-img-box">
        <img class="sp-img" :src="absUrl(it.url)" :alt="it.name" loading="lazy" @click="preview(it)" />
        <button class="sp-del" @click="remove(it)">✕</button>
        <div class="sp-name">{{ it.name }}</div>
      </div>
    </div>

    <!-- 大图预览 -->
    <div v-if="previewUrl" class="sp-mask" @click.self="previewUrl = ''">
      <img class="sp-prev" :src="previewUrl" alt="预览" />
      <button class="sp-close" @click="previewUrl = ''">关闭</button>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast, mobileToken } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const items = ref<any[]>([])
const loading = ref(false)
const previewUrl = ref('')

const absUrl = (u: string) => {
  if (!u) return ''
  const a = u.startsWith('http') ? u : u.replace(/^\/api/, '')
  const sep = a.includes('?') ? '&' : '?'
  return a + sep + 'token=' + encodeURIComponent(mobileToken())
}

async function load() {
  loading.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/space/list?kind=image')
    const j = await r.json()
    items.value = (j.data && j.data.items) || []
  } catch { mobileToast('⚠ 加载失败') } finally { loading.value = false }
}

function pickUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = async () => {
    const files = Array.from(input.files || [])
    for (const f of files) await upload(f)
    await load()
  }
  input.click()
}

async function upload(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  try {
    const r = await fetch('/api/tea/space/upload?kind=image', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + mobileToken() },
      body: fd,
    })
    const j = await r.json()
    if (!j.success) mobileToast('⚠ ' + (j.error || '上传失败'))
  } catch { mobileToast('⚠ 上传失败') }
}

function preview(it: any) { previewUrl.value = absUrl(it.url) }

async function remove(it: any) {
  if (!confirm('删除这张影像？')) return
  try {
    const r = await mobileAuthFetch('/api/tea/space/item/' + it.id, { method: 'DELETE' })
    const j = await r.json()
    if (j.success) items.value = items.value.filter(x => x.id !== it.id)
  } catch { mobileToast('⚠ 删除失败') }
}

onMounted(load)
</script>

<style scoped>
.sp-head { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.sp-btn { padding: 11px; border: none; border-radius: 10px; font-size: 14px; cursor: pointer; }
.sp-btn.primary { background: #4f7df9; color: #fff; }
.sp-hint { font-size: 12px; color: #999; }
.sp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sp-img-box { position: relative; background: #f4f4f4; border-radius: 8px; overflow: hidden; }
.sp-img { width: 100%; height: 96px; object-fit: cover; display: block; }
.sp-del { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border: none; border-radius: 50%; background: rgba(0,0,0,.55); color: #fff; font-size: 12px; line-height: 1; cursor: pointer; }
.sp-name { font-size: 11px; color: #777; padding: 4px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-empty { text-align: center; color: #999; font-size: 13px; padding: 40px 0; }
.sp-mask { position: fixed; inset: 0; background: rgba(0,0,0,.9); display: flex; align-items: center; justify-content: center; flex-direction: column; z-index: 300; }
.sp-prev { max-width: 92vw; max-height: 80vh; object-fit: contain; border-radius: 8px; }
.sp-close { margin-top: 14px; padding: 8px 22px; border: none; border-radius: 20px; background: #fff; color: #333; font-size: 14px; cursor: pointer; }
</style>
