<!--
  Sprint-MEDIA-PRODUCT-ONBOARDING-01B — 能力双栏（免费 vs AI 员工订阅）
  产品表达: 每个节点回答「现在免费用户能做什么？订阅 AI 员工后自动增加什么？」
  纪律: 纯展示组件，无数据、无业务逻辑；AI 能力一律 🔒 标识
-->
<template>
  <div class="mcs">
    <div class="mcs-col mcs-free">
      <div class="mcs-col-head">
        <span class="mcs-tag free">✅ 免费</span>
        <span class="mcs-col-title">现在就能做</span>
      </div>
      <div class="mcs-col-body">{{ free }}</div>
    </div>
    <div class="mcs-arrow">→</div>
    <div class="mcs-col mcs-ai">
      <div class="mcs-col-head">
        <span class="mcs-tag ai">🔒 AI 员工</span>
        <span class="mcs-col-title">订阅后自动增加</span>
      </div>
      <div class="mcs-col-body">{{ ai }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  free: string
  ai: string
}>()
</script>

<style scoped>
.mcs {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: stretch;
  padding: 6px 4px;
}
.mcs-col {
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid var(--color-border-primary);
}
.mcs-free {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.25);
}
.mcs-ai {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-primary);
  border-left: 3px solid var(--color-warning);
}
.mcs-col-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.mcs-tag {
  font-size: 9px;
  font-weight: 800;
  border-radius: 8px;
  padding: 2px 8px;
  white-space: nowrap;
}
.mcs-tag.free {
  color: var(--color-execution);
  background: rgba(16, 185, 129, 0.14);
}
.mcs-tag.ai {
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.14);
}
.mcs-col-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
}
.mcs-col-body {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-primary);
}
.mcs-arrow {
  align-self: center;
  font-size: 16px;
  color: var(--color-text-muted);
}
@media (max-width: 640px) {
  .mcs { grid-template-columns: 1fr; }
  .mcs-arrow { transform: rotate(90deg); align-self: center; }
}
</style>
