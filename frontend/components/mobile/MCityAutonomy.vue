<template>
  <div class="mca">
    <!-- 顶部自治管理 tab -->
    <div class="mca-tabs">
      <button v-for="t in tabs" :key="t.k" class="mca-tab" :class="{ on: tab === t.k }" @click="tab = t.k">{{ t.name }}</button>
    </div>

    <!-- ============ ① 选举管理 ============ -->
    <section v-if="tab === 'elec'">
      <div v-if="!elec" class="mca-empty">当前没有进行中的选举</div>
      <template v-else>
        <div class="mca-card">
          <div class="mca-card-title">{{ elec.type === 'annual' ? '🗳 年度选举' : '🗳 补选' }}
            <span class="mca-status">{{ elStatus(elec.status) }}</span>
          </div>
          <div class="mca-sub">初选门槛 {{ elec.primarySupport || 100 }} 支持 · 参选人 {{ (elec.candidates || []).length }} 人</div>
          <div v-if="elec.winnerUid" class="mca-winner">🏆 当选管理员：{{ nameOf(elec.winnerUid) }}</div>
        </div>

        <!-- 创始人：发起选举 -->
        <div v-if="myRole === 'agent'" class="mca-card">
          <div class="mca-card-sub">创始人发起（通常年度一次）</div>
          <div class="mca-btn-row">
            <button class="mca-btn" @click="createElection('annual')">发起年度选举</button>
            <button class="mca-btn" @click="promptTarget('by')">发起补选</button>
          </div>
          <input v-if="targetInput.type === 'by'" v-model="targetInput.uid" class="mca-input" placeholder="被罢免/离任的管理员 UID" />
          <button v-if="targetInput.type === 'by'" class="mca-btn ok" @click="createElection('by')">确认补选</button>
        </div>

        <!-- 报名 / 支持 / 投票 -->
        <div v-for="cd in (elec.candidates || [])" :key="cd.uid" class="mca-card">
          <div class="mca-cand">
            <div class="mca-cand-name">{{ cd.name || cd.uid }}
              <span class="mca-cstat">{{ cdStatus(cd.status) }}</span>
            </div>
            <div class="mca-cand-meta">
              <span>🤝 支持 {{ cd.supportCount || 0 }}</span>
              <span>🗳 得票 {{ cd.votes || 0 }}</span>
            </div>
          </div>
          <div class="mca-btn-row">
            <button v-if="elec.status === 'primary' && !elec.me?.applied" class="mca-btn" @click="applyCand(cd)">📝 报名参选</button>
            <button v-if="elec.status === 'primary' && !(elec.me?.supported || []).includes(cd.uid)" class="mca-btn" @click="supportCand(cd)">🤝 支持 {{ cd.name || cd.uid }}</button>
            <button v-if="elec.status === 'voting' && !(elec.me?.voted || []).includes(cd.uid)" class="mca-btn ok" @click="voteCand(cd)">🗳 投他</button>
          </div>
        </div>

        <div v-if="elec.me?.applied && elec.status === 'primary'" class="mca-note">✅ 你已报名参选，等待获得初选支持</div>
      </template>
    </section>

    <!-- ============ ② 罢免投票 ============ -->
    <section v-if="tab === 'vote'">
      <div class="mca-card">
        <div class="mca-card-title">🛡 罢免管理员</div>
        <div class="mca-sub">由会员发起，需 2/5 活跃会员支持方可通过。期间该管理员不可踢出发起人。</div>
        <input v-model="rmUid" class="mca-input" placeholder="输入要罢免的管理员 UID" />
        <button class="mca-btn" :disabled="rming" @click="startRemove">{{ rming ? '发起中…' : '📤 发起罢免' }}</button>
      </div>

      <div v-if="!votes.length" class="mca-empty">暂无进行中的罢免投票</div>
      <div v-for="v in votes" :key="v.id" class="mca-card">
        <div class="mca-card-title">罢免 {{ v.subject }}
          <span class="mca-status">{{ v.voted ? '已投' : '可投票' }}</span>
        </div>
        <div class="mca-sub">赞成 {{ v.yes }} / 需 {{ v.need }}（活跃 {{ v.active }}）</div>
        <button v-if="!v.voted" class="mca-btn ok" @click="ballot(v, 'yes')">赞成罢免</button>
        <div v-else class="mca-note">✅ 你已投票</div>
      </div>
    </section>

    <!-- ============ ③ 关闭城市（多签） ============ -->
    <section v-if="tab === 'close'">
      <div v-if="myRole !== 'admin' && myRole !== 'agent'" class="mca-empty">仅管理员可发起关闭城市</div>
      <template v-else>
        <div class="mca-card">
          <div class="mca-card-title">🗄 关闭城市（多签确认）</div>
          <div class="mca-sub">需 {{ closeVote?.need || 3 }} 名管理员私钥签名确认，达阈值后城市永久关闭、功能冻结。</div>
          <button class="mca-btn" @click="proposeClose">发起关闭提案</button>
        </div>
        <div v-if="closeVote" class="mca-card">
          <div class="mca-card-title">关闭进度</div>
          <div class="mca-sub">已签名 {{ (closeVote.signed || []).length }} / 需 {{ closeVote.need }}（管理员共 {{ closeVote.admins }} 人）</div>
          <div class="mca-signed">已签名：{{ (closeVote.signed || []).join('、') || '无' }}</div>
          <button class="mca-btn ok" @click="signClose">🔑 我确认关闭（签名）</button>
        </div>
      </template>
    </section>

    <!-- ============ ④ 邀请码 + 伙伴图谱 ============ -->
    <section v-if="tab === 'invite'">
      <div class="mca-card">
        <div class="mca-card-title">🔑 城市邀请码（终身锁定）</div>
        <button class="mca-btn" @click="genInvite">生成邀请码</button>
        <div v-if="invite" class="mca-invite">
          <div class="mca-invite-code">{{ invite.code }}</div>
          <div class="mca-invite-hash">🔗 {{ invite.hash?.slice(0, 16) }}…</div>
          <button class="mca-btn ok" @click="copyInvite">📋 复制注册链接</button>
        </div>
      </div>

      <div v-if="partners" class="mca-card">
        <div class="mca-card-title">👥 我的伙伴</div>
        <div class="mca-sec">👤 一级伙伴（我邀请的 {{ (partners.level1 || []).length }} 人）</div>
        <div v-for="p in (partners.level1 || [])" :key="p.uid" class="mca-partner">{{ p.nickname || p.uid }} · 🔑 {{ (p.hash || '').slice(0, 12) }}…</div>
        <div class="mca-sec">👥 二级伙伴（{{ (partners.level2 || []).length }} 人）</div>
        <div v-for="p in (partners.level2 || [])" :key="p.uid" class="mca-partner l2">{{ p.nickname || p.uid }}</div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'

