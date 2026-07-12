<template>
  <div class="geo-cta-footer">
    <div class="geo-cta-footer__content">
      <div class="geo-cta-footer__text">
        <span class="geo-cta-footer__next-label">下一步</span>
        <span class="geo-cta-footer__step-name">{{ nextStepLabel }}</span>
      </div>
      <div class="geo-cta-footer__actions">
        <button
          v-if="secondaryAction"
          class="geo-cta-footer__btn geo-cta-footer__btn--secondary"
          @click="secondaryAction.onClick"
        >
          {{ secondaryAction.label }}
        </button>
        <button
          v-if="primaryAction"
          class="geo-cta-footer__btn geo-cta-footer__btn--primary"
          @click="primaryAction.onClick"
        >
          {{ primaryAction.label }}
          <span class="geo-cta-footer__arrow">→</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface CTAAction {
  label: string
  onClick: () => void
}

defineProps<{
  nextStepLabel: string
  primaryAction: CTAAction | null
  secondaryAction?: CTAAction | null
}>()
</script>

<style scoped>
.geo-cta-footer {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.geo-cta-footer__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.geo-cta-footer__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-cta-footer__next-label {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.geo-cta-footer__step-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.geo-cta-footer__actions {
  display: flex;
  gap: 12px;
}

.geo-cta-footer__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  font-family: inherit;
  white-space: nowrap;
}

.geo-cta-footer__btn--primary {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
}

.geo-cta-footer__btn--primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.geo-cta-footer__btn--secondary {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #e5e7eb;
}

.geo-cta-footer__btn--secondary:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.geo-cta-footer__arrow {
  font-size: 16px;
}

@media (max-width: 640px) {
  .geo-cta-footer__content {
    flex-direction: column;
    align-items: stretch;
  }

  .geo-cta-footer__actions {
    flex-direction: column;
  }

  .geo-cta-footer__btn {
    justify-content: center;
  }
}
</style>
