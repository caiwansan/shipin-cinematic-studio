<template>
  <MPageShell :title="activeConv ? activeConv.username || '会话' : '我的消息'" @close="activeConv ? (activeConv = null) : $emit('close')">
    <!-- 会话列表 -->
    <template v-if="!activeConv">
      <div v-if="!conversations.length" class="mm-empty">{{ loading ? '加载中…' : '暂无消息' }}</div>
      <div v-for="c in conversations" :key="c.userId" class="mm-conv" @click="openConv(c)">
        <div class="mm-avatar">{{ (c.username || '?').slice(0, 1) }}</div>
        <div class="mm-info">
          <div class="mm-name">{{ c.username || '茶友' }}</div>
          <div class="mm-preview">{{ c.lastMessage || c.lastMsg || '' }}</div>
        </div>
        <span v-if="c.unreadCount" class="mm-unread">{{ c.unreadCount > 99 ? '99+' : c.unreadCount }}</span>
      </div>
    </template>

    <!-- 会话详情 -->
    <template v-else>
      <div class="mm-chat">
        <div v-for="m in chatMessages" :key="m.id || m.createdAt" class="mm-msg" :class="{ mine: m.fromId === myId || m.fromUID === myId }">
          <div class="mm-bubble">
            <img v-if="m.media && m.media.length" :src="absUrl(m.media[0].url)" class="mm-img" @click="preview = absUrl(m.media[0].url)" />
            <span v-else>{{ m.content || '' }}</span>
          </div>
          <div class="mm-time">{{ (m.createdAt || '').slice(5, 16).replace('T', ' ') }}</div>
        </div>
      </div>
      <div class="mm-inputbar">
        <input v-model="replyText" class="mm-input" placeholder="回复…" @keyup.enter="doReply" />
        <button class="mm-send" :disabled="!replyText.trim()" @click="doReply">发送</button>
      </div>
    </template>

    <div v-if="preview" class="mm-mask" @click="preview = ''"><img :src="preview" class="mm-preview-img" /></div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted, nextTick } from 'vue'
import { mobileAuthFetch } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const conversations = ref<any[]>([])
const loading = ref(true)
const activeConv = ref<any>(null)
const chatMessages = ref<any[]>([])
const replyText = ref('')
const preview = ref('')
const myId = ref('')

function absUrl(u: string) {
  if (!u) return ''
  return /^https?:\/\//.test(u) ? u : 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u)
}

onMounted(async () => {
  try {
    const r = await mobileAuthFetch('/api/messages/conversations')
    const j = await r.json()
    conversations.value = j.conversations || []
    const u = localStorage.getItem('auth_user')
    if (u) { try { myId.value = JSON.parse(u).id || '' } catch { /* ignore */ } }
  } catch { /* ignore */ } finally { loading.value = false }
})

async function openConv(c: any) {
  activeConv.value = c
  try {
    const r = await mobileAuthFetch(`/api/messages/${c.userId}?pageSize=50`)
    const j = await r.json()
    chatMessages.value = j.messages || []
    await nextTick()
  } catch { chatMessages.value = [] }
}

async function doReply() {
  if (!replyText.value.trim() || !activeConv.value) return
  try {
    const r = await mobileAuthFetch('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ toId: activeConv.value.userId, content: replyText.value.trim() }),
    })
    const j = await r.json()
    if (j.message) {
      chatMessages.value.push(j.message)
      replyText.value = ''
    }
  } catch { /* ignore */ }
}
</script>

<style scoped>
.mm-empty { text-align: center; color: #999; padding: 40px 0; font-size: 14px; }
.mm-conv { display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
.mm-avatar { width: 42px; height: 42px; border-radius: 50%; background: #eef3ff; color: #4f7df9; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.mm-info { flex: 1; min-width: 0; }
.mm-name { font-size: 14px; font-weight: 600; }
.mm-preview { font-size: 12px; color: #999; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mm-unread { background: #ff4d4f; color: #fff; border-radius: 10px; min-width: 18px; height: 18px; line-height: 18px; text-align: center; font-size: 11px; padding: 0 5px; }
.mm-chat { padding: 6px 0; }
.mm-msg { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 10px; }
.mm-msg.mine { align-items: flex-end; }
.mm-bubble { max-width: 78%; background: #fff; border-radius: 10px; padding: 9px 12px; font-size: 14px; word-break: break-word; }
.mm-msg.mine .mm-bubble { background: #95ec69; }
.mm-img { max-width: 180px; border-radius: 8px; display: block; }
.mm-time { font-size: 11px; color: #bbb; margin-top: 3px; }
.mm-inputbar { display: flex; gap: 8px; margin-top: 8px; }
.mm-input { flex: 1; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 18px; font-size: 14px; outline: none; background: #fff; }
.mm-send { padding: 0 18px; border: none; border-radius: 18px; background: #4f7df9; color: #fff; font-size: 14px; }
.mm-send:disabled { opacity: .4; }
.mm-mask { position: absolute; inset: 0; background: rgba(0,0,0,.85); z-index: 80; display: flex; align-items: center; justify-content: center; }
.mm-preview-img { max-width: 92%; max-height: 80%; border-radius: 8px; }
</style>
