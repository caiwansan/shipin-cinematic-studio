<!-- ============================================================
ADMIN-IA-REALITY-05-C — AI 员工运营中心（5 Tab）
替代旧 Agent CRUD 页（旧页引用不存在的 agent_def 表 → 500）
数据源：/api/admin/ai-employees/*（EnterpriseAgentProfile SSOT）
Gate：AI Employee Reality Gate G1-G6，六项全 PASS 才显示「运行中」
============================================================ -->
<template>
  <div class="min-h-screen" style="background:#070B16">
    <!-- Tab 导航 -->
    <div class="flex gap-1 border-b border-white/[0.06] px-6 pt-4">
      <button v-for="t in tabs" :key="t.id" @click="activeTab = t.id"
        class="px-4 py-2.5 text-[12px] transition rounded-t-lg no-underline"
        :class="activeTab === t.id ? 'text-white bg-white/[0.06] border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'">
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <div class="p-6 space-y-5">
      <!-- ================= Tab1: AI员工 ================= -->
      <div v-if="activeTab === 'employees'">
        <div class="grid grid-cols-4 gap-3">
          <div v-for="s in employeeSummaryCards" :key="s.label" class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[10px] text-gray-500">{{ s.label }}</p>
            <p class="text-2xl font-semibold mt-1" :style="{ color: s.color }">{{ s.value }}</p>
          </div>
        </div>
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] mt-4 overflow-hidden">
          <table class="w-full text-[12px]">
            <thead>
              <tr class="text-left text-gray-500 border-b border-white/[0.06]">
                <th class="py-3 px-4 font-normal">员工</th>
                <th class="py-3 px-2 font-normal">岗位</th>
                <th class="py-3 px-2 font-normal">所属业务</th>
                <th class="py-3 px-2 font-normal">企业</th>
                <th class="py-3 px-2 font-normal">状态</th>
                <th class="py-3 px-2 font-normal">六要素</th>
                <th class="py-3 px-2 font-normal">今日任务</th>
                <th class="py-3 px-2 font-normal">今日成本</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in employees" :key="e.id" class="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td class="py-3 px-4">
                  <p class="text-white/85 font-medium">{{ e.name }}</p>
                  <p class="text-[10px] text-gray-600 font-mono">{{ e.id.slice(0, 8) }}</p>
                </td>
                <td class="py-3 px-2 text-gray-300">{{ e.role }}</td>
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px]" :class="typeClass(e.agentType)">{{ e.agentType }}</span>
                </td>
                <td class="py-3 px-2 text-gray-400">{{ e.organization || '—' }}</td>
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px]" :class="e.gate.allPass ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'">
                    {{ e.gate.allPass ? '● 运行中' : '◐ 配置不完整' }}
                  </span>
                </td>
                <td class="py-3 px-2">
                  <span v-if="e.gate.allPass" class="text-green-400 text-[10px]">G1-G6 全 PASS</span>
                  <span v-else class="text-amber-400 text-[10px]" :title="e.gate.missing.join(', ')">{{ e.gate.missing.join(' ') }}</span>
                </td>
                <td class="py-3 px-2 text-white/80">{{ e.today.tasks }}</td>
                <td class="py-3 px-2 text-gray-300">¥{{ e.today.cost.toFixed(3) }}</td>
              </tr>
              <tr v-if="!employees.length"><td colspan="8" class="py-10 text-center text-gray-600 text-[12px]">暂无 AI 员工</td></tr>
            </tbody>
          </table>
        </div>
        <p class="text-[10px] text-gray-600 mt-3">六要素 = Identity / Capability / Runtime / Model Policy / Memory / Usage，任一缺失即「配置不完整」，不假装上线（AI Employee Reality Gate）</p>
      </div>

      <!-- ================= Tab2: 模板中心 ================= -->
      <div v-if="activeTab === 'templates'">
        <div class="flex items-center justify-between mb-4">
          <p class="text-[12px] text-gray-500">平台岗位模板（模板 ≠ 实例：模板 → 企业员工 → 运行实例）</p>
          <button @click="openTemplateModal()" class="px-3 py-1.5 rounded-lg text-[11px] bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/30 transition">+ 新建模板</button>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div v-for="t in templates" :key="t.id" class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-white/85 font-medium text-[13px]">{{ t.name }}</p>
                <p class="text-[10px] text-gray-600 font-mono mt-0.5">{{ t.code }}</p>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px]" :class="t.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">{{ t.status }}</span>
            </div>
            <p class="text-[11px] text-gray-500 mt-2 line-clamp-2">{{ t.description || '—' }}</p>
            <div class="mt-3">
              <p class="text-[10px] text-gray-600 mb-1">可授权业务</p>
              <div class="flex flex-wrap gap-1">
                <span v-for="w in t.workspace" :key="w" class="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px]">{{ w }}</span>
                <span v-if="!t.workspace.length" class="text-gray-700 text-[10px]">未配置</span>
              </div>
            </div>
            <div class="mt-2">
              <p class="text-[10px] text-gray-600 mb-1">默认能力</p>
              <div class="flex flex-wrap gap-1">
                <span v-for="c in t.defaultCapabilities" :key="c" class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px]">{{ c }}</span>
                <span v-if="!t.defaultCapabilities.length" class="text-gray-700 text-[10px]">—</span>
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <button @click="openTemplateModal(t)" class="px-2 py-1 rounded text-[10px] bg-white/[0.05] text-gray-300 hover:bg-white/[0.1] transition">编辑</button>
              <button @click="deleteTemplate(t)" class="px-2 py-1 rounded text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">删除</button>
            </div>
          </div>
        </div>

        <!-- 模板编辑弹窗 -->
        <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showTemplateModal = false">
          <div class="w-[520px] rounded-2xl border border-white/[0.08] bg-[#0d1220] p-6 space-y-3">
            <p class="text-white/85 font-medium">{{ editingTemplate?.id ? '编辑模板' : '新建模板' }}</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] text-gray-500">名称</label>
                <input v-model="templateForm.name" class="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[12px] text-white outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500">编码（= agentType）</label>
                <input v-model="templateForm.code" :disabled="!!editingTemplate?.id" class="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[12px] text-white outline-none disabled:opacity-40" />
              </div>
            </div>
            <div>
              <label class="text-[10px] text-gray-500">描述</label>
              <textarea v-model="templateForm.description" rows="2" class="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[12px] text-white outline-none"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] text-gray-500">可授权业务（逗号分隔）</label>
                <input v-model="templateForm.workspaceText" class="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[12px] text-white outline-none" placeholder="recruitment,short_drama" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500">默认能力（逗号分隔）</label>
                <input v-model="templateForm.capsText" class="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[12px] text-white outline-none" placeholder="JOB_CREATE,CANDIDATE_SEARCH" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button @click="showTemplateModal = false" class="px-3 py-1.5 rounded-lg text-[11px] bg-white/[0.05] text-gray-300">取消</button>
              <button @click="saveTemplate" class="px-3 py-1.5 rounded-lg text-[11px] bg-blue-600/30 border border-blue-600/40 text-blue-300">保存</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= Tab3: 能力中心 ================= -->
      <div v-if="activeTab === 'capabilities'">
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
          <p class="text-[12px] text-gray-500">链路：Agent → Capabilities → Tools → Runtime。能力由平台注册（CapabilityRegistry），套餐通过 CapabilityGrant 授权，禁止 Workspace 自注册。</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[11px] text-gray-400 mb-3">能力授权全景（{{ capabilities.length }}）</p>
            <table class="w-full text-[11px]">
              <thead><tr class="text-left text-gray-600 border-b border-white/[0.06]"><th class="py-2 font-normal">能力</th><th class="py-2 font-normal">授权套餐</th><th class="py-2 font-normal">使用岗位</th></tr></thead>
              <tbody>
                <tr v-for="c in capabilities" :key="c.code" class="border-b border-white/[0.03]">
                  <td class="py-2 text-blue-400 font-mono">{{ c.code }}</td>
                  <td class="py-2 text-white/70">{{ c.grantedPlans }}</td>
                  <td class="py-2 text-gray-500">{{ c.templates.join('、') || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[11px] text-gray-400 mb-3">岗位能力画像</p>
            <div v-for="bt in byTemplate" :key="bt.code" class="mb-3">
              <p class="text-[12px] text-white/75">{{ bt.template }} <span class="text-gray-600 font-mono text-[10px]">{{ bt.code }}</span></p>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-for="c in bt.capabilities" :key="c" class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px]">{{ c }}</span>
                <span v-if="!bt.capabilities.length" class="text-gray-700 text-[10px]">未绑定能力（待配置）</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= Tab4: 运行中心 ================= -->
      <div v-if="activeTab === 'runtime'">
        <div class="flex items-center justify-between mb-4">
          <p class="text-[12px] text-gray-500">老板视角：今天工作了吗？有没有失败？花多少钱？</p>
          <div class="flex gap-1">
            <button v-for="r in ranges" :key="r" @click="loadRuntime(r)" class="px-3 py-1 rounded-lg text-[11px] transition"
              :class="runtimeRange === r ? 'bg-blue-600/30 text-blue-300 border border-blue-600/40' : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'">{{ r }}</button>
          </div>
        </div>
        <div class="grid grid-cols-5 gap-3">
          <div v-for="s in runtimeCards" :key="s.label" class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[10px] text-gray-500">{{ s.label }}</p>
            <p class="text-2xl font-semibold mt-1" :style="{ color: s.color }">{{ s.value }}</p>
          </div>
        </div>
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] mt-4 overflow-hidden">
          <table class="w-full text-[12px]">
            <thead><tr class="text-left text-gray-500 border-b border-white/[0.06]">
              <th class="py-3 px-4 font-normal">AI员工</th><th class="py-3 px-2 font-normal">任务</th><th class="py-3 px-2 font-normal">成功</th>
              <th class="py-3 px-2 font-normal">失败</th><th class="py-3 px-2 font-normal">运行中</th><th class="py-3 px-2 font-normal">Token</th><th class="py-3 px-2 font-normal">成本</th>
            </tr></thead>
            <tbody>
              <tr v-for="e in runtimeByEmployee" :key="e.employeeId" class="border-b border-white/[0.04]">
                <td class="py-3 px-4 text-white/85">{{ e.name }}</td>
                <td class="py-3 px-2 text-white/80">{{ e.tasks }}</td>
                <td class="py-3 px-2 text-green-400">{{ e.success }}</td>
                <td class="py-3 px-2" :class="e.failed ? 'text-red-400' : 'text-gray-600'">{{ e.failed }}</td>
                <td class="py-3 px-2 text-gray-400">{{ e.running }}</td>
                <td class="py-3 px-2 text-gray-300">{{ e.tokens.toLocaleString() }}</td>
                <td class="py-3 px-2 text-gray-300">¥{{ e.cost.toFixed(3) }}</td>
              </tr>
              <tr v-if="!runtimeByEmployee.length"><td colspan="7" class="py-10 text-center text-gray-600 text-[12px]">该时间范围无任务记录</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ================= Tab5: 价值中心 ================= -->
      <div v-if="activeTab === 'value'">
        <div class="flex items-center justify-between mb-4">
          <p class="text-[12px] text-gray-500">价值模型：单任务替代工时 0.5h × 工时单价 ¥50/h（平台定义，可调）</p>
          <div class="flex gap-1">
            <button v-for="r in ['7d','month']" :key="r" @click="loadValue(r)" class="px-3 py-1 rounded-lg text-[11px] transition"
              :class="valueRange === r ? 'bg-blue-600/30 text-blue-300 border border-blue-600/40' : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08]'">{{ r }}</button>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-3">
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[10px] text-gray-500">AI员工成本</p>
            <p class="text-2xl font-semibold mt-1 text-white/85">¥{{ valueTotal.cost.toFixed(2) }}</p>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[10px] text-gray-500">替代工时</p>
            <p class="text-2xl font-semibold mt-1 text-white/85">{{ valueTotal.savedHours }}h</p>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[10px] text-gray-500">估算价值</p>
            <p class="text-2xl font-semibold mt-1 text-blue-400">¥{{ valueTotal.value.toLocaleString() }}</p>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[10px] text-gray-500">ROI</p>
            <p class="text-2xl font-semibold mt-1" :class="valueTotal.roi > 0 ? 'text-green-400' : 'text-gray-600'">{{ valueTotal.roi > 0 ? valueTotal.roi + '×' : '—' }}</p>
          </div>
        </div>
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] mt-4 overflow-hidden">
          <table class="w-full text-[12px]">
            <thead><tr class="text-left text-gray-500 border-b border-white/[0.06]">
              <th class="py-3 px-4 font-normal">AI员工</th><th class="py-3 px-2 font-normal">调用</th><th class="py-3 px-2 font-normal">成本</th>
              <th class="py-3 px-2 font-normal">Token</th><th class="py-3 px-2 font-normal">替代工时</th><th class="py-3 px-2 font-normal">估算价值</th><th class="py-3 px-2 font-normal">ROI</th>
            </tr></thead>
            <tbody>
              <tr v-for="e in valueByEmployee" :key="e.employeeId" class="border-b border-white/[0.04]">
                <td class="py-3 px-4 text-white/85">{{ e.name }}</td>
                <td class="py-3 px-2 text-white/80">{{ e.tasks }}</td>
                <td class="py-3 px-2 text-gray-300">¥{{ e.cost.toFixed(2) }}</td>
                <td class="py-3 px-2 text-gray-300">{{ e.tokens.toLocaleString() }}</td>
                <td class="py-3 px-2 text-gray-300">{{ e.savedHours }}h</td>
                <td class="py-3 px-2 text-blue-400">¥{{ e.estimatedValue.toLocaleString() }}</td>
                <td class="py-3 px-2"><span :class="e.roi > 0 ? 'text-green-400' : 'text-gray-600'">{{ e.roi > 0 ? e.roi + '×' : '—' }}</span></td>
              </tr>
              <tr v-if="!valueByEmployee.length"><td colspan="7" class="py-10 text-center text-gray-600 text-[12px]">该时间范围无任务记录</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })

const tabs = [
  { id: 'employees', label: 'AI员工', icon: '👥' },
  { id: 'templates', label: '模板中心', icon: '📋' },
  { id: 'capabilities', label: '能力中心', icon: '🔌' },
  { id: 'runtime', label: '运行中心', icon: '⚙️' },
  { id: 'value', label: '价值中心', icon: '💰' },
]
const activeTab = ref('employees')

const token = () => {
  if (typeof localStorage !== 'undefined') return localStorage.getItem('auth_token') || ''
  return ''
}
async function api(path: string, opts: any = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw new Error(path + ' → ' + res.status)
  return res.json()
}

// ---------- Tab1 ----------
const overview = ref<any>({ summary: {}, employees: [] })
const employees = computed(() => overview.value.employees || [])
const employeeSummaryCards = computed(() => [
  { label: 'AI员工总数', value: overview.value.summary?.total ?? 0, color: '#fff' },
  { label: '运行中（六要素全 PASS）', value: overview.value.summary?.running ?? 0, color: '#4ade80' },
  { label: '配置不完整', value: overview.value.summary?.incomplete ?? 0, color: '#fbbf24' },
  { label: '草稿', value: overview.value.summary?.draft ?? 0, color: '#9ca3af' },
])
function typeClass(t: string) {
  const map: Record<string, string> = {
    recruiter: 'bg-blue-500/10 text-blue-400', interview: 'bg-purple-500/10 text-purple-400',
    talent_analyst: 'bg-green-500/10 text-green-400', career_advisor: 'bg-cyan-500/10 text-cyan-400',
    talent_agent: 'bg-orange-500/10 text-orange-400', hotspot_analyst: 'bg-pink-500/10 text-pink-400',
  }
  return map[t] || 'bg-gray-500/10 text-gray-400'
}
async function loadOverview() { overview.value = await api('/api/admin/ai-employees/overview') }

// ---------- Tab2 ----------
const templates = ref<any[]>([])
const showTemplateModal = ref(false)
const editingTemplate = ref<any>(null)
const templateForm = ref<any>({})
async function loadTemplates() { templates.value = await api('/api/admin/ai-employees/templates') }
function openTemplateModal(t?: any) {
  editingTemplate.value = t || null
  templateForm.value = t ? {
    name: t.name, code: t.code, description: t.description || '',
    workspaceText: (t.workspace || []).join(','), capsText: (t.defaultCapabilities || []).join(','),
  } : { name: '', code: '', description: '', workspaceText: '', capsText: '' }
  showTemplateModal.value = true
}
async function saveTemplate() {
  const payload = {
    name: templateForm.value.name, code: templateForm.value.code, description: templateForm.value.description,
    workspace: templateForm.value.workspaceText.split(',').map((s: string) => s.trim()).filter(Boolean),
    defaultCapabilities: templateForm.value.capsText.split(',').map((s: string) => s.trim()).filter(Boolean),
  }
  if (editingTemplate.value) await api(`/api/admin/ai-employees/templates/${editingTemplate.value.id}`, { method: 'PUT', body: JSON.stringify(payload) })
  else await api('/api/admin/ai-employees/templates', { method: 'POST', body: JSON.stringify(payload) })
  showTemplateModal.value = false
  await loadTemplates()
}
async function deleteTemplate(t: any) {
  if (!confirm(`删除模板「${t.name}」？`)) return
  await api(`/api/admin/ai-employees/templates/${t.id}`, { method: 'DELETE' })
  await loadTemplates()
}

// ---------- Tab3 ----------
const capabilities = ref<any[]>([])
const byTemplate = ref<any[]>([])
async function loadCapabilities() {
  const d = await api('/api/admin/ai-employees/capabilities')
  capabilities.value = d.capabilities
  byTemplate.value = d.byTemplate
}

// ---------- Tab4 ----------
const ranges = ['today', '7d', 'month']
const runtimeRange = ref('today')
const runtime = ref<any>({ total: {}, byEmployee: [] })
const runtimeByEmployee = computed(() => runtime.value.byEmployee || [])
const runtimeCards = computed(() => {
  const t = runtime.value.total || {}
  return [
    { label: '任务', value: t.tasks ?? 0, color: '#fff' },
    { label: '成功', value: t.success ?? 0, color: '#4ade80' },
    { label: '失败', value: t.failed ?? 0, color: t.failed ? '#f87171' : '#9ca3af' },
    { label: 'Token', value: (t.tokens ?? 0).toLocaleString(), color: '#60a5fa' },
    { label: '成本', value: '¥' + (t.cost ?? 0).toFixed(3), color: '#e879f9' },
  ]
})
async function loadRuntime(r: string) { runtimeRange.value = r; runtime.value = await api(`/api/admin/ai-employees/runtime?range=${r}`) }

// ---------- Tab5 ----------
const valueRange = ref('month')
const value = ref<any>({ total: {}, byEmployee: [] })
const valueByEmployee = computed(() => value.value.byEmployee || [])
const valueTotal = computed(() => value.value.total || {})
async function loadValue(r: string) { valueRange.value = r; value.value = await api(`/api/admin/ai-employees/value?range=${r}`) }

onMounted(async () => {
  try {
    await Promise.all([loadOverview(), loadTemplates(), loadCapabilities(), loadRuntime('today'), loadValue('month')])
  } catch (e: any) {
    console.error('[ai-employees]', e.message)
  }
})
</script>
