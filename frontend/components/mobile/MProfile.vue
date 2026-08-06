<template>
  <MPageShell title="个人主页" @close="$emit('close')">
    <!-- 会员卡 -->
    <div class="mp-hero">
      <img v-if="my.avatarUrl" class="mp-avatar mp-avatar-img" :src="my.avatarUrl" alt="" />
      <div v-else class="mp-avatar">{{ (my.nickname || my.username || '?').slice(0, 1) }}</div>
      <div class="mp-info">
        <div class="mp-name">{{ my.nickname || my.username || '未登录' }}</div>
        <div class="mp-tier">{{ tierLabel }}<span v-if="tierExpiry" class="mp-tier-exp">{{ tierExpiry }}</span></div>
      </div>
    </div>

    <div class="mp-card">
      <div class="mp-row"><span class="mp-k">账号 ID</span><span class="mp-v">{{ my.id || '-' }}</span></div>
      <div class="mp-row"><span class="mp-k">邮箱</span><span class="mp-v">{{ my.email || '-' }}</span></div>
      <div class="mp-row"><span class="mp-k">手机</span><span class="mp-v">{{ my.phone || '-' }}</span></div>
      <div class="mp-row"><span class="mp-k">会员等级</span><span class="mp-v">{{ tierLabel || '体验版' }}</span></div>
      <div class="mp-row"><span class="mp-k">到期时间</span><span class="mp-v">{{ my.memberExpiresAt ? new Date(my.memberExpiresAt).toLocaleDateString('zh-CN') : '永久' }}</span></div>
      <div class="mp-row"><span class="mp-k">注册时间</span><span class="mp-v">{{ my.createdAt ? new Date(my.createdAt).toLocaleDateString('zh-CN') : '-' }}</span></div>
    </div>

    <div class="mp-assets">
      <div class="mp-asset" @click="$emit('open', 'wallet')">
        <div class="mp-asset-num">¥{{ wallet }}</div>
        <div class="mp-asset-label">余额</div>
      </div>
      <div class="mp-asset" @click="$emit('open', 'credits')">
        <div class="mp-asset-num">{{ credits }}</div>
        <div class="mp-asset-label">积分</div>
      </div>
      <div class="mp-asset" @click="$emit('open', 'diamonds')">
        <div class="mp-asset-num">{{ diamonds }}</div>
        <div class="mp-asset-label">钻石</div>
      </div>
    </div>

    <div class="mp-menu">
      <div class="mp-menu-item" @click="$emit('open', 'orders')"><span class="mp-menu-icon">📦</span>我的订单<span class="mp-arrow">›</span></div>
      <div class="mp-menu-item" @click="$emit('open', 'team')"><span class="mp-menu-icon">👥</span>我的团队<span class="mp-arrow">›</span></div>
      <div class="mp-menu-item" @click="$emit('open', 'gifts')"><span class="mp-menu-icon">🎁</span>礼物记录<span class="mp-arrow">›</span></div>
      <div class="mp-menu-item" @click="$emit('open', 'messages')"><span class="mp-menu-icon">💬</span>我的消息<span class="mp-arrow">›</span></div>
      <div class="mp-menu-item" @click="$emit('open', 'referral')"><span class="mp-menu-icon">🎟️</span>邀请有礼<span class="mp-arrow">›</span></div>
      <div class="mp-menu-item" @click="$emit('open', 'gallery')"><span class="mp-menu-icon">🖼️</span>我的作品<span class="mp-arrow">›</span></div>
      <div class="mp-menu-item" @click="$emit('open', 'settings')"><span class="mp-menu-icon">⚙️</span>设置<span class="mp-arrow">›</span></div>
    </div>

    <button class="mp-logout" @click="logout">退出登录</button>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'
import { MEMBERSHIP_LABELS } from '~/constants/membership'

defineEmits<{ (e: 'close'): void; (e: 'open', page: string): void }>()

const my = ref<any>({})
const wallet = ref('0')
const credits = ref('0')
const diamonds = ref('0')
const tierLabel = ref('')
const tierExpiry = ref('')

onMounted(async () => {
  try {
    const r = await mobileAuthFetch('/api/auth/me')
    const j = await r.json()
    const u = j.user || j.data?.user || j
    my.value = u || {}
    const t = u?.memberTier || u?.membership?.tier
    if (t) {
      tierLabel.value = MEMBERSHIP_LABELS[t] || MEMBERSHIP_LABELS.free || t
      const exp = u?.memberExpiresAt
      tierExpiry.value = exp ? (new Date(exp).getTime() > Date.now() ? ' · ' + new Date(exp).toLocaleDateString('zh-CN') + ' 到期' : ' · 已过期') : ''
    } else {
      tierLabel.value = MEMBERSHIP_LABELS.free || '体验版'
    }
  } catch { /* ignore */ }
  try {
    const r = await mobileAuthFetch('/api/wallet')
    const j = await r.json()
    wallet.value = String(j.walletBalance ?? j.data?.walletBalance ?? j.balance ?? 0)
  } catch { /* ignore */ }
  try {
    const r = await mobileAuthFetch('/api/user/diamonds')
    const j = await r.json()
    diamonds.value = String((j.data || j).totalDiamonds || 0)
    if ((j.data || j).credits !== undefined) credits.value = String((j.data || j).credits)
  } catch { /* ignore */ }
})

function logout() {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('user')
    document.cookie = 'auth_token=; path=/; max-age=0'
    document.cookie = 'auth_user=; path=/; max-age=0'
  } catch { /* ignore */ }
  mobileToast('已退出登录')
  setTimeout(() => { window.location.href = '/' }, 600)
}
</script>

<style scoped>
.mp-hero { display: flex; align-items: center; gap: 12px; padding: 18px 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: #fff; }
.mp-avatar { width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; }
.mp-avatar-img { object-fit: cover; }
.mp-name { font-size: 17px; font-weight: 700; }
.mp-tier { font-size: 12px; opacity: .85; margin-top: 3px; }
.mp-tier-exp { opacity: .7; margin-left: 4px; }
.mp-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 4px 14px; }
.mp-row { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid #f2f2f2; font-size: 13px; }
.mp-row:last-child { border-bottom: none; }
.mp-k { color: #888; }
.mp-v { color: #222; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-assets { display: flex; gap: 10px; margin-top: 12px; }
.mp-asset { flex: 1; background: #fff; border-radius: 12px; padding: 14px 0; text-align: center; }
.mp-asset-num { font-size: 17px; font-weight: 700; color: #333; }
.mp-asset-label { font-size: 12px; color: #999; margin-top: 3px; }
.mp-menu { background: #fff; border-radius: 12px; margin-top: 12px; padding: 0 14px; }
.mp-menu-item { display: flex; align-items: center; gap: 10px; padding: 14px 0; border-bottom: 1px solid #f2f2f2; font-size: 14px; }
.mp-menu-item:last-child { border-bottom: none; }
.mp-menu-icon { font-size: 17px; }
.mp-arrow { margin-left: auto; color: #bbb; font-size: 18px; }
.mp-logout { width: 100%; margin-top: 16px; padding: 12px; border: none; border-radius: 10px; background: #fff; color: #e5484d; font-size: 15px; font-weight: 600; }
</style>
