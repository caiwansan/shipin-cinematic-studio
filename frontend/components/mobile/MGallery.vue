<template>
  <MPageShell title="我的作品" @close="$emit('close')">
    <div class="mg-tabs">
      <span v-for="t in tabs" :key="t" class="mg-tab" :class="{ on: tab === t }" @click="tab = t; load()">{{ t }}</span>
    </div>
    <div v-if="!items.length" class="mg-empty">{{ loading ? '加载中…' : '暂无作品' }}</div>
    <div class="mg-grid">
      <div v-for="it in items" :key="it.id" class="mg-item">
        <img v-if="it.type === 'image'" :src="absUrl(it.url || it.src)" class="mg-img" @click="preview = absUrl(it.url || it.src)" />
        <video v-else-if="it.type === 'video'" :src="absUrl(it.url || it.src)" class="mg-img" controls />
        <div v-else class="mg-file">{{ it.name || it.type || '文件' }}</div>
        <div class="mg-title">{{ it.projectTitle || it.name || '' }}</div>
        <div class="mg-time">{{ (it.createdAt || '').slice(0, 10) }}</div>
      </div>
    </div>
    <div v-if="preview" class="mg-mask" @click="preview = ''"><img :src="preview" class="mg-preview-img" /></div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const tabs = ['全部', '图片', '视频']
const tab = ref('全部')
const items = ref<any[]>([])
const loading = ref(true)
const preview = ref('')

function absUrl(u: string) {
  if (!u) return ''
  return /^https?:\/\//.test(u) ? u : 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u)
}

async function load() {
  loading.value = true
  try {
    const typeMap: Record<string, string> = { '全部': '', '图片': 'image', '视频': 'video' }
    const tp = typeMap[tab.value] || ''
    const r = await mobileAuthFetch(`/api/user/gallery?limit=50&offset=0${tp ? '&type=' + tp : ''}`)
    const j = await r.json()
    const list = j.data?.data || j.data || []
    items.value = Array.isArray(list) ? list : []
  } catch { items.value = [] } finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped>
.mg-tabs { display: flex; gap: 6px; background: #fff; border-radius: 10px; padding: 6px; margin-bottom: 10px; }
.mg-tab { flex: 1; text-align: center; padding: 8px 0; font-size: 13px; border-radius: 8px; color: #666; }
.mg-tab.on { background: #4f7df9; color: #fff; font-weight: 600; }
.mg-empty { text-align: center; color: #999; padding: 40px 0; font-size: 14px; }
.mg-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.mg-item { background: #fff; border-radius: 12px; overflow: hidden; padding-bottom: 8px; }
.mg-img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: #eee; }
.mg-file { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: #eef3ff; color: #4f7df9; font-size: 13px; }
.mg-title { font-size: 12px; padding: 6px 8px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mg-time { font-size: 11px; color: #aaa; padding: 2px 8px 0; }
.mg-mask { position: absolute; inset: 0; background: rgba(0,0,0,.85); z-index: 80; display: flex; align-items: center; justify-content: center; }
.mg-preview-img { max-width: 94%; max-height: 82%; border-radius: 8px; }
</style>
