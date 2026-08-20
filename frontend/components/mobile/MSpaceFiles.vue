<template>
  <MPageShell title="我的文件" @close="$emit('close')">
    <div class="sp-head">
      <button class="sp-btn primary" @click="pickUpload">📁 上传文件</button>
      <span class="sp-hint">支持各类文件 · 在线预览 · 下载 · 仅本人可见</span>
    </div>

    <div v-if="loading" class="sp-empty">加载中…</div>
    <div v-else-if="!items.length" class="sp-empty">还没有文件，点击上方「上传文件」开始</div>
    <div v-else class="sp-list">
      <div v-for="it in items" :key="it.id" class="sp-fbox">
        <div class="sp-ic " :class="'ext-' + ext(it)">{{ extLabel(it) }}</div>
        <div class="sp-fin">
          <div class="sp-fname">{{ it.name }}</div>
          <div class="sp-fsub">{{ fileKindLabel(it) }} · {{ fmtSize(it.size) }}</div>
        </div>
        <div class="sp-facts">
          <button class="sp-act" @click="preview(it)">预览</button>
          <button class="sp-act" @click="download(it)">下载</button>
          <button class="sp-act danger" @click="remove(it)">删除</button>
        </div>
      </div>
    </div>

    <!-- 在线预览弹窗（对齐电脑版 9 类格式） -->
    <div v-if="prev" class="sp-mask" @click.self="prev = null">
      <div class="sp-prev-head">
        <span class="sp-prev-title">{{ prev.name }}</span>
        <button class="sp-close" @click="prev = null">✕</button>
      </div>
      <div class="sp-prev-body" @click.stop>
        <img v-if="kindOf(prev) === 'img'" class="sp-prev-media" :src="absUrl(prev.url)" alt="预览" />
        <video v-else-if="kindOf(prev) === 'video'" class="sp-prev-media" :src="absUrl(prev.url)" controls autoplay></video>
        <audio v-else-if="kindOf(prev) === 'audio'" class="sp-prev-audio" :src="absUrl(prev.url)" controls></audio>
        <pre v-else-if="kindOf(prev) === 'text'" class="sp-prev-text">{{ prevText }}</pre>
        <iframe v-else-if="kindOf(prev) === 'pdf'" class="sp-prev-frame" :src="absUrl(prev.url)"></iframe>
        <iframe v-else-if="kindOf(prev) === 'office'" class="sp-prev-frame"
          :src="'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(locAbs(prev.url))"></iframe>
        <div v-else class="sp-prev-nopreview">该类型暂不支持在线预览，请「下载」后查看</div>
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
const prev = ref<any>(null)
const prevText = ref('')

const absUrl = (u: string) => {
  if (!u) return ''
  const a = u.startsWith('http') ? u : u.replace(/^\/api/, '')
  const sep = a.includes('?') ? '&' : '?'
  return a + sep + 'token=' + encodeURIComponent(mobileToken())
}
const locAbs = (u: string) => {
  const a = absUrl(u)
  return a.startsWith('http') ? a : (location.origin + a)
}

