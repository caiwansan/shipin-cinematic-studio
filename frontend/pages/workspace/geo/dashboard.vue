<template>
  <GeoWorkspaceLayout>
    <div class="geo-dash-page">
      <!-- ☆ P0-5: Runtime Health Gate — shown when Runtime is not healthy -->
      <div v-if="runtimeStatus === 'uninitialized'" class="geo-dash__welcome">
        <div class="geo-dash__welcome-card">
          <span class="geo-dash__welcome-icon">🌐</span>
          <h2 class="geo-dash__welcome-title">欢迎使用品牌健康工作台</h2>
          <p class="geo-dash__welcome-desc">创建您的第一个品牌，开始 AI 健康评估</p>
          <button class="geo-dash__create-btn" @click="goCreate">创建品牌</button>
        </div>
      </div>

      <div v-else-if="runtimeStatus === 'initializing'" class="geo-dash__welcome">
        <div class="geo-dash__welcome-card">
          <span class="geo-dash__welcome-icon">⏳</span>
          <h2 class="geo-dash__welcome-title">系统正在初始化</h2>
          <p class="geo-dash__welcome-desc">正在为您的品牌生成初始评估，请稍后刷新</p>
          <button class="geo-dash__create-btn" @click="loadData">刷新</button>
        </div>
      </div>

      <!-- Healthy Dashboard -->
      <div v-else-if="hasData">
        <!-- Hero -->
        <div class="geo-dash__hero">
          <div>
            <h1 class="geo-dash__title">{{ entityName || '品牌健康' }}</h1>
            <p class="geo-dash__desc">品牌健康状况概览</p>
          </div>
          <div class="geo-dash__hero-actions">
            <button class="geo-dash__create-btn" @click="goCreate">+ 创建品牌</button>
            <div class="geo-dash__metrics">
              <div class="geo-dash__metric">
                <div class="geo-dash__metric-value">{{ aiVisibility }}</div>
                <div class="geo-dash__metric-label">健康评分</div>
              </div>
              <div class="geo-dash__metric">
                <div class="geo-dash__metric-value">{{ pendingTasks }}</div>
                <div class="geo-dash__metric-label">待处理</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Engine Status → Brand Progress -->
        <div class="geo-dash__card">
          <div class="geo-dash__card-hd">
            <span class="geo-dash__card-title">品牌进展</span>
          </div>
          <div class="geo-dash__card-bd">
            <div v-for="e in engines" :key="e.name" class="geo-dash__row" @click="goEngine(e.name)">
              <span class="geo-dash__row-icon">{{ engineIcons[e.name] || '→' }}</span>
              <span class="geo-dash__row-label">{{ e.label }}</span>
              <span class="geo-dash__row-badge" :class="`badge--${e.status}`">
                {{ statusLabel(e.status) }}
              </span>
              <span class="geo-dash__row-detail">{{ e.detail }}</span>
            </div>
          </div>
        </div>

        <!-- Next Action -->
        <div v-if="nextAction" class="geo-dash__card geo-dash__card--action" @click="goRoute(nextAction.route)">
          <div class="geo-dash__card-hd">
            <span class="geo-dash__card-title">下一步建议</span>
            <span class="geo-dash__card-arrow">→</span>
          </div>
          <div class="geo-dash__card-bd">
            <div class="geo-dash__next">
              <span class="geo-dash__next-title">{{ nextAction.title }}</span>
              <span class="geo-dash__next-desc">{{ nextAction.detail }}</span>
            </div>
          </div>
        </div>

        <!-- Activity Timeline -->
        <div class="geo-dash__card">
          <div class="geo-dash__card-hd">
            <span class="geo-dash__card-title">活动动态</span>
          </div>
          <div class="geo-dash__card-bd">
            <div v-if="activities.length === 0" class="geo-dash__empty">暂无活动</div>
            <div v-else v-for="a in activities" :key="a.id" class="geo-dash__activity">
              <span class="geo-dash__activity-dot">{{ a.level === 'error' ? '🔴' : a.level === 'warning' ? '🟡' : '🟢' }}</span>
              <div class="geo-dash__activity-info">
                <span class="geo-dash__activity-title">{{ a.title }}</span>
                <span class="geo-dash__activity-detail">{{ a.detail }}</span>
              </div>
              <span class="geo-dash__activity-time">{{ prettyTime(a.timestamp) }}</span>
            </div>
          </div>
        </div>

        <!-- Runtime Health status (subtle, for dev awareness) -->
        <div class="geo-dash__health-bar">
          <span class="geo-dash__health-dot" :class="`health--${runtimeStatus}`"></span>
          <span class="geo-dash__health-text">{{ runtimeMessage }}</span>
        </div>
      </div>

      <!-- Loading -->
      <div v-else class="geo-dash__loading">
        <div class="geo-dash__skeleton geo-dash__skeleton--hero"></div>
        <div class="geo-dash__skeleton geo-dash__skeleton--card"></div>
        <div class="geo-dash__skeleton geo-dash__skeleton--card"></div>
      </div>
    </div>
  </GeoWorkspaceLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import GeoWorkspaceLayout from 'workspaces/geo/layouts/GeoWorkspaceLayout.vue'
