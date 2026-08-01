<!--
  Sprint-MEDIA-UX-03 — AI 客服中心（客户运营 · 消息互动）
  会话流: 消息接入 → AI 接待 → 价值判断 → 真人接管
  纪律: 无真实会话 → 空态；Sprint-MEDIA-04 微信消息接入后点亮
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="Customer Engagement"
      title="消息互动"
      desc="AI 员工接待粉丝消息，判断客户价值，关键时刻转真人接管。"
    />

    <div class="mg-layout">
      <!-- 会话列 -->
      <div class="mg-list">
        <div class="mg-list-head">
          <span>会话</span>
          <span class="mg-list-count">{{ sessions.length }} 个</span>
        </div>
        <div v-if="sessions.length" class="mg-list-body">
          <div v-for="s in sessions" :key="s.id" class="mg-session">
            <span class="mg-avatar">{{ s.avatar }}</span>
            <div class="mg-session-meta">
              <div class="mg-session-name">{{ s.name }}</div>
              <div class="mg-session-last">{{ s.last }}</div>
            </div>
            <span class="mg-value-tag" :class="'v-' + (s.tier || 'c').toLowerCase()">{{ s.tier || 'C' }}级</span>
          </div>
        </div>
        <div v-else class="mg-list-empty">
          <MediaEmptyState icon="💬" title="暂无会话" desc="微信消息接入后，AI 客服会话将真实显示在这里。" source="微信消息接收 · Sprint-MEDIA-04" />
        </div>
      </div>

      <!-- 会话详情 -->
      <div class="mg-detail">
        <div class="mg-detail-placeholder">
          <MediaEmptyState icon="💬" title="选择会话查看对话" desc="AI 判断标签与转人工入口将在会话激活后可用。" source="AI 客服运行时 · Sprint-MEDIA-04" />
        </div>
      </div>
    </div>

    <!-- 客服工作流 -->
    <div class="mg-flow">
      <div class="mg-flow-title">🔄 AI 客服工作流</div>
      <div class="mg-flow-steps">
        <div class="mg-flow-step"><b>1</b> 消息接入<span>微信消息接收</span></div>
        <div class="mg-flow-step"><b>2</b> AI 接待<span>BYOK 模型真实回复</span></div>
        <div class="mg-flow-step"><b>3</b> 价值判断<span>A/B/C 分级</span></div>
        <div class="mg-flow-step"><b>4</b> 真人接管<span>A 级立即转人工</span></div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'
import MediaEmptyState from '~/components/media/MediaEmptyState.vue'

const sessions = ref<any[]>([])
</script>

<style scoped>
.mg-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  margin-bottom: 18px;
}
.mg-list {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  overflow: hidden;
  min-height: 400px;
}
.mg-list-head {
  display: flex;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border-primary);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.mg-list-count {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 400;
}
.mg-list-body {
  padding: 10px;
}
.mg-session {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
}
.mg-session:hover { background: var(--color-bg-hover); }
.mg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-intelligence-glow);
  color: var(--color-intelligence);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.mg-session-meta { flex: 1; min-width: 0; }
.mg-session-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.mg-session-last {
  font-size: 11px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mg-value-tag {
  font-size: 9px;
  font-weight: 800;
  border-radius: 8px;
  padding: 2px 8px;
  flex-shrink: 0;
}
.v-a { background: rgba(239, 68, 68, 0.15); color: var(--color-danger); }
.v-b { background: rgba(245, 158, 11, 0.12); color: var(--color-warning); }
.v-c { background: var(--color-bg-hover); color: var(--color-text-muted); }
.mg-list-empty { padding: 10px; }
.mg-detail {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mg-detail-placeholder { width: 100%; }
.mg-flow {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 18px 20px;
}
.mg-flow-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}
.mg-flow-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.mg-flow-step {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12px;
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mg-flow-step b { color: var(--color-decision); font-size: 14px; }
.mg-flow-step span { font-size: 10px; color: var(--color-text-muted); }
@media (max-width: 900px) {
  .mg-layout { grid-template-columns: 1fr; }
  .mg-flow-steps { grid-template-columns: 1fr 1fr; }
}
</style>
