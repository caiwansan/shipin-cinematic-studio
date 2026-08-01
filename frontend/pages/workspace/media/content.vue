<!--
  Sprint-MEDIA-UX-02 — 内容生产中心
  四阶段流水线: AI策划 → AI生产 → 审核 → 发布
  纪律: 真实数据 + 空态；微信发布回流（Sprint-MEDIA-01）后自动填充
-->
<template>
  <MediaWorkspaceShell>
    <div class="cc">
      <div class="cc-head">
        <div>
          <h2 class="cc-title">📝 内容生产中心</h2>
          <p class="cc-sub">AI 策划选题 → AI 生产稿件 → 合规审核 → 发布回流，全流程真实闭环</p>
        </div>
        <div class="cc-stages">
          <div v-for="(s, i) in stages" :key="s.key" class="cc-stage" :class="{ 'is-current': i === 0 }">
            <span class="cc-stage-ico">{{ s.icon }}</span>
            <span class="cc-stage-name">{{ s.name }}</span>
            <span class="cc-stage-count">{{ s.count }}</span>
          </div>
        </div>
      </div>

      <!-- 四阶段面板 -->
      <div class="cc-grid">
        <div v-for="s in stages" :key="s.key" class="cc-panel">
          <div class="cc-panel-head">
            <span class="cc-panel-title">{{ s.icon }} {{ s.name }}</span>
            <span class="cc-panel-note">{{ s.note }}</span>
          </div>
          <div class="cc-panel-body">
            <template v-if="s.count > 0">
              <div v-for="(it, i) in s.items" :key="i" class="cc-item">
                <span class="cc-item-dot"></span>
                <span class="cc-item-text">{{ it.title }}</span>
                <span class="cc-item-time">{{ it.time }}</span>
              </div>
            </template>
            <div v-else class="cc-empty">
              <p>{{ s.emptyText }}</p>
              <p class="cc-empty-sub">{{ s.emptySub }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 流程说明（真实链路，非 mock） -->
      <div class="cc-flow">
        <h3 class="cc-flow-title">🔁 真实生产链路</h3>
        <div class="cc-flow-steps">
          <div class="cc-flow-step"><b>1</b> AI 员工选题策划<span class="cc-flow-tag">AgentSchedule · content</span></div>
          <div class="cc-flow-step"><b>2</b> AI 生产稿件（文章/视频文案）<span class="cc-flow-tag">BYOK 模型真实生成</span></div>
          <div class="cc-flow-step"><b>3</b> 合规审核（平台规则）<span class="cc-flow-tag">审核队列</span></div>
          <div class="cc-flow-step"><b>4</b> 发布到微信<span class="cc-flow-tag">Sprint-MEDIA-01 接入后启用</span></div>
          <div class="cc-flow-step"><b>5</b> 数据回流（阅读/互动）<span class="cc-flow-tag">datacube 回流后启用</span></div>
        </div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'

// 真实数据源: 当前 media 业务线 outcomes 为空 → 空态
// 接入后: 策划(PLAN_CREATED) / 生产(PUBLISH_READY) / 审核(REVIEW_PENDING) / 发布(PUBLISHED)
const stages = ref([
  {
    key: 'plan', icon: '💡', name: 'AI 策划', count: 0, note: '选题 · 排期',
    emptyText: '今日暂无策划选题', emptySub: 'AI 员工执行策划任务后真实展示', items: [],
  },
  {
    key: 'produce', icon: '✍️', name: 'AI 生产', count: 0, note: '文章 · 视频文案',
    emptyText: '暂无生产中的稿件', emptySub: '策划确认后自动进入生产', items: [],
  },
  {
    key: 'review', icon: '🔍', name: '合规审核', count: 0, note: '平台规则检查',
    emptyText: '审核队列为空', emptySub: '生产完成的稿件待审核', items: [],
  },
  {
    key: 'publish', icon: '🚀', name: '发布', count: 0, note: '微信 · 后续多平台',
    emptyText: '暂无待发布/已发布内容', emptySub: '微信账号连接（Sprint-MEDIA-01）后真实发布', items: [],
  },
])
</script>

<style scoped>
.cc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
  gap: 16px;
  flex-wrap: wrap;
}
.cc-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}
.cc-sub {
  font-size: 12px;
  color: #8a8a9e;
  margin: 4px 0 0;
}
.cc-stages {
  display: flex;
  gap: 8px;
}
.cc-stage {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 12px;
  color: #5a5a70;
}
.cc-stage.is-current {
  border-color: #2563eb;
  color: #2563eb;
  background: #f4f7ff;
}
.cc-stage-ico { font-size: 13px; }
.cc-stage-count {
  background: #2563eb;
  color: #fff;
  border-radius: 10px;
  font-size: 11px;
  padding: 0 7px;
  font-weight: 700;
}
.cc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
.cc-panel {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  overflow: hidden;
}
.cc-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f1f5;
  background: #fafafc;
}
.cc-panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #333;
}
.cc-panel-note {
  font-size: 11px;
  color: #9a9aad;
}
.cc-panel-body {
  padding: 12px 14px;
  min-height: 130px;
}
.cc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #444;
  padding: 6px 0;
  border-bottom: 1px dashed #f1f1f5;
}
.cc-item:last-child { border-bottom: none; }
.cc-item-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
  flex-shrink: 0;
}
.cc-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-item-time {
  margin-left: auto;
  font-size: 11px;
  color: #9a9aad;
  white-space: nowrap;
}
.cc-empty {
  text-align: center;
  padding: 26px 10px;
  color: #8a8a9e;
  font-size: 13px;
}
.cc-empty-sub {
  font-size: 11px;
  color: #b0b0c0;
  margin-top: 4px;
  line-height: 1.5;
}
.cc-flow {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 16px 18px;
}
.cc-flow-title {
  font-size: 13px;
  font-weight: 700;
  color: #333;
  margin: 0 0 12px;
}
.cc-flow-steps {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.cc-flow-step {
  flex: 1;
  min-width: 160px;
  font-size: 12px;
  color: #444;
  background: #fafafc;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-flow-step b {
  color: #2563eb;
  font-size: 15px;
}
.cc-flow-tag {
  font-size: 10px;
  color: #9a9aad;
  background: #f1f1f5;
  border-radius: 8px;
  padding: 2px 8px;
  align-self: flex-start;
}
@media (max-width: 900px) {
  .cc-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
