<!--
  MediaPlannedPage — 预留模块统一空态页（Sprint-MEDIA-DESIGN-SYSTEM-01 暗色化）
  未实现功能必须明确 Empty State，禁止假数据
-->
<template>
  <MediaWorkspaceShell>
    <div class="mpp">
      <div class="mpp-card">
        <span class="mpp-icon">{{ icon }}</span>
        <h2 class="mpp-title">{{ title }}</h2>
        <p class="mpp-desc">{{ desc }}</p>
        <div class="mpp-plan">
          <span class="mpp-plan-tag">规划中</span>
          <span class="mpp-plan-text">{{ plan }}</span>
        </div>
        <button class="mpp-back" @click="goOverview">← 返回运营总览</button>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
const props = defineProps<{
  icon: string
  title: string
  desc: string
  plan: string
}>()

const router = useRouter()
const goOverview = () => router.push('/workspace/media/')
</script>

<style scoped>
.mpp {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}
.mpp-card {
  background: var(--media-card-bg);
  border: 1px dashed var(--media-ai-border);
  border-radius: var(--media-radius-card);
  padding: 48px 40px;
  text-align: center;
  max-width: 520px;
  width: 100%;
  box-shadow: var(--media-card-shadow);
}
.mpp-icon {
  font-size: 44px;
}
.mpp-title {
  margin: 14px 0 8px;
  font-size: 18px;
  font-weight: 800;
  color: var(--media-text-title);
}
.mpp-desc {
  font-size: 13px;
  color: var(--media-text-dim);
  line-height: 1.7;
  margin: 0 auto 16px;
  max-width: 400px;
}
.mpp-plan {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--media-radius-pill);
  padding: 8px 14px;
  margin-bottom: 20px;
}
.mpp-plan-tag {
  font-size: 11px;
  background: rgba(139, 92, 246, 0.12);
  color: var(--media-ai);
  border-radius: var(--media-radius-pill);
  padding: 2px 10px;
  font-weight: 700;
}
.mpp-plan-text {
  font-size: 12px;
  color: var(--media-text-dim);
}
.mpp-back {
  border: 1px solid var(--media-card-border);
  background: var(--media-card-bg-solid);
  border-radius: var(--media-radius-node);
  padding: 9px 18px;
  font-size: 13px;
  color: var(--media-text-body);
  cursor: pointer;
  transition: all 0.15s;
}
.mpp-back:hover {
  background: var(--media-ai-glow);
  border-color: var(--media-ai-border);
  color: var(--media-text-title);
}
</style>
