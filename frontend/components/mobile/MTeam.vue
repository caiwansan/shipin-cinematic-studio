<template>
  <MPageShell title="我的伙伴" @close="$emit('close')">
    <div class="mt-stats">
      <div class="mt-stat"><div class="mt-num">{{ team.teamTotal || 0 }}</div><div class="mt-lb">伙伴总人数</div></div>
      <div class="mt-stat"><div class="mt-num">{{ (team.level1 || []).length || team.directCount || 0 }}</div><div class="mt-lb">直接邀请</div></div>
      <div class="mt-stat"><div class="mt-num">{{ (team.level2 || []).length || team.indirectCount || 0 }}</div><div class="mt-lb">间接邀请</div></div>
    </div>

    <div class="mt-card">
      <div class="mt-card-title">🔗 我的邀请</div>
      <div class="mt-qr-wrap">
        <img v-if="inviteQr" class="mt-qr" :src="inviteQr" alt="邀请二维码" />
        <div v-else class="mt-qr-loading">{{ inviteLoading ? '生成中…' : (team.referralUrl ? '⚠️ 二维码生成失败' : '暂无邀请链接') }}</div>
      </div>
      <div v-if="team.referralCode" class="mt-code-line">邀请码 <b>{{ team.referralCode }}</b></div>
      <button class="mt-btn" @click="copy(team.referralUrl || team.referralCode)">复制邀请链接</button>
      <p v-if="team.referralUrl" class="mt-url">{{ team.referralUrl }}</p>
      <p class="mt-hint">好友扫码或通过链接注册后，会自动记录为你的伙伴；他再邀请的人就是你的间接伙伴。</p>
    </div>

    <div class="mt-card">
      <div class="mt-card-title">👤 一级伙伴 · 直接邀请（{{ (team.level1 || []).length }}）</div>
      <div v-if="!(team.level1 || []).length" class="mt-empty">暂无直接邀请的伙伴，快去分享邀请二维码吧</div>
      <div v-for="m in (team.level1 || [])" :key="'l1' + m.id" class="mt-item">
        <div class="mt-avatar">{{ (m.username || '?').slice(0, 1) }}</div>
        <div class="mt-info">
          <div class="mt-name">{{ m.username || '茶友' }}</div>
          <div class="mt-sub">{{ m.memberTier || 'free' }} · {{ (m.joinedAt || '').slice(0, 10) }} 注册</div>
        </div>
      </div>
    </div>

    <div class="mt-card">
      <div class="mt-card-title">👥 二级伙伴 · 间接邀请（{{ (team.level2 || []).length }}）</div>
      <div v-if="!(team.level2 || []).length" class="mt-empty">暂无间接邀请的伙伴</div>
      <div v-for="m in (team.level2 || [])" :key="'l2' + m.id" class="mt-item">
        <div class="mt-avatar l2">{{ (m.username || '?').slice(0, 1) }}</div>
        <div class="mt-info">
          <div class="mt-name">{{ m.username || '茶友' }}</div>
          <div class="mt-sub">{{ m.memberTier || 'free' }} · {{ (m.joinedAt || '').slice(0, 10) }} 注册</div>
        </div>
      </div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const team = ref<any>({})
const inviteQr = ref('')
const inviteLoading = ref(false)

onMounted(async () => {
  try {
    const r = await mobileAuthFetch('/api/user/team')
    const j = await r.json()
    team.value = j.data || {}
  } catch { /* ignore */ }
  // 加载邀请二维码
  await loadInviteQr()
})

async function loadInviteQr() {
  const url = team.value.referralUrl
  if (!url) { inviteLoading.value = false; return }
  inviteLoading.value = true
  try {
    inviteQr.value = await QRCode.toDataURL(url, { width: 200, margin: 1 })
  } catch {
    inviteQr.value = ''
  } finally {
    inviteLoading.value = false
  }
}

async function copy(txt: string) {
  if (!txt) return
  try {
    await navigator.clipboard.writeText(txt)
    mobileToast('✅ 已复制')
  } catch {
    mobileToast('复制失败，请长按手动复制')
  }
}
</script>

<style scoped>
.mt-stats { display: flex; gap: 10px; }
.mt-stat { flex: 1; background: #fff; border-radius: 12px; padding: 16px 0; text-align: center; }
.mt-num { font-size: 20px; font-weight: 800; color: #4f7df9; }
.mt-lb { font-size: 12px; color: #999; margin-top: 4px; }
.mt-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 14px; }
.mt-card-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.mt-qr-wrap { display: flex; justify-content: center; padding: 10px 0; }
.mt-qr { width: 200px; height: 200px; border-radius: 10px; border: 1px solid #eee; background: #fff; display: block; }
.mt-qr-loading { width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: 13px; border: 1px dashed #eee; border-radius: 10px; }
.mt-code-line { font-size: 13px; color: #666; text-align: center; margin: 4px 0 10px; }
.mt-code-line b { color: #4f7df9; font-size: 15px; letter-spacing: 2px; }
.mt-btn { width: 100%; padding: 10px; border: none; border-radius: 8px; background: #4f7df9; color: #fff; font-size: 14px; }
.mt-url { font-size: 12px; color: #999; word-break: break-all; margin: 8px 0 0; }
.mt-hint { font-size: 12px; color: #aaa; margin-top: 8px; line-height: 1.5; }
.mt-empty { text-align: center; color: #999; font-size: 13px; padding: 16px 0; }
.mt-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f4f4f4; }
.mt-item:last-child { border-bottom: none; }
.mt-avatar { width: 36px; height: 36px; border-radius: 50%; background: #eef3ff; color: #4f7df9; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.mt-avatar.l2 { background: #f3f4f6; color: #9ca3af; }
.mt-name { font-size: 14px; font-weight: 600; }
.mt-sub { font-size: 12px; color: #999; margin-top: 2px; }
</style>