// 与桌面版一致的文件类型判定
const KIND_MAP: Record<string, string> = {
  png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', bmp: 'img', svg: 'img', ico: 'img',
  mp4: 'video', mov: 'video', webm: 'video', mkv: 'video', avi: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio', amr: 'audio', aac: 'audio',
  pdf: 'pdf',
  txt: 'text', md: 'text', log: 'text', json: 'text', js: 'text', ts: 'text', py: 'text', html: 'text', css: 'text', c: 'text', cpp: 'text', java: 'text', go: 'text', rs: 'text', sql: 'text', xml: 'text', yml: 'text', yaml: 'text',
  doc: 'office', docx: 'office', xls: 'office', xlsx: 'office', ppt: 'office', pptx: 'office', csv: 'office',
}
const ext = (it: any) => String((it.ext || '').replace('.', '')).toLowerCase() || String((it.name || '').split('.').pop() || '').toLowerCase()
const kindOf = (it: any) => KIND_MAP[ext(it)] || 'other'
const extLabel = (it: any) => { const e = ext(it); return e ? e.toUpperCase().slice(0, 4) : 'FILE' }
const fileKindLabel = (it: any) => {
  const k = kindOf(it)
  const map: Record<string, string> = { img: '图片', video: '视频', audio: '音频', pdf: 'PDF', text: '文本', office: '办公文档', other: '文件' }
  return map[k] || '文件'
}
function fmtSize(n: any): string {
  const v = Number(n || 0)
  if (!v) return '0 B'
  if (v < 1024) return v + ' B'
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB'
  if (v < 1024 * 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + ' MB'
  return (v / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

async function load() {
  loading.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/space/list?kind=file')
    const j = await r.json()
    items.value = (j.data && j.data.items) || []
  } catch { mobileToast('⚠ 加载失败') } finally { loading.value = false }
}

function pickUpload() {
  const input = document.createElement('input')
  input.type = 'file'
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
    const r = await fetch('/api/tea/space/upload?kind=file', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + mobileToken() },
      body: fd,
    })
    const j = await r.json()
    if (!j.success) mobileToast('⚠ ' + (j.error || '上传失败'))
  } catch { mobileToast('⚠ 上传失败') }
}

async function preview(it: any) {
  prev.value = { ...it }
  prevText.value = ''
  if (kindOf(it) === 'text') {
    try {
      const r = await fetch(absUrl(it.url), { headers: { Authorization: 'Bearer ' + mobileToken() } })
      prevText.value = await r.text()
    } catch { prevText.value = '预览失败' }
  }
}

async function download(it: any) {
  try {
    const r = await fetch('/api/tea/space/download/' + it.id, {
      headers: { Authorization: 'Bearer ' + mobileToken() },
    })
    if (!r.ok) { mobileToast('⚠ 下载失败'); return }
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = it.name || 'file'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  } catch { mobileToast('⚠ 下载失败') }
}

async function remove(it: any) {
  if (!confirm('删除这个文件？')) return
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
.sp-list { display: flex; flex-direction: column; gap: 10px; }
.sp-fbox { display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 10px; padding: 10px; }
.sp-ic { width: 40px; height: 40px; border-radius: 8px; background: #eef3ff; color: #4f7df9; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.sp-fin { flex: 1; min-width: 0; }
.sp-fname { font-size: 13px; font-weight: 600; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-fsub { font-size: 11px; color: #999; margin-top: 2px; }
.sp-facts { display: flex; gap: 6px; flex-shrink: 0; }
.sp-act { border: none; border-radius: 12px; padding: 5px 10px; font-size: 12px; background: #eef3ff; color: #4f7df9; cursor: pointer; }
.sp-act.danger { background: #fdecec; color: #e04545; }
.sp-empty { text-align: center; color: #999; font-size: 13px; padding: 40px 0; }
.sp-mask { position: fixed; inset: 0; background: rgba(0,0,0,.92); display: flex; flex-direction: column; z-index: 300; }
.sp-prev-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; color: #fff; }
.sp-prev-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-close { border: none; background: rgba(255,255,255,.18); color: #fff; border-radius: 50%; width: 28px; height: 28px; font-size: 14px; cursor: pointer; }
.sp-prev-body { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 0 8px 16px; }
.sp-prev-media { max-width: 96vw; max-height: 72vh; object-fit: contain; border-radius: 8px; }
.sp-prev-audio { width: 90%; }
.sp-prev-text { width: 96%; max-height: 72vh; overflow: auto; background: #1c1f26; color: #d8dee9; font: 13px/1.6 ui-monospace, monospace; border-radius: 8px; padding: 14px; white-space: pre-wrap; word-break: break-word; }
.sp-prev-frame { width: 96%; height: 72vh; border: none; border-radius: 8px; background: #fff; }
.sp-prev-nopreview { color: #bbb; font-size: 13px; }
</style>
