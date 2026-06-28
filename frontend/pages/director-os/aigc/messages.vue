<template>
  <div class="space-y-6">
    <h2 class="text-sm text-white/70 font-medium">发送私信</h2>

    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-6 max-w-lg">
      <div class="space-y-4">
        <div class="form-group">
          <label class="text-xs text-gray-500 mb-1 block">收件人</label>
          <div class="relative">
            <input v-model="searchText" type="text" placeholder="搜索用户名或邮箱..."
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/60 outline-none focus:border-blue-500/50"
              @input="searchUsers" />
            <div v-if="searchResults.length > 0" class="absolute top-full left-0 right-0 mt-1 bg-[#0B1020] border border-[#1A2240] rounded-lg z-10 max-h-40 overflow-y-auto">
              <div
                v-for="u in searchResults" :key="u.id"
                class="px-3 py-2 text-xs text-white/60 hover:bg-white/5 cursor-pointer flex items-center gap-2"
                @click="selectUser(u)"
              >
                <span class="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">{{ (u.username || 'U')[0] }}</span>
                <span>{{ u.username }}</span>
                <span class="text-gray-600 ml-auto">{{ u.email }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="selectedUser" class="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <span class="text-xs text-blue-400">收件人：{{ selectedUser.username }}（{{ selectedUser.email }}）</span>
          <button @click="clearUser" class="ml-auto text-blue-400/50 hover:text-blue-400 text-xs cursor-pointer bg-transparent border-none">✕</button>
        </div>

        <div class="form-group">
          <label class="text-xs text-gray-500 mb-1 block">消息内容</label>
          <textarea v-model="content" rows="6" placeholder="输入私信内容..."
            class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/60 outline-none focus:border-blue-500/50 resize-none" />
        </div>

        <div class="form-group">
          <label class="text-xs text-gray-500 mb-1 block">附件（可选）</label>
          <div class="flex items-center gap-2">
            <button @click="$refs.msgImageInput.click()" class="text-[10px] px-3 py-1.5 rounded bg-[#0B1020] border border-[#1A2240] text-gray-400 hover:text-white cursor-pointer">📷 插入图片</button>
            <input ref="msgImageInput" type="file" accept="image/*" style="display:none" @change="uploadMedia('image')" />
            <span v-if="uploading" class="text-[10px] text-yellow-400/60">上传中...</span>
          </div>
          <div v-if="mediaUrls.length > 0" class="flex gap-2 mt-2">
            <div v-for="(url, i) in mediaUrls" :key="i" class="relative">
              <img :src="url" class="w-16 h-16 rounded object-cover border border-[#1A2240]" />
              <button @click="mediaUrls.splice(i, 1)" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/70 text-white text-[8px] flex items-center justify-center cursor-pointer border-none">✕</button>
            </div>
          </div>
        </div>

        <div v-if="error" class="text-red-400 text-xs">{{ error }}</div>
        <div v-if="success" class="text-green-400 text-xs">{{ success }}</div>

        <button @click="sendMessage" :disabled="!selectedUser || !content.trim() || sending"
          class="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-orange-500 to-rose-500 text-white disabled:opacity-30 cursor-pointer border-none">
          {{ sending ? '发送中...' : '发送私信' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
import { ref } from 'vue'
definePageMeta({ layout: 'admin-aigc' })

const searchText = ref('')
const searchResults = ref<any[]>([])
const selectedUser = ref<any>(null)
const content = ref('')
const mediaUrls = ref<string[]>([])
const error = ref('')
const success = ref('')
const sending = ref(false)
const uploading = ref(false)

let searchTimer: any = null
function searchUsers() {
  clearTimeout(searchTimer)
  const q = searchText.value.trim()
  if (!q || q.length < 2) { searchResults.value = []; return }
  searchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/messages/users/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      searchResults.value = (data.users || data || []).slice(0, 8)
    } catch { searchResults.value = [] }
  }, 300)
}

function selectUser(u: any) {
  selectedUser.value = u
  searchText.value = u.username
  searchResults.value = []
}

function clearUser() {
  selectedUser.value = null
  searchText.value = ''
}

async function uploadMedia(type: string) {
  const input = document.querySelector('input[accept="image/*"]') as HTMLInputElement
  if (!input?.files?.[0]) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', input.files[0])
    const res = await fetch('/api/v1/upload/local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    })
    const data = await res.json()
    if (data.url) mediaUrls.value.push(data.url)
    input.value = ''
  } catch { error.value = '上传失败' }
  finally { uploading.value = false }
}

async function sendMessage() {
  if (!selectedUser.value || !content.value.trim()) return
  sending.value = true; error.value = ''; success.value = ''
  try {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        toId: selectedUser.value.id,
        content: content.value.trim(),
        media: mediaUrls.value.length > 0 ? JSON.stringify(mediaUrls.value.map(u => ({ type: 'image', url: u }))) : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '发送失败')
    success.value = '私信发送成功！'
    content.value = ''
    mediaUrls.value = []
    setTimeout(() => { success.value = '' }, 3000)
  } catch (err: any) { error.value = err.message }
  finally { sending.value = false }
}
</script>
