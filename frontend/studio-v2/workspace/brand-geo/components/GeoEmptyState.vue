<template>
  <div class="geo-empty-state" :class="`geo-empty-state--${size}`">
    <div class="geo-empty-state-icon">{{ icon }}</div>
    <h4 v-if="title" class="geo-empty-state-title">{{ title }}</h4>
    <p class="geo-empty-state-desc">{{ description }}</p>
    <slot name="actions">
      <button v-if="actionLabel" class="geo-btn" :class="actionClass" @click="$emit('action')">
        {{ actionLabel }}
      </button>
    </slot>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
  actionLabel?: string
  actionClass?: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  icon: '📭',
  description: '暂无内容',
  size: 'md',
  actionClass: 'geo-btn geo-btn-primary',
})

defineEmits<{
  action: []
}>()
</script>

<style scoped>
.geo-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.06);
}
.geo-empty-state--sm { padding: 24px 16px; }
.geo-empty-state--lg {
  padding: 64px 32px;
  min-height: 300px;
}

.geo-empty-state-icon { font-size: 48px; margin-bottom: 16px; line-height: 1; }
.geo-empty-state--sm .geo-empty-state-icon { font-size: 32px; }
.geo-empty-state--lg .geo-empty-state-icon { font-size: 64px; }

.geo-empty-state-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #ccc;
}
.geo-empty-state--sm .geo-empty-state-title { font-size: 14px; }
.geo-empty-state--lg .geo-empty-state-title { font-size: 18px; }

.geo-empty-state-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: #6b7280;
  max-width: 360px;
  line-height: 1.5;
}
.geo-empty-state--sm .geo-empty-state-desc { font-size: 12px; margin-bottom: 12px; }

.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
</style>
