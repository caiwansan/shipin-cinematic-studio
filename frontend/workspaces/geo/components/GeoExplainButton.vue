<template>
  <button class="geo-explain-btn" @click="$emit('click')" title="解释 AI 输出">
    <span class="geo-explain-btn__icon">ⓘ</span>
  </button>
</template>

<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>

<style scoped>
.geo-explain-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.15s;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.geo-explain-btn:hover {
  color: #3b82f6;
  background: #eff6ff;
}

.geo-explain-btn:active {
  color: #2563eb;
  background: #dbeafe;
}
</style>
