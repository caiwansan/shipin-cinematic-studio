<template>
  <MPageShell title="我的团队" @close="$emit('close')">
    <div class="mt-stats">
      <div class="mt-stat"><div class="mt-num">{{ team.teamTotal || 0 }}</div><div class="mt-lb">团队总人数</div></div>
      <div class="mt-stat"><div class="mt-num">{{ team.directCount || 0 }}</div><div class="mt-lb">直接邀请</div></div>
      <div class="mt-stat"><div class="mt-num">¥{{ team.value || 0 }}</div><div class="mt-lb">团队产值</div></div>
    </div>
    <div class="mt-card">
      <div class="mt-card-title">🔗 我的邀请</div>
      <div class="mt-code">{{ team.referralCode || '—' }}</div>
      <button class="mt-btn" @click="copy(team.referralUrl || team.referralCode)">复制邀请链接</button>
      <p v-if="team.referralUrl" class="mt-url">{{ team.referralUrl }}</p>
    </div>
    <div class="mt-card">
      <div class="mt-card-title">👥 团队成员（{{ members.length }}）</div>
      <div v-if="!members.length" class="mt-empty">暂无成员，快去邀请吧</div>
      <div v-for="m in members" :key="m.id" class="mt-item">
        <div class="mt-avatar">{{ (m.username || '?').slice(0, 1) }}</div>
        <div class="mt-info">
          <div class="mt-name">{{ m.username || '茶友' }}</div>
          <div class="mt-sub">{{ m.memberTier || 'free' }} · {{ (m.joinedAt || '').slice(0, 10) }}</div>
        </div>
      </div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const team = ref<any>({})
const members = ref<any[]>([])

onMounted(async () => {
  try {
    const r = await mobileAuthFetch('/api/user/team')
    const j = await r.json()
    team.value = j.data || {}
    members.value = team.value.members || []
  } catch { /* ignore */ }
})

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
.mt-code { font-size: 26px; font-weight: 800; letter-spacing: 3px; text-align: center; color: #4f7df9; padding: 10px 0; }
.mt-btn { width: 100%; padding: 10px; border: none; border-radius: 8px; background: #4f7df9; color: #fff; font-size: 14px; }
.mt-url { font-size: 12px; color: #999; word-break: break-all; margin: 8px 0 0; }
.mt-empty { text-align: center; color: #999; font-size: 13px; padding: 16px 0; }
.mt-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f4f4f4; }
.mt-item:last-child { border-bottom: none; }
.mt-avatar { width: 36px; height: 36px; border-radius: 50%; background: #eef3ff; color: #4f7df9; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.mt-name { font-size: 14px; font-weight: 600; }
.mt-sub { font-size: 12px; color: #999; margin-top: 2px; }
</style>
