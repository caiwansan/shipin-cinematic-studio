<template>
  <MPageShell title="邀请有礼" @close="$emit('close')">
    <div class="mr-card hero">
      <div class="mr-code-label">我的邀请码</div>
      <div class="mr-code">{{ referralCode || '—' }}</div>
      <button class="mr-copy" @click="copy(referralCode)">复制邀请码</button>
      <p v-if="referralUrl" class="mr-url" @click="copy(referralUrl)">{{ referralUrl }}</p>
    </div>
    <div class="mr-card">
      <div class="mr-stat"><span class="mr-stat-num">¥{{ totalRewardCoins || 0 }}</span><span class="mr-stat-lb">累计邀请奖励</span></div>
      <div class="mr-stat"><span class="mr-stat-num">{{ children.length }}</span><span class="mr-stat-lb">已邀请人数</span></div>
    </div>
    <div class="mr-card">
      <div class="mr-card-title">👥 邀请明细</div>
      <div v-if="!children.length" class="mr-empty">还没有邀请记录</div>
      <div v-for="c in children" :key="c.id || c.email" class="mr-item">
        <div class="mr-info">
          <div class="mr-name">{{ c.username || c.email || '茶友' }}</div>
          <div class="mr-sub">{{ (c.createdAt || '').slice(0, 10) }}</div>
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
const referralCode = ref('')
const referralUrl = ref('')
const totalRewardCoins = ref(0)
const children = ref<any[]>([])

onMounted(async () => {
  try {
    const r = await mobileAuthFetch('/api/user/promo')
    const j = await r.json()
    referralUrl.value = j.referralUrl || ''
    referralCode.value = j.referralCode || ''
    totalRewardCoins.value = j.totalRewardCoins || 0
    children.value = j.children || []
  } catch {
    try {
      const r2 = await mobileAuthFetch('/api/user/referral-code')
      const j2 = await r2.json()
      referralUrl.value = j2.referralUrl || ''
      referralCode.value = j2.referralCode || ''
    } catch { /* ignore */ }
  }
})

async function copy(txt: string) {
  if (!txt) return
  try {
    await navigator.clipboard.writeText(txt)
    mobileToast('✅ 已复制')
  } catch { mobileToast('复制失败，请长按手动复制') }
}
</script>

<style scoped>
.mr-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 16px; }
.mr-card.hero { text-align: center; background: linear-gradient(135deg, #ff9a56 0%, #ff5f6d 100%); color: #fff; }
.mr-code-label { font-size: 13px; opacity: .9; }
.mr-code { font-size: 30px; font-weight: 800; letter-spacing: 4px; margin: 8px 0; }
.mr-copy { border: 1px solid rgba(255,255,255,.7); background: transparent; color: #fff; padding: 7px 20px; border-radius: 18px; font-size: 13px; }
.mr-url { font-size: 12px; opacity: .85; word-break: break-all; margin-top: 10px; }
.mr-stat { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.mr-stat-num { font-size: 22px; font-weight: 800; color: #ff5f6d; }
.mr-stat-lb { font-size: 13px; color: #666; }
.mr-card-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.mr-empty { text-align: center; color: #999; font-size: 13px; padding: 14px 0; }
.mr-item { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f4f4f4; }
.mr-item:last-child { border-bottom: none; }
.mr-name { font-size: 14px; }
.mr-sub { font-size: 12px; color: #999; margin-top: 2px; }
</style>
