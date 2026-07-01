<template>
  <GeoCard v-if="guide" class="geo-walkthrough-bar" variant="info">
    <div class="geo-walkthrough-bar__content">
      <div class="geo-walkthrough-bar__icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" />
          <path d="M10 6v4M10 13v.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </div>
      <p class="geo-walkthrough-bar__message">{{ guide.message }}</p>
      <button class="geo-walkthrough-bar__action" @click="handleAction">
        {{ guide.nextAction }} →
      </button>
      <button class="geo-walkthrough-bar__close" @click="handleDismiss" title="关闭引导" aria-label="Close guide">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </GeoCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { GuideInfo } from '../services/walkthroughService'
import { walkthroughService } from '../services/walkthroughService'
import GeoCard from './GeoCard/index.vue'

const props = defineProps<{
  guide: GuideInfo | null
}>()

const emit = defineEmits<{
  dismissed: []
  action: [url: string]
}>()

const router = useRouter()

async function handleDismiss() {
  try {
    await walkthroughService.dismiss()
  } catch {
    // Silent fail — don't block UX
  }
  emit('dismissed')
}

function handleAction() {
  if (props.guide?.nextUrl) {
    emit('action', props.guide.nextUrl)
    router.push(props.guide.nextUrl)
  }
}
</script>

<style scoped>
.geo-walkthrough-bar {
  margin-bottom: 20px;
  border: 1px solid #93c5fd;
  background: #eff6ff;
  border-radius: 10px;
}

.geo-walkthrough-bar__content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px;
}

.geo-walkthrough-bar__icon {
  color: #3b82f6;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  animation: geo-pulse 2s ease-in-out infinite;
}

@keyframes geo-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.geo-walkthrough-bar__message {
  flex: 1;
  font-size: 14px;
  color: #1e40af;
  margin: 0;
  line-height: 1.5;
  font-weight: 500;
}

.geo-walkthrough-bar__action {
  padding: 8px 18px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;
}

.geo-walkthrough-bar__action:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
}

.geo-walkthrough-bar__close {
  padding: 4px;
  background: transparent;
  color: #9ca3af;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.geo-walkthrough-bar__close:hover {
  background: #dbeafe;
  color: #374151;
}
</style>
