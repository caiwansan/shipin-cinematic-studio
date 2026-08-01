<!--
  MediaPlannedPage — 预留模块统一空态页

  Sprint-MEDIA-UX-01: 未实现功能必须明确 Empty State，禁止假数据
  本组件仅用于 messages / customers / analytics / team 四个预留模块
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
  background: #fff;
  border: 1px dashed #d5d5e0;
  border-radius: 16px;
  padding: 48px 40px;
  text-align: center;
  max-width: 520px;
  width: 100%;
}
.mpp-icon {
  font-size: 44px;
}
.mpp-title {
  margin: 14px 0 8px;
  font-size: 18px;
  color: #1a1a2e;
}
.mpp-desc {
  font-size: 13px;
  color: #8a8a9e;
  line-height: 1.7;
  margin: 0 auto 16px;
  max-width: 400px;
}
.mpp-plan {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f7f8fa;
  border-radius: 10px;
  padding: 8px 14px;
  margin-bottom: 20px;
}
.mpp-plan-tag {
  font-size: 11px;
  background: #f0f0f5;
  color: #9a9aad;
  border-radius: 10px;
  padding: 2px 8px;
}
.mpp-plan-text {
  font-size: 12px;
  color: #6b6b80;
}
.mpp-back {
  border: 1px solid #e2e2ea;
  background: #fff;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
}
.mpp-back:hover {
  background: #f5f5f8;
}
</style>
