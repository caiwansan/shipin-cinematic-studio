<!--
  Sprint-MEDIA-UX-02 — AI 员工团队（新媒体部门）
  真实数据源: GET /api/enterprise/media/overview → agents（EnterpriseAgentInstance + Profile）
  角色编排: 总监/策划/生产/客服/分析；无员工时显示模板阵容（标注待注册，非 mock 数据）
-->
<template>
  <MediaWorkspaceShell>
    <div class="tm">
      <div class="tm-head">
        <div>
          <h2 class="tm-title">🧑‍💼 AI 员工团队</h2>
          <p class="tm-sub">新媒体部门 · 真实 Runtime 实例状态（Hermes 绑定）</p>
        </div>
        <div class="tm-summary">
          <span class="tm-pill">{{ agents.length }} 名已部署</span>
          <span class="tm-pill tm-pill-active">{{ activeCount }} 名工作中</span>
        </div>
      </div>

      <div v-if="agents.length" class="tm-grid">
        <div v-for="a in agents" :key="a.instanceId" class="tm-card">
          <div class="tm-card-top">
            <span class="tm-avatar">{{ (a.avatar || a.name[0] || '👤') }}</span>
            <div class="tm-meta">
              <div class="tm-name">{{ a.name }}</div>
              <div class="tm-role">{{ a.role }}</div>
            </div>
            <span class="tm-state" :class="stateClass(a.lifecycleState)">{{ stateText(a.lifecycleState) }}</span>
          </div>
          <div class="tm-stats">
            <div class="tm-stat"><b>{{ a.totalTasks }}</b><span>累计任务</span></div>
            <div class="tm-stat"><b>{{ a.totalErrors }}</b><span>错误</span></div>
            <div class="tm-stat"><b>{{ a.lastActiveAt ? fmtTime(a.lastActiveAt) : '—' }}</b><span>最近活跃</span></div>
          </div>
        </div>
      </div>

      <!-- 无部署: 模板阵容（明确标注待注册） -->
      <div v-else class="tm-roster">
        <div class="tm-roster-note">📌 以下为新媒体部门标准编制。当前无已部署实例，模板注册将在 Sprint-MEDIA-02 启用。</div>
        <div class="tm-grid">
          <div v-for="r in roster" :key="r.role" class="tm-card tm-card-planned">
            <div class="tm-card-top">
              <span class="tm-avatar tm-avatar-planned">{{ r.avatar }}</span>
              <div class="tm-meta">
                <div class="tm-name">{{ r.name }}</div>
                <div class="tm-role">{{ r.role }}</div>
              </div>
              <span class="tm-state s-stopped">⚪ 未部署</span>
            </div>
            <div class="tm-desc">{{ r.desc }}</div>
          </div>
        </div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'

const agents = ref<any[]>([])
const { $toast } = useNuxtApp() as any

const roster = [
  { name: 'Alice', role: '运营总监', avatar: '👩‍💼', desc: '统筹内容策略、排期与发布节奏' },
  { name: 'Bob', role: '内容策划', avatar: '🧑‍💻', desc: '选题挖掘、热点追踪、内容规划' },
  { name: 'Carol', role: '内容生产', avatar: '👩‍🎨', desc: '稿件撰写、图文与视频文案生产' },
  { name: 'David', role: '客服互动', avatar: '🧑‍💼', desc: '粉丝消息回复、高价值客户识别' },
  { name: 'Eve', role: '数据分析', avatar: '👩‍🔬', desc: '阅读/互动数据追踪与周报分析' },
]

const activeCount = computed(() => agents.value.filter((a: any) => a.lifecycleState === 'ACTIVE').length)

onMounted(async () => {
  try {
    const res = await fetch('/api/enterprise/media/overview', {
      headers: { Authorization: `Bearer ${token()}` },
    })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      agents.value = data.data.agents || []
    }
  } catch {
    $toast?.error?.('加载团队失败')
  }
})

function token() {
  if (typeof window !== 'undefined') return localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
  return ''
}
function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
function stateText(s: string) {
  const map: Record<string, string> = { ACTIVE: '🟢 Working', PAUSED: '🟡 Paused', STOPPED: '⚪ Stopped', EMERGENCY_STOP: '🔴 紧急停止', RECOVERING: '🔄 恢复中' }
  return map[s] || s
}
function stateClass(s: string) {
  if (s === 'ACTIVE') return 's-active'
  if (s === 'PAUSED') return 's-paused'
  if (s === 'RECOVERING') return 's-recovering'
  return 's-stopped'
}
</script>

<style scoped>
.tm-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.tm-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}
.tm-sub {
  font-size: 12px;
  color: #8a8a9e;
  margin: 4px 0 0;
}
.tm-summary {
  display: flex;
  gap: 8px;
}
.tm-pill {
  font-size: 12px;
  background: #fff;
  border: 1px solid #ececf1;
  color: #5a5a70;
  border-radius: 20px;
  padding: 5px 12px;
  font-weight: 600;
}
.tm-pill-active {
  background: #e8f7ee;
  border-color: #c9ecd6;
  color: #16a34a;
}
.tm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
}
.tm-card {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 16px;
}
.tm-card-planned {
  border-style: dashed;
  background: #fcfcfd;
}
.tm-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tm-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #eef2ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  font-weight: 700;
}
.tm-avatar-planned {
  background: #f1f1f5;
  color: #9a9aad;
}
.tm-meta { flex: 1; }
.tm-name { font-size: 14px; font-weight: 700; color: #1a1a2e; }
.tm-role { font-size: 12px; color: #8a8a9e; }
.tm-state {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.s-active { background: #e8f7ee; color: #16a34a; }
.s-paused { background: #fdf3e3; color: #d97706; }
.s-recovering { background: #e8f1fd; color: #2563eb; }
.s-stopped { background: #f1f1f4; color: #6b7280; }
.tm-stats {
  display: flex;
  gap: 16px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #f1f1f5;
}
.tm-stat {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: #9a9aad;
}
.tm-stat b {
  font-size: 15px;
  color: #1a1a2e;
}
.tm-desc {
  font-size: 12px;
  color: #9a9aad;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f1f5;
}
.tm-roster-note {
  background: #fff8e8;
  border: 1px solid #ffe2ae;
  color: #b26a00;
  font-size: 12px;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
}
</style>
