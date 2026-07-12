<template>
  <Teleport to="body">
    <div class="ui-toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="msg in toasts"
          :key="msg.id"
          :class="['ui-toast', `ui-toast--${msg.type}`]"
          @click="msg.route ? navigateTo(msg.route) : undefined"
        >
          <div class="ui-toast__icon">{{ typeIcon(msg.type) }}</div>
          <div class="ui-toast__body">
            <div class="ui-toast__title">{{ msg.title }}</div>
            <div v-if="msg.detail" class="ui-toast__detail">{{ msg.detail }}</div>
          </div>
          <div v-if="msg.route" class="ui-toast__arrow">→</div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useToastState } from '~/composables/useToast'

const { toasts } = useToastState()
const router = useRouter()

function typeIcon(type: string): string {
  return type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✗' : 'ℹ'
}

function navigateTo(route: string) {
  router.push(route)
}
</script>

<style scoped>
.ui-toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.ui-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  cursor: pointer;
  pointer-events: auto;
  max-width: 400px;
  transition: transform 0.2s, opacity 0.2s;
}
.ui-toast:hover { transform: translateX(-4px); }

.ui-toast--success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
.ui-toast--warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.ui-toast--error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.ui-toast--info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }

.ui-toast__icon {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}
.ui-toast--success .ui-toast__icon { background: #a7f3d0; }
.ui-toast--warning .ui-toast__icon { background: #fde68a; }
.ui-toast--error .ui-toast__icon { background: #fecaca; }
.ui-toast--info .ui-toast__icon { background: #bfdbfe; }

.ui-toast__body { flex: 1; min-width: 0; }
.ui-toast__title { font-size: 14px; font-weight: 600; }
.ui-toast__detail { font-size: 12px; opacity: 0.8; }
.ui-toast__arrow { font-size: 16px; color: inherit; opacity: 0.5; }

/* Transition */
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(40px); }
.toast-leave-to { opacity: 0; transform: translateX(40px); }
</style>
