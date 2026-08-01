<!--
  MediaAgentRoster — 新媒体 AI 员工阵容

  Sprint-MEDIA-UX-01:
  - 数据源: GET /api/enterprise/agent-profiles?types=media_director,...
  - 真实 AgentInstance 数据；无数据显示锁定阵容卡（明确标注「待注册/待部署」，非假数据）
  - 状态来源: 真实 profile/instance 状态（draft/deploying/running/paused），禁止前端写死
-->
<template>
  <div class="mar">
    <template v-if="loading">
      <div class="mar-grid">
        <div v-for="i in 5" :key="i" class="mar-card mar-card--skeleton">
          <div class="mar-skel mar-skel--avatar"></div>
          <div class="mar-skel mar-skel--line"></div>
          <div class="mar-skel mar-skel--line short"></div>
        </div>
      </div>
    </template>

    <template v-else-if="agents.length > 0">
      <div class="mar-grid">
        <div v-for="a in agents" :key="a.id" class="mar-card" :class="'mar-status-' + (a.status || 'draft')">
          <div class="mar-avatar">{{ (a.name || '?').charAt(0) }}</div>
          <div class="mar-name">{{ a.name }}</div>
          <div class="mar-role">{{ roleLabel(a.agentType) }}</div>
          <div class="mar-status">
            <span class="mar-dot"></span>{{ statusLabel(a.status) }}
          </div>
        </div>
      </div>
      <p class="mar-tip">✓ 来自真实 AgentInstance 数据（/api/enterprise/agent-profiles）</p>
    </template>

    <template v-else>
      <div class="mar-grid">
        <div v-for="slot in DESIGN_ROSTER" :key="slot.code" class="mar-card mar-card--locked">
          <div class="mar-avatar mar-avatar--locked">{{ slot.icon }}</div>
          <div class="mar-name">{{ slot.name }}</div>
          <div class="mar-role">{{ slot.role }}</div>
          <div class="mar-status mar-status--locked">
            🔒 模板待注册（Sprint-MEDIA-02）
          </div>
        </div>
      </div>
      <p class="mar-tip">
        当前企业无新媒体 AI 员工（真实查询为空）。以上为产品设计阵容，模板注册与部署在 Sprint-MEDIA-02 进行，不产生假员工数据。
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  agents: any[]
  loading?: boolean
}>()

const MEDIA_TYPES = ['media_director', 'media_planner', 'media_producer', 'media_cs', 'media_analyst']

const DESIGN_ROSTER = [
  { code: 'media_director', name: 'Media Director', role: '内容总监 · 选题与策略', icon: '🎬' },
  { code: 'media_planner', name: 'Media Planner', role: '运营策划 · 发布计划', icon: '📅' },
  { code: 'media_producer', name: 'Media Producer', role: '内容制作 · 图文视频', icon: '✍️' },
  { code: 'media_cs', name: 'Media CS', role: '粉丝互动 · 私信服务', icon: '💬' },
  { code: 'media_analyst', name: 'Media Analyst', role: '数据复盘 · 运营日报', icon: '📊' },
]

function roleLabel(agentType: string) {
  const found = DESIGN_ROSTER.find((d) => d.code === agentType)
  return found ? found.role : agentType || '新媒体员工'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: '草稿', deploying: '部署中', running: '运行中', paused: '已暂停',
  }
  return map[status] || status || '草稿'
}
</script>

<style scoped>
.mar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.mar-card {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 18px 14px;
  text-align: center;
  transition: box-shadow 0.15s;
}
.mar-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}
.mar-card--locked {
  background: #fafafc;
  border-style: dashed;
}
.mar-avatar {
  width: 44px;
  height: 44px;
  margin: 0 auto 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mar-avatar--locked {
  background: #eef0f4;
  color: #9aa0ae;
}
.mar-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}
.mar-role {
  font-size: 12px;
  color: #8a8a9e;
  margin-top: 4px;
}
.mar-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  background: #f0f0f5;
  color: #5a5a70;
}
.mar-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9aa0ae;
}
.mar-status-running .mar-dot { background: #16a34a; }
.mar-status-running { background: #ecfdf3; color: #15803d; }
.mar-status-paused .mar-dot { background: #d97706; }
.mar-status-paused { background: #fffbeb; color: #b45309; }
.mar-status-deploying .mar-dot { background: #2563eb; }
.mar-status-deploying { background: #eff6ff; color: #1d4ed8; }
.mar-status--locked {
  background: #f0f0f5;
  color: #9aa0ae;
}
.mar-card--skeleton {
  min-height: 140px;
}
.mar-skel {
  background: #f0f1f4;
  border-radius: 8px;
  margin: 0 auto;
}
.mar-skel--avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  margin-bottom: 10px;
}
.mar-skel--line {
  width: 80%;
  height: 12px;
}
.mar-skel--line.short {
  width: 55%;
  margin-top: 8px;
}
.mar-tip {
  font-size: 12px;
  color: #9a9aad;
  margin: 12px 0 0;
}
</style>
