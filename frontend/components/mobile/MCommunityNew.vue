<template>
  <MPageShell title="发布帖子" @close="$emit('close')">
    <input v-model="title" class="mn-input" maxlength="60" placeholder="标题（60 字内）" />
    <textarea v-model="content" class="mn-textarea" rows="8" placeholder="分享你的创作心得…（支持 Markdown）" />
    <div v-if="images.length" class="mn-imgs">
      <div v-for="(img, i) in images" :key="i" class="mn-img-wrap">
        <img :src="img" class="mn-img" />
        <span class="mn-img-del" @click="images.splice(i, 1)">✕</span>
      </div>
    </div>
    <div class="mn-actions">
      <button class="mn-btn ghost" @click="pickImage">📷 添加图片</button>
      <button class="mn-btn primary" :disabled="publishing || !title.trim()" @click="publish">{{ publishing ? '发布中…' : '发布' }}</button>
    </div>
    <input ref="fileRef" type="file" accept="image/*" class="mn-hidden" @change="onFile" />
    <p v-if="errMsg" class="mn-err">{{ errMsg }}</p>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref } from 'vue'
import { mobileAuthFetch, mobileToken, mobileToast } from '~/composables/useMobileApi'

const emit = defineEmits<{ (e: 'close'): void; (e: 'published'): void }>()
const title = ref('')
const content = ref('')
const images = ref<string[]>([])
const publishing = ref(false)
const errMsg = ref('')
const fileRef = ref<any>(null)

function pickImage() { fileRef.value?.click() }

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''
  if (images.value.length >= 6) { errMsg.value = '最多 6 张图片'; return }
  try {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/v1/upload/local', { method: 'POST', headers: { Authorization: 'Bearer ' + mobileToken() }, body: fd })
    const j = await r.json()
    const url = j.url || j.data?.url || j.data?.path
    if (url) images.value.push(url.startsWith('http') ? url : 'https://aigc.fushtn.com' + (url.startsWith('/') ? url : '/' + url))
    else errMsg.value = '图片上传失败'
  } catch { errMsg.value = '图片上传失败' }
}

async function publish() {
  if (!title.value.trim()) return
  publishing.value = true
  errMsg.value = ''
  try {
    const mediaJson = images.value.length ? JSON.stringify(images.value.map((u) => ({ type: 'image', url: u }))) : null
    const r = await mobileAuthFetch('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify({ title: title.value.trim(), content: content.value.trim(), mediaJson }),
    })
    const j = await r.json()
    if (j.success) {
      mobileToast('✅ 发布成功')
      emit('published')
    } else {
      errMsg.value = j.error || '发布失败'
    }
  } catch { errMsg.value = '网络错误，请重试' } finally { publishing.value = false }
}
</script>

<style scoped>
.mn-input { width: 100%; box-sizing: border-box; padding: 12px; border: none; border-radius: 10px; font-size: 16px; outline: none; background: #fff; }
.mn-textarea { width: 100%; box-sizing: border-box; margin-top: 10px; padding: 12px; border: none; border-radius: 10px; font-size: 14px; outline: none; background: #fff; font-family: inherit; resize: none; }
.mn-imgs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.mn-img-wrap { position: relative; }
.mn-img { width: 84px; height: 84px; object-fit: cover; border-radius: 8px; }
.mn-img-del { position: absolute; top: -6px; right: -6px; background: rgba(0,0,0,.6); color: #fff; width: 18px; height: 18px; border-radius: 50%; font-size: 11px; line-height: 18px; text-align: center; }
.mn-actions { display: flex; gap: 10px; margin-top: 12px; }
.mn-btn { flex: 1; padding: 11px 0; border: none; border-radius: 10px; font-size: 14px; }
.mn-btn.primary { background: #4f7df9; color: #fff; }
.mn-btn.ghost { background: #fff; color: #4f7df9; border: 1px solid #4f7df9; }
.mn-btn:disabled { opacity: .5; }
.mn-hidden { display: none; }
.mn-err { color: #e5484d; font-size: 13px; margin-top: 10px; }
</style>
