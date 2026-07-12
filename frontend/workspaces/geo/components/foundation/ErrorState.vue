<template>
  <div class="foundation-error">
    <div class="foundation-error__inner">
      <div class="foundation-error__icon">!</div>
      <h3 class="foundation-error__title">{{ title }}</h3>
      <p v-if="reason" class="foundation-error__reason">{{ reason }}</p>
      <p v-if="suggestion" class="foundation-error__suggestion">{{ suggestion }}</p>
      <button
        v-if="onRetry"
        class="foundation-error__retry"
        @click="onRetry"
      >
        重试
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  reason?: string
  suggestion?: string
  onRetry?: () => void
}>()
</script>

<style scoped>
.foundation-error {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 48px 24px;
  width: 100%;
}

.foundation-error__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 480px;
  width: 100%;
}

.foundation-error__icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  color: #ef4444;
  background: #fef2f2;
  border: 2px solid #fecaca;
  border-radius: 50%;
  margin-bottom: 16px;
  line-height: 1;
}

.foundation-error__title {
  font-size: 18px;
  font-weight: 700;
  color: #991b1b;
  margin: 0 0 8px 0;
}

.foundation-error__reason {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 6px 0;
  line-height: 1.5;
}

.foundation-error__suggestion {
  font-size: 14px;
  color: #94a3b8;
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.foundation-error__retry {
  display: inline-flex;
  align-items: center;
  padding: 10px 28px;
  background: #ef4444;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.foundation-error__retry:hover {
  background: #dc2626;
}

.foundation-error__retry:active {
  background: #b91c1c;
}
</style>
