<!-- SPRINT-AGENT-OPERATIONS-01 T01: 企业价值参数配置（ROI 前置） -->
<!-- 原则：价值参数由企业输入（HR 小时成本 / 人工耗时 / AI 耗时），平台禁止估算 -->
<template>
  <div class="vp-page">
    <!-- 顶部原则说明 -->
    <div class="vp-banner">
      <div class="vp-banner-title">📐 AI 员工价值参数</div>
      <div class="vp-banner-desc">
        价值 = 企业自定参数 × 真实执行结果。平台不估算、不猜测 —— 参数由你定义，ROI 才真实可信。
      </div>
    </div>

    <!-- 摘要 -->
    <div v-if="summary" class="vp-summary">
      <div class="vp-sum-card">
        <div class="vp-sum-label">AI 员工</div>
        <div class="vp-sum-value">{{ summary.agentCount }}</div>
      </div>
      <div class="vp-sum-card">
        <div class="vp-sum-label">已配置价值参数</div>
        <div class="vp-sum-value">{{ summary.configuredCount }}</div>
      </div>
      <div class="vp-sum-card">
        <div class="vp-sum-label">30 天节省价值（¥）</div>
        <div class="vp-sum-value accent">{{ summary.totalSavedValue }}</div>
      </div>
      <div class="vp-sum-card">
        <div class="vp-sum-label">30 天 AI 成本（¥）</div>
        <div class="vp-sum-value warn">{{ summary.totalAiCost }}</div>
      </div>
    </div>
    <p v-if="summary?.roiNote" class="vp-roi-note">⚠️ {{ summary.roiNote }}</p>

    <div v-if="loading" class="vp-empty">加载中…</div>
    <div v-else-if="agents.length === 0" class="vp-empty">
      暂无 AI 员工。请先在「AI 招聘团队」完成部署。
    </div>

    <!-- 员工卡片 -->
    <div v-for="a in agents" :key="a.agentInstanceId" class="vp-agent">
      <div class="vp-agent-head">
        <div>
          <span class="vp-agent-name">{{ a.agentName || '未命名员工' }}</span>
          <span class="vp-agent-role">{{ a.role || 'AI 员工' }}</span>
        </div>
        <span class="vp-agent-badge" :class="a.param ? 'ok' : 'none'">
          {{ a.param ? '已配置价值参数' : '未配置 · ROI 不可用' }}
        </span>
      </div>

      <!-- 30 天真实执行统计 -->
      <div class="vp-stats">
        <div class="vp-stat"><span class="lbl">30天执行</span><span class="val">{{ a.tasks }}</span></div>
        <div class="vp-stat"><span class="lbl">成功</span><span class="val good">{{ a.succeeded }}</span></div>
        <div class="vp-stat"><span class="lbl">失败</span><span class="val bad">{{ a.failed }}</span></div>
        <div class="vp-stat"><span class="lbl">成功率</span><span class="val">{{ a.successRate ?? '—' }}%</span></div>
        <div class="vp-stat"><span class="lbl">平均响应</span><span class="val">{{ a.avgDurationMs != null ? (a.avgDurationMs / 1000).toFixed(1) + 's' : '—' }}</span></div>
        <div class="vp-stat"><span class="lbl">真实成本</span><span class="val">¥{{ a.cost }}</span></div>
        <div class="vp-stat"><span class="lbl">业务结果</span><span class="val accent">{{ a.outcomes }}</span></div>
      </div>

      <!-- 价值参数表单 -->
      <div class="vp-form">
        <div class="vp-field">
          <label>HR / 员工平均小时成本（¥/小时）</label>
          <input v-model="formMap[a.agentInstanceId].laborHourlyCost" type="number" min="0" step="1" placeholder="例如 80" />
        </div>
        <div class="vp-field">
          <label>人工完成单次任务耗时（分钟）</label>
          <input v-model="formMap[a.agentInstanceId].manualMinutesPerTask" type="number" min="0" step="0.5" placeholder="例如 10" />
        </div>
        <div class="vp-field">
          <label>AI 完成单次任务耗时（秒）</label>
          <input v-model="formMap[a.agentInstanceId].aiSecondsPerTask" type="number" min="0" step="1" placeholder="例如 30" />
        </div>
        <div class="vp-actions">
          <button class="vp-btn primary" :disabled="saving" @click="save(a)">{{ saving === a.agentInstanceId ? '保存中…' : '保存参数' }}</button>
          <button v-if="a.param" class="vp-btn danger" :disabled="saving" @click="remove(a)">清除（恢复未配置）</button>
        </div>
      </div>

      <!-- 价值预览（配置后） -->
      <div v-if="a.value" class="vp-value">
        <div class="vp-value-item"><span>节省时间</span><b>{{ a.value.savedMinutes }} 分钟</b></div>
        <div class="vp-value-item"><span>节省价值</span><b class="accent">¥{{ a.value.savedValue }}</b></div>
        <div class="vp-value-item"><span>AI 成本</span><b class="warn">¥{{ a.value.aiCost }}</b></div>
        <div class="vp-value-item"><span>ROI</span><b class="roi">{{ a.value.roi != null ? a.value.roi + '×' : '—' }}</b></div>
      </div>
      <div v-else class="vp-value-placeholder">
        保存价值参数后，按 30 天真实执行结果实时计算：节省时间 = 成功任务 × (人工耗时 − AI 耗时)，节省价值 = 节省时间 × 小时成本。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise-workspace' })
