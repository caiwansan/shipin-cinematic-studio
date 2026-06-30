<template>
  <header class="geo-topbar">
    <div class="geo-topbar-left">
      <div class="geo-topbar-breadcrumb">
        <span class="geo-topbar-breadcrumb-item" @click="$emit('navigate', 'dashboard')">GEO</span>
        <span v-if="breadcrumb" class="geo-topbar-breadcrumb-sep">/</span>
        <span v-if="breadcrumb" class="geo-topbar-breadcrumb-item">{{ breadcrumb }}</span>
      </div>
      <h2 class="geo-topbar-title">{{ title }}</h2>
    </div>
    <div class="geo-topbar-right">
      <span v-if="projectName" class="geo-topbar-tag geo-topbar-tag--project">
        📦 {{ projectName }}
      </span>
      <button
        v-if="error"
        class="geo-topbar-tag geo-topbar-tag--error"
        @click="$emit('dismiss-error')"
      >
        ⚠️ {{ error }}
      </button>
      <div v-if="loading" class="geo-topbar-loading">
        <span class="geo-loading-spinner geo-loading-spinner--sm"></span>
        <span>加载中...</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  breadcrumb?: string
  loading?: boolean
  error?: string | null
  projectName?: string
}>()

defineEmits<{
  navigate: [panelId: string]
  'dismiss-error': []
}>()
</script>

<style scoped>
.geo-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 10, 18, 0.6);
  backdrop-filter: blur(8px);
  min-height: 48px;
  flex-shrink: 0;
}

.geo-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.geo-topbar-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}

.geo-topbar-breadcrumb-item {
  cursor: pointer;
  transition: color 0.15s;
}
.geo-topbar-breadcrumb-item:hover {
  color: #a78bfa;
}

.geo-topbar-breadcrumb-sep {
  color: #4b5563;
}

.geo-topbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
}

.geo-topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.geo-topbar-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  white-space: nowrap;
}
.geo-topbar-tag--project {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
}
.geo-topbar-tag--error {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  cursor: pointer;
}

.geo-topbar-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
</style>
