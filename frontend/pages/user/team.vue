<template>
  <div class="team-page">
    <div class="page-header">
      <button class="back-btn" @click="router.push('/user/center')">← 会员中心</button>
      <h1>我的团队</h1>
      <p class="page-sub">推广成员 · 团队规模</p>
    </div>

    <div class="page-body">
      <!-- 团队统计 -->
      <div class="team-stats">
        <div class="team-stat-card">
          <div class="team-stat-value">{{ team.directCount || 0 }}</div>
          <div class="team-stat-label">直接成员</div>
        </div>
        <div class="team-stat-card">
          <div class="team-stat-value" style="color:#60a5fa">{{ team.teamTotal || 0 }}</div>
          <div class="team-stat-label">团队总人数</div>
        </div>
        <div class="team-stat-card team-stat-card--wide">
          <div class="team-stat-label" style="margin-bottom:6px">我的邀请码</div>
          <div class="team-invite-code">{{ team.referralCode || '—' }}</div>
        </div>
      </div>

      <!-- 邀请链接 -->
      <div class="invite-card">
        <div class="invite-label">📣 邀请链接（好友注册即入团）</div>
        <div class="invite-link-row">
          <input ref="linkInput" :value="team.referralUrl || ''" class="invite-link-input" readonly @focus="$event.target.select()" />
          <button class="copy-btn" @click="copyLink">复制链接</button>
        </div>
      </div>

      <!-- 成员列表 -->
      <div class="members-section">
        <h2 class="section-title">👥 团队成员（{{ members.length }}）</h2>
        <div v-if="loading" class="empty">加载中...</div>
        <div v-else-if="!members.length" class="empty">暂无团队成员，快去邀请好友吧 🚀</div>
        <div v-else class="members-list">
          <div v-for="m in members" :key="m.id" class="member-row">
            <UserAvatar :src="m.avatarUrl" :name="m.username" size="md" />
            <div class="member-info">
              <div class="member-name">{{ m.username || '用户' }}</div>
              <div class="member-time">加入于 {{ formatDate(m.joinedAt) }}</div>
            </div>
            <span class="member-tier" :class="`member-tier--${m.memberTier || 'free'}`">
              {{ tierLabel(m.memberTier) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import UserAvatar from '~/components/common/UserAvatar.vue'

const router = useRouter()
const token = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }

const team = ref<any>({ directCount: 0, teamTotal: 0, referralCode: '', referralUrl: '' })
const members = ref<any[]>([])
const loading = ref(true)
const linkInput = ref<HTMLInputElement | null>(null)

const tierLabels: Record<string, string> = {
  free: '体验版', trial: '新人卡', basic: '基础版', pro: '本地版',
  enterprise: '年卡', gold: '黄金会员', premium: '黄金会员', vip: '黄金会员',
  Pro: '钻石会员', director: '年卡会员', vip_year: '钻石会员', vip_season: '钻石会员', vip_platinum: '至尊会员',
}
function tierLabel(t: string) { return tierLabels[t] || '体验版' }

function formatDate(t: string) {
  try { return new Date(t).toISOString().slice(0, 10) } catch { return t || '' }
}

async function copyLink() {
  if (!team.value.referralUrl) return
  try {
    await navigator.clipboard.writeText(team.value.referralUrl)
    alert('邀请链接已复制 ✅')
  } catch {
    linkInput.value?.select()
    document.execCommand('copy')
    alert('邀请链接已复制 ✅')
  }
}

onMounted(async () => {
  try {
    const res = await fetch('/api/user/team', { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const data = await res.json()
      team.value = data.data || {}
      members.value = team.value.members || []
    }
  } catch (e) {
    console.warn('[Team] failed', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.team-page {
  min-height: 100vh;
  background: #0B1320;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  padding: 24px;
  box-sizing: border-box;
}
.page-header { max-width: 720px; margin: 0 auto 24px; }
.back-btn {
  background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
  padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; margin-bottom: 16px;
}
.back-btn:hover { color: #fff; border-color: rgba(255,255,255,0.25); }
.page-header h1 { font-size: 1.5rem; font-weight: 700; color: #fff; margin: 0 0 6px; }
.page-sub { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin: 0; }
.page-body { max-width: 720px; margin: 0 auto; }

.team-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.team-stat-card {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 18px;
  text-align: center;
}
.team-stat-card--wide { grid-column: span 1; }
.team-stat-value { font-size: 1.8rem; font-weight: 800; color: #34d399; margin-bottom: 4px; }
.team-stat-label { font-size: 0.75rem; color: rgba(255,255,255,0.45); }
.team-invite-code {
  font-size: 1rem; font-weight: 700; color: #fbbf24;
  letter-spacing: 2px; font-family: monospace;
  word-break: break-all;
}

.invite-card {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 24px;
}
.invite-label { font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.6); margin-bottom: 12px; }
.invite-link-row { display: flex; gap: 10px; }
.invite-link-input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 0.8rem;
  outline: none;
}
.copy-btn {
  background: linear-gradient(135deg, #f97316, #fb923c);
  color: #fff; border: none; border-radius: 8px;
  padding: 0 18px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
}

.section-title { font-size: 0.9rem; font-weight: 600; color: rgba(255,255,255,0.55); margin: 0 0 12px; }
.empty { padding: 40px; text-align: center; color: rgba(255,255,255,0.3); font-size: 0.85rem; }
.members-list {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  overflow: hidden;
}
.member-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.member-row:last-child { border-bottom: none; }
.member-info { flex: 1; min-width: 0; }
.member-name { font-size: 0.88rem; font-weight: 600; color: #e0e0e0; margin-bottom: 3px; }
.member-time { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
.member-tier {
  font-size: 0.7rem; padding: 3px 10px; border-radius: 6px;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
  flex-shrink: 0;
}
.member-tier--vip_platinum, .member-tier--Pro, .member-tier--vip_year { background: rgba(147,51,234,0.15); color: #c084fc; }
.member-tier--premium, .member-tier--gold, .member-tier--vip { background: rgba(251,191,36,0.12); color: #fbbf24; }
.member-tier--basic { background: rgba(59,130,246,0.12); color: #60a5fa; }
.member-tier--enterprise { background: rgba(52,211,153,0.12); color: #34d399; }

@media (max-width: 640px) {
  .team-stats { grid-template-columns: 1fr 1fr; }
  .team-stat-card--wide { grid-column: span 2; }
}
</style>