const props = defineProps<{ cityId: string; cityName?: string; myRole?: string }>()

const tabs = [
  { k: 'elec', name: '🗳 选举' },
  { k: 'vote', name: '🛡 罢免' },
  { k: 'close', name: '🗄 关闭' },
  { k: 'invite', name: '🔑 邀请' },
]
const tab = ref('elec')

// ── 选举 ──
const elec = ref<any>(null)
const targetInput = reactive({ type: '' as '' | 'by', uid: '' })
async function loadElection() {
  if (!props.cityId) return
  try {
    const r = await mobileAuthFetch('/api/city/election/status?cityId=' + props.cityId)
    const j = await r.json()
    elec.value = j.data || j.election || null
  } catch { elec.value = null }
}
async function createElection(type: string) {
  const body: any = { cityId: props.cityId, type }
  if (type === 'by') {
    if (!targetInput.uid.trim()) { mobileToast('请输入被罢免管理员 UID'); return }
    body.targetAdminUid = targetInput.uid.trim()
  }
  try {
    const r = await mobileAuthFetch('/api/city/election/create', { method: 'POST', body: JSON.stringify(body) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已发起选举'); targetInput.type = ''; targetInput.uid = ''; loadElection() }
    else mobileToast('❌ ' + (j.error || j.message || '发起失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
function promptTarget(type: 'by') { targetInput.type = type; targetInput.uid = '' }
async function applyCand(cd: any) {
  try { const r = await mobileAuthFetch('/api/city/election/apply', { method: 'POST', body: JSON.stringify({ electionId: elec.value?.id }) }); const j = await r.json(); r.ok && j.success ? (mobileToast('✅ 已报名参选'), loadElection()) : mobileToast('❌ ' + (j.error || '报名失败')) } catch { mobileToast('⚠ 网络错误') }
}
async function supportCand(cd: any) {
  try { const r = await mobileAuthFetch('/api/city/election/support', { method: 'POST', body: JSON.stringify({ electionId: elec.value?.id, candidateUid: cd.uid }) }); const j = await r.json(); r.ok && j.success ? (mobileToast('🤝 已支持'), loadElection()) : mobileToast('❌ ' + (j.error || '支持失败')) } catch { mobileToast('⚠ 网络错误') }
}
async function voteCand(cd: any) {
  try { const r = await mobileAuthFetch('/api/city/election/vote', { method: 'POST', body: JSON.stringify({ electionId: elec.value?.id, candidateUid: cd.uid }) }); const j = await r.json(); r.ok && j.success ? (mobileToast('🗳 已投出'), loadElection()) : mobileToast('❌ ' + (j.error || '投票失败')) } catch { mobileToast('⚠ 网络错误') }
}

// ── 罢免 ──
const rmUid = ref('')
const rming = ref(false)
const votes = ref<any[]>([])
async function loadVotes() {
  if (!props.cityId) return
  try {
    const r = await mobileAuthFetch('/api/city/detail-votes?cityId=' + props.cityId)
    const j = await r.json()
    const d = j.data || j
    votes.value = (d.votes || d || []).map((v: any) => ({ ...v, subject: v.subject || v.targetAdminUid }))
  } catch { votes.value = [] }
}
async function startRemove() {
  if (!rmUid.value.trim()) { mobileToast('请输入管理员 UID'); return }
  rming.value = true
  try {
    const r = await mobileAuthFetch('/api/city/vote/remove-admin', { method: 'POST', body: JSON.stringify({ cityId: props.cityId, targetAdminUid: rmUid.value.trim() }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已发起罢免投票'); rmUid.value = ''; loadVotes() }
    else mobileToast('❌ ' + (j.error || j.message || '发起失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { rming.value = false }
}
async function ballot(v: any, option: string) {
  try {
    const r = await mobileAuthFetch('/api/city/vote/' + v.id + '/ballot', { method: 'POST', body: JSON.stringify({ option }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('已投票'); loadVotes() }
    else mobileToast('❌ ' + (j.error || '投票失败'))
  } catch { mobileToast('⚠ 网络错误') }
}

// ── 关闭城市 ──
const closeVote = ref<any>(null)
async function loadClose() {
  if (!props.cityId) return
  try {
    const r = await mobileAuthFetch('/api/city/close/status?cityId=' + props.cityId)
    const j = await r.json()
    closeVote.value = j.data || j.vote || null
  } catch { closeVote.value = null }
}
async function proposeClose() {
  try { const r = await mobileAuthFetch('/api/city/close/propose', { method: 'POST', body: JSON.stringify({ cityId: props.cityId }) }); const j = await r.json(); r.ok && j.success ? (mobileToast('已发起关闭提案'), loadClose()) : mobileToast('❌ ' + (j.error || '发起失败')) } catch { mobileToast('⚠ 网络错误') }
}
async function signClose() {
  try { const r = await mobileAuthFetch('/api/city/close/sign', { method: 'POST', body: JSON.stringify({ voteId: closeVote.value?.id, signature: '' }) }); const j = await r.json(); r.ok && j.success ? (mobileToast('🔑 已签名确认'), loadClose()) : mobileToast('❌ ' + (j.error || '签名失败')) } catch { mobileToast('⚠ 网络错误') }
}

// ── 邀请 + 伙伴 ──
const invite = ref<any>(null)
const partners = ref<any>(null)
async function genInvite() {
  try { const r = await mobileAuthFetch('/api/city/invite', { method: 'POST', body: JSON.stringify({ cityId: props.cityId }) }); const j = await r.json(); if (r.ok && j.success) invite.value = j.data || j; else mobileToast('❌ ' + (j.error || '生成失败')) } catch { mobileToast('⚠ 网络错误') }
}
async function loadPartners() {
  if (!props.cityId) return
  try { const r = await mobileAuthFetch('/api/city/partners?cityId=' + props.cityId); const j = await r.json(); partners.value = j.data || j } catch { partners.value = null }
}
function copyInvite() {
  if (invite.value?.url) { navigator.clipboard?.writeText(invite.value.url); mobileToast('已复制注册链接') }
  else mobileToast('暂无链接')
}

// ── 工具 ──
function nameOf(uid: string) { return uid || '' }
function elStatus(s: string) { return ({ primary: '报名期', voting: '投票期', done: '已结束' } as any)[s] || s }
function cdStatus(s: string) { return ({ applying: '报名中', qualified: '已达标', elected: '当选' } as any)[s] || s }
function refresh() { loadElection(); loadVotes(); loadClose(); loadPartners() }

watch(() => props.cityId, refresh)
onMounted(refresh)
</script>

<style scoped>
.mca { overflow: hidden; }
.mca-tabs { display: flex; background: #fff; border-radius: 10px; padding: 4px; margin-bottom: 12px; gap: 4px; }
.mca-tab { flex: 1; padding: 8px 4px; border: none; background: transparent; border-radius: 8px; font-size: 12px; color: #6b7280; cursor: pointer; }
.mca-tab.on { background: #d97706; color: #fff; font-weight: 700; }
.mca-empty { color: #9ca3af; font-size: 13px; text-align: center; padding: 30px 10px; }
.mca-card { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.mca-card-title { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mca-card-sub { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
.mca-sub { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
.mca-status { font-size: 11px; background: #fef3c7; color: #92400e; border-radius: 6px; padding: 1px 6px; font-weight: 600; }
.mca-winner { margin-top: 8px; background: #fef3c7; color: #92400e; border-radius: 8px; padding: 8px; font-size: 13px; font-weight: 700; }
.mca-btn-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.mca-btn { border: 1px solid #d1d5db; background: #fff; color: #111827; border-radius: 8px; padding: 8px 12px; font-size: 13px; cursor: pointer; flex: 1; min-width: 90px; }
.mca-btn.ok { background: #059669; border-color: #059669; color: #fff; }
.mca-btn:disabled { opacity: .5; }
.mca-input { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px; padding: 9px 10px; font-size: 13px; margin-bottom: 8px; }
.mca-cand { display: flex; justify-content: space-between; align-items: center; }
.mca-cand-name { font-size: 14px; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 6px; }
.mca-cstat { font-size: 11px; color: #059669; font-weight: 600; }
.mca-cand-meta { font-size: 12px; color: #6b7280; display: flex; gap: 10px; margin-top: 4px; }
.mca-note { font-size: 12px; color: #059669; margin-top: 6px; background: #ecfdf5; border-radius: 8px; padding: 8px; }
.mca-signed { font-size: 12px; color: #4b5563; margin: 4px 0 8px; word-break: break-all; }
.mca-invite { margin-top: 10px; background: #fffbeb; border-radius: 10px; padding: 12px; text-align: center; }
.mca-invite-code { font-size: 24px; font-weight: 800; letter-spacing: 4px; color: #92400e; }
.mca-invite-hash { font-size: 12px; color: #6b7280; margin: 4px 0 8px; }
.mca-sec { font-size: 13px; font-weight: 700; color: #374151; margin: 10px 0 6px; }
.mca-partner { font-size: 13px; color: #4b5563; padding: 6px 0; border-bottom: 1px dashed #e5e7eb; }
.mca-partner.l2 { color: #9ca3af; }
</style>
