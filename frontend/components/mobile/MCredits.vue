<template>
  <MPageShell title="我的积分" @close="$emit('close')">
    <div class="mc-hero">
      <div class="mc-num">{{ total }}</div>
      <div class="mc-label">可用积分 ⭐</div>
    </div>
    <div class="mc-card">
      <div class="mc-card-title">📜 积分明细</div>
      <div v-if="!logs.length" class="mc-empty">暂无积分记录</div>
      <div v-for="(l, i) in logs" :key="i" class="mc-item">
        <div class="mc-item-main">
          <span class="mc-item-title">{{ l.title || l.description || l.type || '积分变动' }}</span>
          <span class="mc-item-time">{{ (l.createdAt || '').slice(0, 10) }}</span>
        </div>
        <span class="mc-item-delta" :class="{ plus: (l.delta ?? l.change ?? 0) >= 0 }">{{ (l.delta ?? l.change ?? 0) >= 0 ? '+' : '' }}{{ l.delta ?? l.change ?? 0 }}</span>
      </div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const total = ref(0)
const logs = ref<any[]>([])
onMounted(async () => {
  try {
    const r = await mobileAuthFetch('/api/user/credits/logs')
    const j = await r.json()
    logs.value = j.logs || []
    total.value = j.total || 0
  } catch { /* ignore */ }
})
</script>

<style scoped>
.mc-hero { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 12px; padding: 22px 18px; color: #fff; text-align: center; }
.mc-num { font-size: 36px; font-weight: 800; }
.mc-label { font-size: 13px; opacity: .9; margin-top: 4px; }
.mc-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 14px; }
.mc-card-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.mc-empty { text-align: center; color: #999; font-size: 13px; padding: 16px 0; }
.mc-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f4f4f4; }
.mc-item:last-child { border-bottom: none; }
.mc-item-main { display: flex; flex-direction: column; gap: 2px; }
.mc-item-title { font-size: 13px; }
.mc-item-time { color: #aaa; font-size: 12px; }
.mc-item-delta { font-weight: 700; color: #999; }
.mc-item-delta.plus { color: #22c55e; }
</style>
