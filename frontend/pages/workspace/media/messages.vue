<!--
  Sprint-MEDIA-UX-02 — AI 客服中心
  交互框架: 会话列 + AI 判断标签（高价值识别）+ 转人工
  纪律: 无真实会话数据 → 空态；微信消息接入（Sprint-MEDIA-04）后自动填充
-->
<template>
  <MediaWorkspaceShell>
    <div class="mc">
      <div class="mc-head">
        <div>
          <h2 class="mc-title">💬 AI 客服中心</h2>
          <p class="mc-sub">AI 员工接待粉丝消息 · 判断客户价值 · 关键时刻转人工</p>
        </div>
        <span class="mc-badge">接入待启动</span>
      </div>

      <div class="mc-layout">
        <!-- 会话列 -->
        <div class="mc-list">
          <div class="mc-list-head">会话（{{ sessions.length }}）</div>
          <div v-if="sessions.length" class="mc-session" v-for="s in sessions" :key="s.id">
            <span class="mc-s-avatar">{{ s.avatar }}</span>
            <div class="mc-s-body">
              <div class="mc-s-name">{{ s.name }} <span class="mc-s-tag">{{ s.tag }}</span></div>
              <div class="mc-s-last">{{ s.last }}</div>
            </div>
          </div>
          <div v-else class="mc-list-empty">
            <p>暂无会话</p>
            <p class="mc-list-empty-sub">微信消息接入后，AI 客服会话将真实显示在这里</p>
          </div>
        </div>

        <!-- 会话详情（框架） -->
        <div class="mc-detail">
          <div class="mc-detail-empty">
            <div class="mc-detail-ico">💬</div>
            <p>选择会话查看对话</p>
            <p class="mc-detail-sub">AI 判断标签与转人工入口将在会话激活后可用</p>
          </div>
        </div>
      </div>

      <!-- 工作流说明 -->
      <div class="mc-flow">
        <div class="mc-flow-item"><b>1</b> 粉丝消息接入<span>微信消息接收（Sprint-MEDIA-04）</span></div>
        <div class="mc-flow-item"><b>2</b> AI 接待回复<span>BYOK 模型真实生成</span></div>
        <div class="mc-flow-item"><b>3</b> 价值判断<span>高价值/普通互动 分类</span></div>
        <div class="mc-flow-item"><b>4</b> 转人工接管<span>AI 判断 → 真人接管（你特别强调的规则）</span></div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'

// 真实数据源待接入（Sprint-MEDIA-04 微信消息）
const sessions = ref<any[]>([])
</script>

<style scoped>
.mc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
}
.mc-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}
.mc-sub {
  font-size: 12px;
  color: #8a8a9e;
  margin: 4px 0 0;
}
.mc-badge {
  font-size: 11px;
  background: #f0f0f5;
  color: #9a9aad;
  border-radius: 20px;
  padding: 4px 12px;
  font-weight: 600;
}
.mc-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 14px;
  margin-bottom: 20px;
}
.mc-list {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  overflow: hidden;
  min-height: 320px;
}
.mc-list-head {
  font-size: 13px;
  font-weight: 700;
  color: #333;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f1f5;
}
.mc-session {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #f6f6f9;
}
.mc-s-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #eef2ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.mc-s-body { flex: 1; }
.mc-s-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 6px;
}
.mc-s-tag {
  font-size: 10px;
  background: #e8f7ee;
  color: #16a34a;
  border-radius: 8px;
  padding: 1px 6px;
}
.mc-s-last {
  font-size: 11px;
  color: #9a9aad;
  margin-top: 3px;
}
.mc-list-empty {
  text-align: center;
  padding: 60px 16px;
  color: #8a8a9e;
  font-size: 13px;
}
.mc-list-empty-sub {
  font-size: 11px;
  color: #b0b0c0;
  margin-top: 4px;
}
.mc-detail {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mc-detail-empty {
  text-align: center;
  color: #8a8a9e;
  font-size: 13px;
}
.mc-detail-ico {
  font-size: 34px;
  margin-bottom: 8px;
}
.mc-detail-sub {
  font-size: 11px;
  color: #b0b0c0;
  margin-top: 4px;
}
.mc-flow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.mc-flow-item {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 12px;
  color: #444;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mc-flow-item b {
  color: #2563eb;
  font-size: 15px;
}
.mc-flow-item span {
  font-size: 10px;
  color: #9a9aad;
}
@media (max-width: 800px) {
  .mc-layout { grid-template-columns: 1fr; }
  .mc-flow { grid-template-columns: 1fr; }
}
</style>