import { getMissionControl, type MissionControlData } from 'workspaces/geo/services/missionControlService'
import { useGeoProjectStore } from 'workspaces/geo/stores/useGeoProjectStore'

definePageMeta({ title: 'GEO 工作台' })

const router = useRouter()
const projectStore = useGeoProjectStore()

const control = ref<MissionControlData | null>(null)
const loading = ref(true)

const hasData = computed(() => control.value !== null)
const entityName = computed(() => control.value?.entityName || null)
const aiVisibility = computed(() => control.value?.aiVisibility ?? 0)
const engines = computed(() => control.value?.engines || [])
const activities = computed(() => control.value?.recentActivity || [])
const pendingTasks = computed(() => (control.value?.actionableItems || []).length)

// ★ P0-5: Runtime Health
const runtimeStatus = computed(() => control.value?.runtimeHealth?.status || 'uninitialized')
const runtimeMessage = computed(() => control.value?.runtimeHealth?.message || '')

const nextAction = computed(() => {
  const items = control.value?.actionableItems
  if (items && items.length > 0) return items[0]
  // Fallback: first idle engine
  const idle = (control.value?.engines || []).find(e => e.status === 'idle')
  if (idle) return { title: `开始${idle.label}`, detail: idle.detail, route: engineRoutes[idle.name] }
  return null
})

const engineIcons: Record<string, string> = {
  discovery: '🔍', knowledge: '📚', recommendation: '💡',
  mission: '🎯', verification: '✅', publishing: '📤', learning: '🧠',
}

const engineRoutes: Record<string, string> = {
  discovery: '/workspace/geo/discovery',
  knowledge: '/workspace/geo/knowledge',
  recommendation: '/workspace/geo/recommendations',
  mission: '/workspace/geo/mission-center',
  verification: '/workspace/geo/verification',
  publishing: '/workspace/geo/publishing',
  learning: '/workspace/geo/learning',
}

function statusLabel(s: string): string {
  const m: Record<string, string> = { idle: '待机', queued: '排队中', running: '运行中', completed: '已完成', warning: '有警告', failed: '失败', collecting: '收集中' }
  return m[s] || s
}

