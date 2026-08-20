<template>
  <MPageShell title="我的视频" @close="$emit('close')">
    <div class="sp-head">
      <button class="sp-btn primary" @click="pickUpload">🎬 上传视频</button>
      <span class="sp-hint">支持 mp4 / mov / webm · 单文件较大时上传稍慢</span>
    </div>

    <div v-if="loading" class="sp-empty">加载中…</div>
    <div v-else-if="!items.length" class="sp-empty">还没有视频，点击上方「上传视频」开始</div>
    <div v-else class="sp-list">
      <div v-for="it in items" :key="it.id" class="sp-vbox">
        <video class="sp-video" :src="absUrl(it.url)" :poster="it.thumb || ''" controls preload="metadata"></video>
        <div class="sp-vfoot">
          <span class="sp-name">{{ it.name }}</span>
          <button class="sp-del" @click="remove(it)">删除</button>
        </div>
      </div>
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

const absUrl = (u: string) => {
  if (!u) return ''
  const a = u.startsWith('http') ? u : u.replace(/^\/api/, '')
  const sep = a.includes('?') ? '&' : '?'
  return a + sep + 'token=' + encodeURIComponent(mobileToken())
}

async function load() {
  loading.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/space/list?kind=video')
    const j = await r.json()
    items.value = (j.data && j.data.items) || []
  } catch { mobileToast('⚠ 加载失败') } finally { loading.value = false }
}

function pickUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
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
    const r = await fetch('/api/tea/space/upload?kind=video', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + mobileToken() },
      body: fd,
    })
    const j = await r.json()
    if (!j.success) mobileToast('⚠ ' + (j.error || '上传失败'))
  } catch { mobileToast('⚠ 上传失败') }
}

async function remove(it: any) {
  if (!confirm('删除这个视频？')) return
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
.sp-list { display: flex; flex-direction: column; gap: 12px; }
.sp-vbox { background: #fff; border-radius: 10px; padding: 8px; }
.sp-video { width: 100%; border-radius: 8px; background: #000; max-height: 300px; }
.sp-vfoot { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.sp-name { font-size: 13px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-del { border: none; background: #fdecec; color: #e04545; font-size: 12px; padding: 5px 12px; border-radius: 14px; cursor: pointer; }
.sp-empty { text-align: center; color: #999; font-size: 13px; padding: 40px 0; }
</style>
