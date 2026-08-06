<template>
  <MPageShell title="礼物记录" @close="$emit('close')">
    <div class="mgf-hero">
      <div class="mgf-num">{{ total || 0 }}</div>
      <div class="mgf-label">我收到的礼物 🎁</div>
    </div>
    <div class="mgf-card">
      <div v-if="!records.length" class="mgf-empty">还没有收到礼物</div>
      <div v-for="r in records" :key="r.id" class="mgf-item">
        <div class="mgf-icon">{{ r.giftIcon || '🎁' }}</div>
        <div class="mgf-info">
          <div class="mgf-name">{{ r.giftName }} <span class="mgf-price">💎{{ r.priceDiamonds }}</span></div>
          <div class="mgf-sub">{{ r.senderName }} 送给你 · {{ (r.createdAt || '').slice(0, 10) }}</div>
        </div>
        <div v-if="r.coinsAwarded" class="mgf-award">+{{ r.coinsAwarded }}</div>
      </div>
    </div>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const records = ref<any[]>([])
const total = ref(0)

onMounted(async () => {
  try {
    const r = await mobileAuthFetch('/api/gifts/received?limit=50')
    const j = await r.json()
    records.value = j.data?.records || []
    total.value = j.data?.total || 0
  } catch { /* ignore */ }
})
</script>

<style scoped>
.mgf-hero { background: linear-gradient(135deg, #f472b6 0%, #a855f7 100%); border-radius: 12px; padding: 22px 18px; color: #fff; text-align: center; }
.mgf-num { font-size: 36px; font-weight: 800; }
.mgf-label { font-size: 13px; opacity: .9; margin-top: 4px; }
.mgf-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 14px; }
.mgf-empty { text-align: center; color: #999; font-size: 13px; padding: 24px 0; }
.mgf-item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #f4f4f4; }
.mgf-item:last-child { border-bottom: none; }
.mgf-icon { font-size: 26px; }
.mgf-info { flex: 1; }
.mgf-name { font-size: 14px; font-weight: 600; }
.mgf-price { font-size: 12px; color: #a855f7; margin-left: 4px; }
.mgf-sub { font-size: 12px; color: #999; margin-top: 2px; }
.mgf-award { background: #fdf2f8; color: #d946ef; font-size: 12px; padding: 3px 8px; border-radius: 10px; }
</style>
