<template>
  <div class="geo-next-actions">
    <div class="geo-next-actions__row">
      <div class="geo-next-actions__info">
        <p class="geo-next-actions__desc">根据验证数据生成全面的品牌健康报告。</p>
      </div>
      <div class="geo-next-actions__actions">
        <button
          class="geo-next-actions__btn geo-next-actions__btn--primary"
          @click="emit('generate-report')"
        >
          📄 生成报告
        </button>
        <NuxtLink
          v-if="reportLink"
          :to="reportLink"
          class="geo-next-actions__btn geo-next-actions__btn--outline"
        >
          继续优化 →
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  entityName?: string
  reportLink?: string
}>()

const emit = defineEmits<{
  'generate-report': []
}>()
</script>

<style scoped>
.geo-next-actions {
  text-align: center;
  padding: 24px;
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border: 1px solid #bfdbfe;
  border-radius: 12px;
}

.geo-next-actions__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.geo-next-actions__desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.geo-next-actions__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.geo-next-actions__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
  border: none;
}

.geo-next-actions__btn--primary {
  background: #3b82f6;
  color: #fff;
}

.geo-next-actions__btn--primary:hover {
  background: #2563eb;
}

.geo-next-actions__btn--outline {
  background: transparent;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
}

.geo-next-actions__btn--outline:hover {
  background: #eff6ff;
}
</style>
