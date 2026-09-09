<template>
  <div style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5">
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.1)">
      <h2 style="margin-bottom:16px;color:#333">加入群聊</h2>
      <div v-if="loading" style="color:#666">加载中...</div>
      <div v-else-if="error" style="color:#e74c3c">{{ error }}</div>
      <div v-else>
        <div style="color:#666;margin-bottom:24px;line-height:1.6">
          <b>{{ groupName }}</b>
        </div>
        <button v-if="!joined" @click="joinGroup" :disabled="joining" style="padding:12px 32px;background:#07c160;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer">
          {{ joining ? '加入中...' : '加入群聊' }}
        </button>
        <div v-else style="color:#07c160;font-size:16px">已加入群聊！</div>
        <div v-if="msg" :style="{color: msg.includes('成功') ? '#07c160' : '#e74c3c', marginTop:'16px'}">{{ msg }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const groupId = ref('')
const groupName = ref('')
const loading = ref(true)
const error = ref('')
const joining = ref(false)
const joined = ref(false)
const msg = ref('')

onMounted(async () => {
  groupId.value = route.query.g || ''
  if (!groupId.value) {
    error.value = '无效的群链接'
    loading.value = false
    return
  }
  try {
    const res = await $fetch('/api/im/groups/' + encodeURIComponent(groupId.value))
    if (res.success && res.data?.group) {
      groupName.value = res.data.group.name || '群聊'
    } else {
      groupName.value = groupId.value
    }
  } catch (e) {
    groupName.value = groupId.value
  }
  loading.value = false
})

async function joinGroup() {
  if (!groupId.value) return
  joining.value = true
  msg.value = ''
  try {
    const token = localStorage.getItem('token') || ''
    const res = await $fetch('/api/im/groups/' + encodeURIComponent(groupId.value) + '/join', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (res.success) {
      if (res.data?.pending) {
        msg.value = '已提交入群申请，等待群主审批'
      } else {
        joined.value = true
        msg.value = '加入群聊成功！'
      }
    } else {
      msg.value = res.error || '加入失败'
    }
  } catch (e) {
    msg.value = '网络错误'
  }
  joining.value = false
}
</script>
