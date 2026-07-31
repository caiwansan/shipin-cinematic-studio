<!-- /admin/recruitment/authorization.vue — 企业套餐授权（Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 T02/T05） -->
<!-- 职责：管理员运营入口 — 选择企业 → 选择套餐 → 开通 / 升级 / 暂停 / 恢复 / 续期 -->
<!-- 链路：Admin → EnterpriseSubscription → EnterpriseEntitlement → Agent Provision（已实现，本页为操作台） -->
<template>
  <RecruitmentPageShell>
    <template #title>🔑 企业套餐授权</template>
    <template #subtitle>管理员运营入口 · 开通 / 升级 / 暂停 / 恢复 / 续期</template>
    <template #actions>
      <button class="rec-btn rec-btn-primary" @click="openGrantModal">＋ 开通套餐</button>
      <button class="rec-btn" @click="loadAll">🔄 刷新</button>
    </template>

    <!-- Stats -->
    <template #stats>
      <div class="auth-stats">
        <div class="auth-stat"><span class="auth-stat-val">¥{{ stats.mrr ?? 0 }}</span><span class="auth-stat-lbl">MRR（月经常性收入）</span></div>
        <div class="auth-stat"><span class="auth-stat-val">¥{{ stats.arr ?? 0 }}</span><span class="auth-stat-lbl">ARR（年经常性收入）</span></div>
        <div class="auth-stat"><span class="auth-stat-val text-green">{{ subStats.active || 0 }}</span><span class="auth-stat-lbl">活跃订阅</span></div>
        <div class="auth-stat"><span class="auth-stat-val">{{ subStats.total || 0 }}</span><span class="auth-stat-lbl">总订阅</span></div>
      </div>
    </template>

    <!-- Loading / Error -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-spinner"></div>
      <span>加载授权数据中...</span>
    </div>
    <div v-else-if="error" class="rec-error-banner">
      <span>⚠️ {{ error }}</span>
      <button @click="loadAll" class="rec-btn-link">重试</button>
    </div>

    <template v-else>
      <div v-if="subscriptions.length === 0" class="rec-empty">
        <p>暂无企业订阅</p>
        <p class="rec-empty-hint">点击「开通套餐」为第一个企业授权</p>
      </div>

      <div v-else class="auth-table-wrap">
        <table class="auth-table">
          <thead>
            <tr>
              <th>企业</th>
              <th>套餐</th>
              <th>周期</th>
              <th>金额</th>
              <th>状态</th>
              <th>到期时间</th>
              <th style="width:280px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sub in subscriptions" :key="sub.id">
              <td>
                <div class="auth-org">{{ sub.organization?.name || sub.organizationId }}</div>
                <div class="auth-days" :class="daysLeftClass(sub.expireAt)">{{ daysLeftText(sub.expireAt) }}</div>
              </td>
              <td>
                <span class="auth-plan">{{ sub.snapshotName || '—' }}</span>
                <button v-if="sub.status === 'active' || sub.status === 'paused'" class="auth-link" @click="openChangePlan(sub)">升级/降级</button>
              </td>
              <td class="auth-muted">{{ sub.snapshotCycle === 'yearly' ? '年度' : '月度' }}</td>
              <td>¥{{ ((sub.snapshotPrice || 0) / 100).toFixed(0) }}</td>
              <td><span class="auth-status" :class="statusClass(sub.status)">{{ statusLabel(sub.status) }}</span></td>
              <td class="auth-muted">{{ formatDate(sub.expireAt) }}</td>
              <td class="auth-actions">
                <template v-if="sub.status === 'active'">
                  <button class="auth-btn auth-btn-amber" @click="handlePause(sub)">暂停</button>
                  <button class="auth-btn auth-btn-blue" @click="openRenew(sub)">续期</button>
                  <button class="auth-btn auth-btn-red" @click="handleCancel(sub)">取消</button>
                </template>
                <template v-else-if="sub.status === 'paused'">
                  <button class="auth-btn auth-btn-green" @click="handleResume(sub)">恢复</button>
                  <button class="auth-btn auth-btn-red" @click="handleCancel(sub)">取消</button>
                </template>
                <template v-else>
                  <button class="auth-btn auth-btn-green" @click="openRenew(sub)">重新开通</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 授权链路说明 -->
      <div class="auth-chain">
        <span class="auth-chain-title">授权链路</span>
        <code>Admin → EnterpriseSubscription → EnterpriseEntitlement → Agent Provision</code>
      </div>
    </template>

    <!-- Grant Modal（开通/续期） -->
    <Teleport to="body">
      <div v-if="showGrantModal" class="auth-modal-overlay" @click.self="showGrantModal = false">
        <div class="auth-modal">
          <h3 class="auth-modal-title">{{ grantMode === 'renew' ? '续期 / 重新开通' : '开通套餐' }}</h3>
          <div class="auth-form">
            <div class="auth-field">
              <label class="auth-label">企业</label>
              <select v-model="grantForm.organizationId" class="auth-select">
                <option value="">-- 选择企业 --</option>
                <option v-for="e in enterprises" :key="e.id" :value="e.id">{{ e.name }}（{{ e.plan || '未订阅' }}）</option>
              </select>
            </div>
            <div class="auth-field">
              <label class="auth-label">套餐</label>
              <select v-model="grantForm.planId" class="auth-select">
                <option value="">-- 选择套餐 --</option>
                <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.displayName }}（¥{{ (p.price / 100).toFixed(0) }}/月 · AI员工{{ p.maxEmployees }}）</option>
              </select>
            </div>
            <div class="auth-field">
              <label class="auth-label">计费周期</label>
              <select v-model="grantForm.cycle" class="auth-select">
                <option value="monthly">月度</option>
                <option value="yearly">年度</option>
              </select>
            </div>
            <div class="auth-field">
              <label class="auth-label">有效期（天）</label>
              <input v-model.number="grantForm.periodDays" type="number" min="1" class="auth-input" />
            </div>
          </div>
          <div v-if="grantError" class="auth-error">⚠️ {{ grantError }}</div>
          <div v-if="grantResult" class="auth-result">
            ✅ 授权成功：订阅 {{ grantResult.subscriptionId?.slice(0, 8) }} · 权益 {{ grantResult.entitlement ? '已生成' : '—' }} · AI员工 {{ grantResult.provision?.provisioned || 0 }} 新增 / {{ grantResult.provision?.skipped || 0 }} 已存在
          </div>
          <div class="auth-modal-actions">
            <button class="rec-btn rec-btn-primary" @click="doGrant" :disabled="granting">
              {{ granting ? '授权中...' : (grantMode === 'renew' ? '确认续期' : '确认开通') }}
            </button>
            <button class="rec-btn" @click="showGrantModal = false">取消</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Change Plan Modal -->
    <Teleport to="body">
      <div v-if="showChangePlanModal" class="auth-modal-overlay" @click.self="showChangePlanModal = false">
        <div class="auth-modal">
          <h3 class="auth-modal-title">变更套餐 — {{ changePlanTarget?.organization?.name || changePlanTarget?.organizationId }}</h3>
          <p class="auth-hint">当前：{{ changePlanTarget?.snapshotName || '-' }}（¥{{ ((changePlanTarget?.snapshotPrice || 0) / 100).toFixed(0) }}）</p>
          <div class="auth-field">
            <label class="auth-label">目标套餐</label>
            <select v-model="changePlanId" class="auth-select">
              <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.displayName }}（¥{{ (p.price / 100).toFixed(0) }}/月 · AI员工{{ p.maxEmployees }}）</option>
            </select>
          </div>
          <div class="auth-modal-actions">
            <button class="rec-btn rec-btn-primary" @click="doChangePlan">确认变更</button>
            <button class="rec-btn" @click="showChangePlanModal = false">取消</button>
          </div>
        </div>
      </div>
    </Teleport>
  </RecruitmentPageShell>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getAuthToken } from '~/utils/auth/token'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'
