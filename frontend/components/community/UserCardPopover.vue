<!--
  UserCardPopover.vue — 打赏名单/社区点头像弹出用户资料卡（COMMUNITY-TIP-01.1）
  未登录可查看公开信息；点关注未登录 → emit require-login；自己 → 显示「这是你」
-->
<template>
  <Teleport to="body">
    <div v-if="visible" class="uc-overlay" @click="close"></div>
    <div v-if="visible" class="uc-popover" :style="posStyle">
      <div v-if="loading" class="uc-loading">加载中…</div>
      <template v-else-if="card">
        <div class="uc-head">
          <div class="uc-avatar">
            <img v-if="card.avatar" :src="card.avatar" class="uc-avatar-img" alt="" />
            <span v-else>{{ card.name.slice(0, 1) }}</span>
          </div>
          <div class="uc-info">
            <div class="uc-name">
              {{ card.name }}
              <span v-if="card.online" class="uc-online"><i></i>在线</span>
              <span v-else class="uc-offline">离线</span>
            </div>
            <div class="uc-stats">
              <span><b>{{ card.followingCount }}</b> 关注</span>
              <span><b>{{ card.followerCount }}</b> 粉丝</span>
            </div>
          </div>
        </div>
        <div class="uc-foot">
          <button v-if="card.isSelf" class="uc-btn self" disabled>这是你</button>
          <button v-else class="uc-btn follow" :class="{ following: card.isFollowing }" @click="toggleFollow">
            {{ card.isFollowing ? '✓ 已关注' : '+ 关注' }}
          </button>
        </div>
      </template>
      <div v-else class="uc-loading">用户不存在</div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

const emit = defineEmits<{ (e: 'require-login'): void }>()

const visible = ref(false)
const loading = ref(false)
const card = ref<any>(null)
const pos = reactive({ x: 0, y: 0 })

const posStyle = computed(() => ({
  left: pos.x + 'px',
  top: pos.y + 'px',
}))

const apiBase = import.meta.server ? '' : (window as any).__API_BASE__ || ''

async function open(opts: { id: string; name: string; avatar?: string }, event: MouseEvent) {
  const r = event.currentTarget?.getBoundingClientRect()
  const winW = window.innerWidth
  const cardW = 280
  let x = r ? r.left : event.clientX
  let y = r ? r.bottom + 8 : event.clientY + 12
  if (x + cardW > winW - 12) x = Math.max(12, winW - cardW - 12)
  pos.x = x
  pos.y = y
  visible.value = true
  loading.value = true
  card.value = null
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`${apiBase}/api/user/card/${opts.id}`, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const j = await res.json()
    card.value = j?.data ?? null
  } catch {
    card.value = null
  } finally {
    loading.value = false
  }
}

function close() {
  visible.value = false
}

async function toggleFollow() {
  if (!card.value || card.value.isSelf) return
  const token = window.localStorage?.getItem('auth_token') || ''
  if (!token) {
    close()
    emit('require-login')
    return
  }
  const action = card.value.isFollowing ? 'unfollow' : 'follow'
  try {
    const res = await fetch(`${apiBase}/api/user/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ targetId: card.value.id }),
    })
    const j = await res.json()
    if (j.success !== false && j.error == null) {
      card.value.isFollowing = action === 'follow'
      card.value.followerCount += action === 'follow' ? 1 : -1
    }
  } catch { /* 忽略 */ }
}

defineExpose({ open, close })
</script>

<style scoped>
.uc-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: transparent;
}
.uc-popover {
  position: fixed;
  z-index: 301;
  width: 280px;
  background: #14141c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
}
.uc-loading {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  padding: 18px 0;
}
.uc-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.uc-avatar {
  width: 46px;
  height: 46px;
  min-width: 46px;
  border-radius: 50%;
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
  font-size: 1.25rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.uc-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.uc-info { min-width: 0; }
.uc-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.uc-online, .uc-offline {
  font-size: 0.65rem;
  font-weight: 400;
  color: #34d399;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.uc-online i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  display: inline-block;
}
.uc-offline { color: rgba(255, 255, 255, 0.3); }
.uc-stats {
  display: flex;
  gap: 14px;
  margin-top: 6px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}
.uc-stats b { color: rgba(255, 255, 255, 0.85); font-weight: 600; }
.uc-foot { margin-top: 14px; }
.uc-btn {
  width: 100%;
  padding: 8px 0;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(249, 115, 22, 0.35);
  background: rgba(249, 115, 22, 0.12);
  color: #f97316;
  transition: all 0.15s;
}
.uc-btn:hover { background: rgba(249, 115, 22, 0.22); }
.uc-btn.following {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
}
.uc-btn.following:hover { background: rgba(255, 255, 255, 0.1); }
.uc-btn.self {
  border-color: rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.35);
  cursor: default;
}
</style>