import { ref, reactive, onMounted } from 'vue'

const API = 'https://aigc.fushtn.com/api/enterprise/value-params'
const loading = ref(true)
const saving = ref<string | null>(null)
const agents = ref<any[]>([])
const summary = ref<any>(null)
const formMap = reactive<Record<string, any>>({})

function token() { return localStorage.getItem('auth_token') || '' }

async function load() {
  loading.value = true
  try {
    const res = await fetch(API, { headers: { Authorization: `Bearer ${token()}` } })
    const j = await res.json()
    const data = j?.data || j
    agents.value = data.agents || []
    summary.value = data.summary || null
    for (const a of agents.value) {
      formMap[a.agentInstanceId] = {
        laborHourlyCost: a.param?.laborHourlyCost ?? '',
        manualMinutesPerTask: a.param?.manualMinutesPerTask ?? '',
        aiSecondsPerTask: a.param?.aiSecondsPerTask ?? '',
      }
    }
  } catch (e: any) {
    console.error('load value params failed', e)
  } finally {
    loading.value = false
  }
}

async function save(a: any) {
  saving.value = a.agentInstanceId
  try {
    const res = await fetch(`${API}/${a.agentInstanceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({
        laborHourlyCost: Number(formMap[a.agentInstanceId].laborHourlyCost),
        manualMinutesPerTask: Number(formMap[a.agentInstanceId].manualMinutesPerTask),
        aiSecondsPerTask: Number(formMap[a.agentInstanceId].aiSecondsPerTask),
      }),
    })
    const j = await res.json()
    if (!res.ok || j?.code !== 0) throw new Error(j?.message || '保存失败')
    await load()
  } catch (e: any) {
    alert(e.message)
  } finally {
    saving.value = null
  }
}

async function remove(a: any) {
  if (!confirm(`清除 ${a.agentName || '该员工'} 的价值参数？ROI 将回到「未配置」状态。`)) return
  saving.value = a.agentInstanceId
  try {
    await fetch(`${API}/${a.agentInstanceId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    await load()
  } finally {
    saving.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.vp-page { padding: var(--space-lg); min-height: 100%; background: var(--color-bg-primary, #070B16); display: flex; flex-direction: column; gap: 14px; color: #E2E8F0; }
.vp-banner { border: 1px solid rgba(56,189,248,0.25); background: rgba(56,189,248,0.06); border-radius: 10px; padding: 12px 16px; }
.vp-banner-title { font-size: 14px; font-weight: 700; color: #7DD3FC; }
.vp-banner-desc { font-size: 12px; color: #94A3B8; margin-top: 4px; }
.vp-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.vp-sum-card { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); border-radius: 10px; padding: 10px 14px; }
.vp-sum-label { font-size: 11px; color: #94A3B8; }
.vp-sum-value { font-size: 20px; font-weight: 700; font-family: monospace; margin-top: 2px; }
.vp-sum-value.accent { color: #34D399; } .vp-sum-value.warn { color: #FBBF24; }
.vp-roi-note { font-size: 11px; color: #FBBF24; }
.vp-empty { text-align: center; color: #64748B; padding: 40px 0; font-size: 13px; }
.vp-agent { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); border-radius: 12px; padding: 14px; }
.vp-agent-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.vp-agent-name { font-size: 15px; font-weight: 700; color: #F1F5F9; }
.vp-agent-role { font-size: 11px; color: #94A3B8; margin-left: 8px; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 20px; }
.vp-agent-badge { font-size: 10px; padding: 3px 10px; border-radius: 20px; }
.vp-agent-badge.ok { background: rgba(52,211,153,0.12); color: #34D399; }
.vp-agent-badge.none { background: rgba(148,163,184,0.12); color: #94A3B8; }
.vp-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; margin-bottom: 12px; }
.vp-stat { border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2); border-radius: 8px; padding: 6px 10px; }
.vp-stat .lbl { font-size: 10px; color: #64748B; display: block; }
.vp-stat .val { font-size: 14px; font-weight: 700; font-family: monospace; }
.vp-stat .val.good { color: #34D399; } .vp-stat .val.bad { color: #F87171; } .vp-stat .val.accent { color: #7DD3FC; }
.vp-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; align-items: end; }
.vp-field label { display: block; font-size: 10px; color: #94A3B8; margin-bottom: 4px; }
.vp-field input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #E2E8F0; padding: 8px 10px; font-size: 13px; font-family: monospace; }
.vp-field input:focus { outline: none; border-color: #38BDF8; }
.vp-actions { display: flex; gap: 8px; }
.vp-btn { border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; }
.vp-btn.primary { background: #0284C7; color: #fff; }
.vp-btn.primary:hover { background: #0369A1; }
.vp-btn.danger { background: rgba(248,113,113,0.12); color: #F87171; border: 1px solid rgba(248,113,113,0.3); }
.vp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.vp-value { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1); }
.vp-value-item { border: 1px solid rgba(52,211,153,0.2); background: rgba(52,211,153,0.05); border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; }
.vp-value-item span { font-size: 10px; color: #94A3B8; }
.vp-value-item b { font-size: 13px; font-family: monospace; color: #E2E8F0; }
.vp-value-item b.accent { color: #34D399; } .vp-value-item b.warn { color: #FBBF24; } .vp-value-item b.roi { color: #7DD3FC; }
.vp-value-placeholder { margin-top: 12px; font-size: 11px; color: #64748B; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; }
</style>
