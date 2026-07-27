<!-- Admin: 候选人 Review 详情页 -->
<!-- 位置：/admin/recruitment/candidates/[id].vue -->
<!-- 职责：候选人完整画像 — 基础信息 + 职业画像 + 技能证据 + 匹配岗位 + 推荐依据（P5-ADMIN-03） -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button @click="navigateTo('/admin/recruitment/candidates')" class="text-gray-500 hover:text-white text-sm cursor-pointer bg-transparent border-none">← 返回</button>
        <div>
          <h1 class="text-lg font-semibold text-white/90">候选人 Review</h1>
          <p class="text-xs text-gray-500 mt-0.5">完整画像 · 只读视图</p>
        </div>
      </div>
      <button @click="loadData(true)" class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">🔄 刷新</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载画像数据...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      ⚠️ {{ error }} <button @click="loadData(true)" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <!-- Content -->
    <template v-else-if="data">
      <!-- 1. 候选人基础信息 -->
      <section class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white/80 mb-4">👤 基础信息</h2>
        <div class="flex items-start gap-5">
          <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {{ data.candidate?.name?.charAt(0) || '?' }}
          </div>
          <div class="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div><span class="text-gray-500">姓名</span><div class="text-white/80 font-medium mt-0.5">{{ data.candidate?.name || '—' }}</div></div>
            <div><span class="text-gray-500">城市</span><div class="text-white/80 mt-0.5">{{ data.candidate?.city || '—' }}</div></div>
            <div><span class="text-gray-500">经验</span><div class="text-white/80 mt-0.5">{{ data.candidate?.experienceYears != null ? data.candidate.experienceYears + ' 年' : '—' }}</div></div>
            <div><span class="text-gray-500">学历</span><div class="text-white/80 mt-0.5">{{ data.candidate?.education || '—' }}</div></div>
            <div><span class="text-gray-500">职业目标</span><div class="text-white/80 mt-0.5">{{ data.candidate?.careerGoal || '—' }}</div></div>
            <div><span class="text-gray-500">档案完整度</span><div class="mt-0.5">
              <span class="font-medium" :class="(data.candidate?.completeness || 0) >= 80 ? 'text-green-400' : (data.candidate?.completeness || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'">{{ data.candidate?.completeness || 0 }}%</span>
            </div></div>
            <div><span class="text-gray-500">邮箱</span><div class="text-white/80 mt-0.5">{{ data.candidate?.email || '—' }}</div></div>
            <div><span class="text-gray-500">电话</span><div class="text-white/80 mt-0.5">{{ data.candidate?.phone || '—' }}</div></div>
          </div>
        </div>
        <!-- 技能标签 -->
        <div v-if="data.candidate?.skills?.length" class="mt-4 pt-3 border-t border-[#1A2240]">
          <span class="text-gray-500 text-xs">技能标签</span>
          <div class="flex flex-wrap gap-1.5 mt-1.5">
            <span v-for="s in data.candidate.skills" :key="s" class="px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-400 text-[10px]">{{ s }}</span>
          </div>
        </div>
      </section>

      <!-- 2. 职业画像（CareerProfile） -->
      <section v-if="data.careerProfile" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white/80 mb-4">📋 职业画像</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span class="text-gray-500">全名</span><div class="text-white/80 font-medium mt-0.5">{{ data.careerProfile.fullName || '—' }}</div></div>
          <div><span class="text-gray-500">头衔</span><div class="text-white/80 mt-0.5">{{ data.careerProfile.headline || '—' }}</div></div>
          <div><span class="text-gray-500">行业</span><div class="text-white/80 mt-0.5">{{ data.careerProfile.industry || '—' }}</div></div>
          <div><span class="text-gray-500">职级</span><div class="text-white/80 mt-0.5">{{ data.careerProfile.currentLevel || '—' }}</div></div>
          <div><span class="text-gray-500">职业方向</span><div class="text-white/80 mt-0.5">{{ data.careerProfile.careerDirection || '—' }}</div></div>
          <div><span class="text-gray-500">求职状态</span><div class="mt-0.5">
            <span class="px-2 py-0.5 rounded-full text-[10px]" :class="seekClass(data.careerProfile.jobSeekingStatus)">{{ data.careerProfile.jobSeekingStatus }}</span>
          </div></div>
          <div><span class="text-gray-500">开放机会</span><div class="mt-0.5">
            <span v-if="data.careerProfile.openToOpportunity" class="text-green-400">✅ 是</span>
            <span v-else class="text-gray-500">❌ 否</span>
          </div></div>
          <div><span class="text-gray-500">可见性</span><div class="text-white/80 mt-0.5">{{ data.careerProfile.visibility }}</div></div>
        </div>
        <div v-if="data.careerProfile.bio" class="mt-3 pt-3 border-t border-[#1A2240]">
          <span class="text-gray-500 text-xs">个人简介</span>
          <div class="text-white/70 text-xs mt-1 leading-relaxed bg-black/20 rounded-lg p-3">{{ data.careerProfile.bio }}</div>
        </div>
      </section>

      <!-- 3. 技能证据（CandidateSkill + Skill） -->
      <section v-if="data.skillEvidence?.length" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white/80 mb-4">🎯 技能评估 ({{ data.skillEvidence.length }})</h2>
        <div class="space-y-2">
          <div v-for="se in data.skillEvidence" :key="se.id" class="flex items-center justify-between bg-black/20 rounded-lg px-4 py-2.5">
            <div class="flex items-center gap-3">
              <span class="text-white/80 text-xs font-medium">{{ se.skill?.name || '—' }}</span>
              <span v-if="se.skill?.category" class="px-1.5 py-0.5 rounded bg-purple-600/10 text-purple-400 text-[10px]">{{ se.skill.category }}</span>
            </div>
            <div class="flex items-center gap-4 text-xs">
              <div>
                <span class="text-gray-500">等级 </span>
                <span class="font-medium" :class="levelClass(se.level)">{{ se.level }}</span>
              </div>
              <div>
                <span class="text-gray-500">置信度 </span>
                <span class="text-white/70">{{ (se.confidence * 100).toFixed(0) }}%</span>
              </div>
              <div>
                <span class="text-gray-500">来源 </span>
                <span class="text-white/70">{{ se.source }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. 工作经历 -->
      <section v-if="data.workExperiences?.length" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white/80 mb-4">💼 工作经历 ({{ data.workExperiences.length }})</h2>
        <div class="space-y-3">
          <div v-for="we in data.workExperiences" :key="we.id" class="bg-black/20 rounded-lg p-4">
            <div class="flex items-center justify-between mb-1">
              <div class="text-white/80 text-xs font-medium">{{ we.title }} @ {{ we.company }}</div>
              <div class="text-gray-500 text-[10px]">{{ formatDateRange(we.startDate, we.endDate, we.isCurrent) }}</div>
            </div>
            <div v-if="we.location" class="text-gray-500 text-[10px] mb-1">📍 {{ we.location }}</div>
            <div v-if="we.description" class="text-white/60 text-[11px] leading-relaxed mt-1">{{ we.description }}</div>
            <div v-if="we.skillsUsed?.length" class="flex flex-wrap gap-1 mt-2">
              <span v-for="s in we.skillsUsed" :key="s" class="px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-400 text-[10px]">{{ s }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. 教育背景 -->
      <section v-if="data.educations?.length" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white/80 mb-4">🎓 教育背景 ({{ data.educations.length }})</h2>
        <div class="space-y-2">
          <div v-for="edu in data.educations" :key="edu.id" class="bg-black/20 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div class="text-white/80 text-xs font-medium">{{ edu.school }}</div>
              <div class="text-gray-500 text-[10px]">{{ edu.degree }} {{ edu.major ? '· ' + edu.major : '' }}</div>
            </div>
            <div class="text-gray-500 text-[10px]">{{ formatDateRange(edu.startDate, edu.endDate, false) }}</div>
          </div>
        </div>
      </section>

      <!-- 6. 匹配岗位 + 推荐依据 -->
      <section class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white/80 mb-4">🔗 匹配岗位 ({{ data.matches?.total || 0 }})</h2>
        <div v-if="!data.matches?.items?.length" class="text-gray-600 text-xs py-4 text-center">暂无匹配记录</div>
        <div v-else class="space-y-3">
          <div v-for="m in data.matches.items" :key="m.id" class="bg-black/20 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="text-white/80 text-xs font-medium">{{ m.job?.title || '—' }}</div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold" :class="m.matchScore >= 70 ? 'text-green-400' : m.matchScore >= 50 ? 'text-yellow-400' : 'text-red-400'">{{ m.matchScore }}分</span>
                <span class="px-1.5 py-0.5 rounded text-[10px]" :class="matchStatusClass(m.status)">{{ m.status }}</span>
              </div>
            </div>
            <!-- 匹配细分 -->
            <div v-if="m.matchBreakdown" class="flex flex-wrap gap-2 mb-2">
              <span v-for="(val, key) in m.matchBreakdown" :key="key" class="px-2 py-0.5 rounded bg-white/5 text-[10px]">
                <span class="text-gray-500">{{ matchDimLabel(key) }} </span>
                <span class="text-white/70 font-medium">{{ val }}</span>
              </span>
            </div>
            <!-- AI 推荐理由 -->
            <div v-if="m.aiAnalysis" class="text-[11px] text-blue-300/70 bg-blue-900/10 rounded px-3 py-1.5 mt-1">
              💡 {{ m.aiAnalysis }}
            </div>
            <div class="text-gray-500 text-[10px] mt-1">匹配时间：{{ formatTime(m.createdAt) }}</div>
          </div>
        </div>
      </section>

      <!-- 7. Talent Profile（如有） -->
      <section v-if="data.talentProfile" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <h2 class="text-sm font-semibold text-white/80 mb-4">📊 Talent Profile</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span class="text-gray-500">职级</span><div class="text-white/80 mt-0.5">{{ data.talentProfile.careerLevel || '—' }}</div></div>
          <div><span class="text-gray-500">匹配次数</span><div class="text-white/80 mt-0.5">{{ data.talentProfile.matchCount || 0 }}</div></div>
          <div><span class="text-gray-500">薪资范围</span><div class="text-white/80 mt-0.5">{{ data.talentProfile.salaryMin != null || data.talentProfile.salaryMax != null ? `${data.talentProfile.salaryMin ?? '?'}-${data.talentProfile.salaryMax ?? '?'}K` : '—' }}</div></div>
          <div><span class="text-gray-500">最后匹配</span><div class="text-white/80 mt-0.5">{{ data.talentProfile.lastMatchedAt ? formatTime(data.talentProfile.lastMatchedAt) : '—' }}</div></div>
        </div>
        <div v-if="data.talentProfile.strengths?.length" class="mt-3 pt-3 border-t border-[#1A2240]">
          <span class="text-gray-500 text-[10px]">优势</span>
          <div class="flex flex-wrap gap-1 mt-1">
            <span v-for="s in data.talentProfile.strengths" :key="s" class="px-1.5 py-0.5 rounded bg-green-600/10 text-green-400 text-[10px]">{{ s }}</span>
          </div>
        </div>
        <div v-if="data.talentProfile.risks?.length" class="mt-2">
          <span class="text-gray-500 text-[10px]">风险</span>
          <div class="flex flex-wrap gap-1 mt-1">
            <span v-for="r in data.talentProfile.risks" :key="r" class="px-1.5 py-0.5 rounded bg-red-600/10 text-red-400 text-[10px]">{{ r }}</span>
          </div>
        </div>
        <div v-if="data.talentProfile.projects" class="mt-3 pt-3 border-t border-[#1A2240]">
          <div class="text-gray-500 text-[10px] mb-1">项目经历</div>
          <div class="text-white/70 text-[11px] leading-relaxed bg-black/20 rounded p-3">{{ data.talentProfile.projects }}</div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(false)
const error = ref('')
const data = ref<any>(null)

function seekClass(s: string) {
  return ({
    actively_looking: 'bg-green-500/10 text-green-400',
    open_to_offer: 'bg-blue-500/10 text-blue-400',
    not_looking: 'bg-gray-500/10 text-gray-400',
  } as Record<string, string>)[s] || 'bg-gray-500/10 text-gray-400'
}

function levelClass(l: string) {
  return ({
    expert: 'text-green-400',
    advanced: 'text-blue-400',
    intermediate: 'text-yellow-400',
    beginner: 'text-gray-400',
  } as Record<string, string>)[l] || 'text-gray-400'
}

function matchStatusClass(s: string) {
  return ({
    matched: 'bg-green-500/10 text-green-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    rejected: 'bg-red-500/10 text-red-400',
  } as Record<string, string>)[s] || 'bg-gray-500/10 text-gray-400'
}

function matchDimLabel(key: string) {
  return ({
    city: '城市',
    salary: '薪资',
    skills: '技能',
    education: '学历',
    experience: '经验',
  } as Record<string, string>)[key] || key
}

function formatTime(t: string) {
  if (!t) return '—'
  return new Date(t).toLocaleDateString('zh-CN')
}

function formatDateRange(start: string, end: string, isCurrent: boolean) {
  const s = start ? new Date(start).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' }) : '?'
  const e = isCurrent || !end ? '至今' : new Date(end).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' })
  return `${s} → ${e}`
}

async function loadData(_force = false) {
  const id = route.params.id as string
  if (!id) {
    error.value = '缺少候选人 ID'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/candidates/${id}/review`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data.value = await res.json()
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadData() })
</script>
