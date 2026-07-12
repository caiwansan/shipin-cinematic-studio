<template>
  <div class="cg-completion">
    <div class="cg-completion__card" :class="'cg-completion__card--' + status">
      <div v-if="status === 'pass'" class="cg-completion__inner">
        <div class="cg-completion__icon">✓</div>
        <h2 class="cg-completion__title">任务完成</h2>
        <p class="cg-completion__brand">{{ brand }}</p>
        <div class="cg-completion__result">
          <span class="cg-completion__result-label">结果：</span>
          <span class="cg-completion__result-value">已达标</span>
        </div>
        <p v-if="summary" class="cg-completion__summary">{{ summary }}</p>
        <div v-if="details.length > 0" class="cg-completion__details">
          <div v-for="(d, i) in details" :key="i" class="cg-completion__detail-row">
            <span class="cg-completion__detail-label">{{ d.label }}</span>
            <span class="cg-completion__detail-value">{{ d.value }}</span>
          </div>
        </div>
        <div class="cg-completion__actions">
          <button class="cg-completion__cta" @click="$emit('close')">关闭</button>
          <NuxtLink to="/workspace/geo/dashboard" class="cg-completion__link">返回工作台</NuxtLink>
        </div>
      </div>
      <div v-else class="cg-completion__inner">
        <div class="cg-completion__icon cg-completion__icon--fail">!</div>
        <h2 class="cg-completion__title">任务未完成</h2>
        <p class="cg-completion__brand">{{ brand }}</p>
        <div class="cg-completion__result cg-completion__result--fail">
          <span class="cg-completion__result-label">结果：</span>
          <span class="cg-completion__result-value">未达标</span>
        </div>
        <p v-if="failReason" class="cg-completion__summary cg-completion__summary--fail">{{ failReason }}</p>
        <div class="cg-completion__actions">
          <button class="cg-completion__cta" @click="$emit('retry')">重试</button>
          <NuxtLink to="/workspace/geo/dashboard" class="cg-completion__link">返回工作台</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  status: 'pass' | 'fail'
  brand: string
  summary?: string
  failReason?: string
  details?: Array<{ label: string; value: string }>
}>()
defineEmits<{
  close: []
  retry: []
}>()
</script>

<style scoped>
.cg-completion__card {
  border-radius: 16px;
  padding: 40px 36px;
  color: #fff;
}
.cg-completion__card--pass { background: linear-gradient(135deg, #166534 0%, #22c55e 100%); }
.cg-completion__card--fail { background: linear-gradient(135deg, #991b1b 0%, #ef4444 100%); }
.cg-completion__inner { text-align: center; }
.cg-completion__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  margin: 0 auto 20px;
}
.cg-completion__icon--fail { font-size: 32px; }
.cg-completion__title {
  font-size: 26px;
  font-weight: 800;
  margin: 0 0 8px;
}
.cg-completion__brand {
  font-size: 14px;
  opacity: 0.8;
  margin: 0 0 20px;
}
.cg-completion__result { margin-bottom: 12px; font-size: 16px; }
.cg-completion__result--fail .cg-completion__result-value { color: #fca5a5; }
.cg-completion__result-label { opacity: 0.7; margin-right: 8px; }
.cg-completion__result-value { font-weight: 700; }
.cg-completion__summary {
  font-size: 14px;
  opacity: 0.9;
  margin: 0 0 20px;
  line-height: 1.5;
}
.cg-completion__summary--fail { color: #fca5a5; }
.cg-completion__details {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 28px;
  text-align: left;
}
.cg-completion__detail-row { display: flex; gap: 16px; font-size: 14px; }
.cg-completion__detail-label { opacity: 0.7; min-width: 80px; }
.cg-completion__detail-value { font-weight: 600; }
.cg-completion__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.cg-completion__cta {
  padding: 12px 36px;
  background: #fff;
  color: #166534;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.cg-completion__card--fail .cg-completion__cta { color: #991b1b; }
.cg-completion__cta:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.cg-completion__link {
  display: inline-flex;
  align-items: center;
  padding: 12px 24px;
  background: rgba(255,255,255,0.15);
  color: #fff;
  border-radius: 10px;
  font-size: 14px;
  text-decoration: none;
}
</style>