function goCreate() { router.push('/workspace/geo/create') }
function goEngine(name: string) {
  const r = engineRoutes[name]
  if (r) router.push(r)
}
function goRoute(r?: string) {
  if (r) router.push(r)
}
function prettyTime(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

async function loadData() {
  loading.value = true
  try {
    const data = await getMissionControl()
    control.value = data
    await projectStore.listProjects()
  } catch {
    control.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.geo-dash-page { max-width: 960px; margin: 0 auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }

/* Welcome */
.geo-dash__welcome { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
.geo-dash__welcome-card { text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 48px; max-width: 420px; }
.geo-dash__welcome-icon { font-size: 48px; }
.geo-dash__welcome-title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 16px 0 8px; }
.geo-dash__welcome-desc { font-size: 14px; color: #64748b; margin-bottom: 24px; }
.geo-dash__create-btn { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer; }
.geo-dash__create-btn:hover { background: #2563eb; }

/* Hero */
.geo-dash__hero { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #0f172a, #1e293b); border-radius: 12px; padding: 20px 24px; color: #fff; }
.geo-dash__title { font-size: 24px; font-weight: 700; margin: 0; }
.geo-dash__desc { font-size: 14px; color: #94a3b8; margin: 4px 0 0; }
.geo-dash__hero-actions { display: flex; align-items: center; gap: 20px; }
.geo-dash__metrics { display: flex; gap: 20px; }
.geo-dash__metric { text-align: center; }
.geo-dash__metric-value { font-size: 28px; font-weight: 800; color: #38bdf8; }
.geo-dash__metric-label { font-size: 11px; color: #64748b; margin-top: 2px; }

/* Card */
.geo-dash__card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.geo-dash__card--action { cursor: pointer; border-color: #bfdbfe; }
.geo-dash__card--action:hover { border-color: #3b82f6; }
.geo-dash__card-hd { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #f1f5f9; }
.geo-dash__card-title { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.geo-dash__card-arrow { color: #3b82f6; font-size: 16px; font-weight: 700; }
.geo-dash__card-bd { padding: 6px 0; }

/* Rows (engines) */
.geo-dash__row { display: flex; align-items: center; gap: 10px; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid #fafafa; transition: background 0.12s; }
.geo-dash__row:hover { background: #f8fafc; }
.geo-dash__row:last-child { border-bottom: none; }
.geo-dash__row-icon { width: 24px; text-align: center; font-size: 15px; }
.geo-dash__row-label { font-size: 14px; font-weight: 500; width: 100px; }
.geo-dash__row-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; width: 56px; text-align: center; }
.badge--idle { background: #f1f5f9; color: #64748b; }
.badge--running { background: #dcfce7; color: #16a34a; }
.badge--completed { background: #dbeafe; color: #2563eb; }
.badge--failed { background: #fee2e2; color: #dc2626; }
.badge--warning { background: #ffedd5; color: #ea580c; }
.badge--queued { background: #fef3c7; color: #d97706; }
.badge--collecting { background: #e0e7ff; color: #4f46e5; }
.geo-dash__row-detail { font-size: 12px; color: #94a3b8; flex: 1; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Next Action */
.geo-dash__next { padding: 8px 16px; }
.geo-dash__next-title { font-size: 15px; font-weight: 600; color: #1e40af; }
.geo-dash__next-desc { font-size: 13px; color: #64748b; margin-top: 4px; }

/* Activity */
.geo-dash__activity { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #fafafa; }
.geo-dash__activity:last-child { border-bottom: none; }
.geo-dash__activity-dot { font-size: 10px; width: 16px; text-align: center; }
.geo-dash__activity-info { flex: 1; min-width: 0; }
.geo-dash__activity-title { font-size: 14px; font-weight: 500; }
.geo-dash__activity-detail { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.geo-dash__activity-time { font-size: 11px; color: #cbd5e1; white-space: nowrap; }

/* Empty */
.geo-dash__empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 14px; }

/* Loading skeleton */
.geo-dash__loading { display: flex; flex-direction: column; gap: 16px; }
.geo-dash__skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 10px; }
.geo-dash__skeleton--hero { height: 100px; }
.geo-dash__skeleton--card { height: 200px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ☆ P0-5: Runtime Health Bar */
.geo-dash__health-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
.geo-dash__health-dot { width: 8px; height: 8px; border-radius: 50%; }
.health--healthy { background: #22c55e; }
.health--initializing { background: #f59e0b; animation: pulse 1.5s infinite; }
.health--uninitialized { background: #94a3b8; }
.geo-dash__health-text { font-size: 12px; color: #64748b; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

@media (max-width: 640px) {
  .geo-dash-page { padding: 16px; }
  .geo-dash__hero { flex-direction: column; align-items: flex-start; gap: 12px; }
}
</style>