definePageMeta({ layout: 'admin-aigc' })

const loading = ref(true)
const error = ref('')
const subscriptions = ref<any[]>([])
const plans = ref<any[]>([])
const enterprises = ref<any[]>([])
const stats = ref<any>({})
const subStats = ref<any>({})

const showGrantModal = ref(false)
const grantMode = ref<'grant' | 'renew'>('grant')
const granting = ref(false)
const grantError = ref('')
const grantResult = ref<any>(null)
const grantForm = reactive({ organizationId: '', planId: '', cycle: 'monthly', periodDays: 30 })

const showChangePlanModal = ref(false)
const changePlanTarget = ref<any>(null)
const changePlanId = ref('')

function statusLabel(s: string): string {
  return ({ active: '活跃', paused: '已暂停', cancelled: '已取消', expired: '已过期', pending: '待支付' } as Record<string, string>)[s] || s
}
function statusClass(s: string): string {
  return ({ active: 'st-active', paused: 'st-paused', cancelled: 'st-cancelled', expired: 'st-expired' } as Record<string, string>)[s] || 'st-none'
}
function formatDate(d: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-CN')
}
function daysLeftText(expireAt: string): string {
  if (!expireAt) return ''
  const days = Math.ceil((new Date(expireAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今天到期'
  return `${days} 天后到期`
}
function daysLeftClass(expireAt: string): string {
  if (!expireAt) return ''
  const days = Math.ceil((new Date(expireAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'd-expired'
  if (days <= 7) return 'd-urgent'
  return ''
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const token = getAuthToken()
    const headers = { Authorization: `Bearer ${token}` }
    const [subsRes, plansRes, statsRes, entRes] = await Promise.all([
      fetch('/api/admin/recruitment/subscriptions?limit=100', { headers }),
      fetch('/api/admin/recruitment/plans', { headers }),
      fetch('/api/admin/enterprise/subscription-stats', { headers }),
      fetch('/api/admin/enterprises?pageSize=100', { headers }),
    ])
    const subs = await subsRes.json()
    const pl = await plansRes.json()
    const st = await statsRes.json()
    const ent = await entRes.json()
    if (subs.success) subscriptions.value = subs.data || []
    if (pl.success) plans.value = pl.data || []
    if (st.success) stats.value = st.data || {}
    if (ent.code === 0) enterprises.value = ent.data.list || []
    subStats.value = {
      total: subscriptions.value.length,
      active: subscriptions.value.filter((s: any) => s.status === 'active').length,
      paused: subscriptions.value.filter((s: any) => s.status === 'paused').length,
      cancelled: subscriptions.value.filter((s: any) => s.status === 'cancelled').length,
      expired: subscriptions.value.filter((s: any) => s.status === 'expired').length,
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openGrantModal() {
  grantMode.value = 'grant'
  grantResult.value = null
  grantError.value = ''
  Object.assign(grantForm, { organizationId: '', planId: '', cycle: 'monthly', periodDays: 30 })
  showGrantModal.value = true
  if (plans.value.length === 0) loadAll()
}

function openRenew(sub: any) {
  grantMode.value = 'renew'
  grantResult.value = null
  grantError.value = ''
  Object.assign(grantForm, {
    organizationId: sub.organizationId,
    planId: sub.planId || '',
    cycle: sub.snapshotCycle === 'yearly' ? 'yearly' : 'monthly',
    periodDays: 30,
  })
  showGrantModal.value = true
}

async function doGrant() {
  if (!grantForm.organizationId || !grantForm.planId) {
    grantError.value = '请选择企业和套餐'
    return
  }
  granting.value = true
  grantError.value = ''
  grantResult.value = null
  try {
    const res = await fetch('/api/admin/recruitment/authorization/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      body: JSON.stringify(grantForm),
    })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`)
    grantResult.value = json.data
    await loadAll()
  } catch (e: any) {
    grantError.value = e.message || '授权失败'
  } finally {
    granting.value = false
  }
}

function openChangePlan(sub: any) {
  changePlanTarget.value = sub
  changePlanId.value = sub.planId || ''
  showChangePlanModal.value = true
  if (plans.value.length === 0) loadAll()
}

async function doChangePlan() {
  if (!changePlanId.value) return
  try {
    const res = await fetch(`/api/admin/enterprise/subscriptions/${changePlanTarget.value.id}/change-plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ planId: changePlanId.value, reason: '管理员变更套餐' }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.message || '变更失败')
    showChangePlanModal.value = false
    await loadAll()
  } catch (e: any) {
    alert(e.message)
  }
}

async function handlePause(sub: any) {
  if (!confirm(`确定暂停「${sub.organization?.name}」的订阅？`)) return
  await patchStatus(sub.id, 'pause')
}
async function handleResume(sub: any) {
  if (!confirm(`确定恢复「${sub.organization?.name}」的订阅？`)) return
  await patchStatus(sub.id, 'resume')
}
async function handleCancel(sub: any) {
  if (!confirm(`⚠️ 取消「${sub.organization?.name}」的订阅？此操作不可撤销。`)) return
  await patchStatus(sub.id, 'cancel')
}

async function patchStatus(id: string, action: 'pause' | 'resume' | 'cancel') {
  try {
    const res = await fetch(`/api/admin/enterprise/subscriptions/${id}/${action}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
      body: JSON.stringify({ reason: '管理员操作' }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.message || '操作失败')
    await loadAll()
  } catch (e: any) {
    alert(e.message)
  }
}

onMounted(loadAll)
</script>

<style scoped>
.rec-btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: var(--radius-md, 10px); border: 1px solid var(--color-border-primary, #1E293B); background: var(--color-bg-elevated, #111827); color: var(--color-text-secondary, #94A3B8); font-size: 13px; cursor: pointer; transition: all 0.15s; }
.rec-btn:hover { background: var(--color-bg-hover, #1A2240); color: var(--color-text-primary, #F1F5F9); }
.rec-btn-primary { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.4); color: #60a5fa; }
.rec-btn-primary:hover { background: rgba(59,130,246,0.25); }

.rec-loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: var(--color-text-muted, #64748B); font-size: 14px; }
.rec-spinner { width: 20px; height: 20px; border: 2px solid var(--color-border-primary); border-top-color: var(--color-decision); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.rec-error-banner { display: flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md); padding: 12px 16px; color: var(--color-danger); font-size: 13px; }
.rec-btn-link { background: none; border: none; color: inherit; text-decoration: underline; cursor: pointer; margin-left: 8px; font-size: inherit; padding: 0; }
.rec-empty { text-align: center; padding: 64px 24px; color: var(--color-text-muted, #64748B); font-size: 14px; }
.rec-empty-hint { font-size: 12px; color: var(--color-text-disabled, #475569); }

/* Stats */
.auth-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.auth-stat { background: var(--color-bg-elevated, #111827); border: 1px solid var(--color-border-primary, #1E293B); border-radius: var(--radius-lg, 12px); padding: 16px; text-align: center; }
.auth-stat-val { display: block; font-size: 22px; font-weight: 700; color: var(--color-text-primary, #F1F5F9); line-height: 1.2; }
.auth-stat-lbl { display: block; font-size: 11px; color: var(--color-text-muted, #64748B); margin-top: 4px; }
.text-green { color: #10B981 !important; }

/* Table */
.auth-table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
.auth-table { width: 100%; border-collapse: collapse; }
.auth-table th, .auth-table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
.auth-table th { background: rgba(0,0,0,0.2); color: rgba(255,255,255,0.5); font-weight: 600; font-size: 12px; }
.auth-table tr:hover { background: rgba(255,255,255,0.02); }
.auth-org { font-weight: 600; color: rgba(255,255,255,0.9); }
.auth-days { font-size: 11px; margin-top: 2px; }
.auth-days.d-expired { color: #ef4444; }
.auth-days.d-urgent { color: #f59e0b; }
.auth-plan { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; background: rgba(59,130,246,0.1); color: #60a5fa; }
.auth-link { display: block; margin-top: 4px; background: none; border: none; color: #38BDF8; font-size: 11px; cursor: pointer; padding: 0; }
.auth-link:hover { text-decoration: underline; }
.auth-muted { color: rgba(255,255,255,0.45); font-size: 12px; }
.auth-status { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; }
.st-active { background: rgba(34,197,94,0.1); color: #22c55e; }
.st-paused { background: rgba(245,158,11,0.1); color: #f59e0b; }
.st-cancelled { background: rgba(239,68,68,0.1); color: #ef4444; }
.st-expired { background: rgba(148,163,184,0.1); color: #94a3b8; }
.st-none { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }
.auth-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.auth-btn { padding: 4px 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; }
.auth-btn-amber { background: rgba(245,158,11,0.15); color: #f59e0b; }
.auth-btn-green { background: rgba(34,197,94,0.15); color: #22c55e; }
.auth-btn-red { background: rgba(239,68,68,0.15); color: #ef4444; }
.auth-btn-blue { background: rgba(59,130,246,0.15); color: #60a5fa; }

.auth-chain { display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--color-text-muted, #64748B); margin-top: 16px; padding: 10px 14px; background: rgba(56,189,248,0.05); border: 1px solid rgba(56,189,248,0.12); border-radius: 8px; }
.auth-chain-title { font-weight: 600; color: #38BDF8; flex-shrink: 0; }
.auth-chain code { font-family: monospace; font-size: 11px; color: #7DD3FC; }

/* Modal */
.auth-modal-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); }
.auth-modal { background: var(--color-bg-secondary, #0D1328); border: 1px solid var(--color-border-primary, #1E293B); border-radius: 16px; width: 100%; max-width: 520px; padding: 24px; margin: 16px; }
.auth-modal-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary, #F1F5F9); margin: 0 0 20px; }
.auth-form { display: flex; flex-direction: column; gap: 14px; }
.auth-field { display: flex; flex-direction: column; gap: 6px; }
.auth-label { font-size: 12px; color: var(--color-text-muted, #64748B); }
.auth-select, .auth-input { padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #e0e0e0; font-size: 13px; outline: none; }
.auth-hint { font-size: 12px; color: rgba(255,255,255,0.5); margin: 0 0 14px; }
.auth-error { margin-top: 12px; font-size: 12px; color: #ef4444; }
.auth-result { margin-top: 12px; font-size: 12px; color: #22c55e; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); padding: 10px; border-radius: 8px; line-height: 1.6; }
.auth-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
