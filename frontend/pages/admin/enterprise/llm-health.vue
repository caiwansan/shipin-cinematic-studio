<!-- /admin/enterprise/llm-health.vue — Sprint-RECRUITMENT-REALITY-04 T01 Model Health Center -->
<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">Model Health Center</h1>
        <p class="text-sm text-gray-400 mt-1">企业 LLM Key 健康治理 — 每个 AI 员工背后的模型配置是否可用</p>
      </div>
      <button
        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium disabled:opacity-50"
        :disabled="testing"
        @click="testAll"
      >
        {{ testing ? '测试中...' : '🩺 全量测试连接' }}
      </button>
    </div>

    <!-- 异常待办横幅（Sprint-06 T03：通知 + 一键修复入口） -->
    <div v-if="issues.length" class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-wrap items-center gap-3">
      <div class="flex-1 min-w-[240px]">
        <div class="text-sm font-bold text-red-400">⚠️ {{ issues.length }} 个模型异常待处理</div>
        <div class="text-[11px] text-gray-400 mt-0.5">
          受影响企业：{{ issueOrgs }}。异常配置已自动阻断 AI 员工执行（不会静默 fallback 到其它 key）。
        </div>
      </div>
      <button
        class="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded-lg font-medium disabled:opacity-50"
        :disabled="testing"
        @click="retryIssues"
      >{{ testing ? '重试中...' : '🔧 一键重试全部异常' }}</button>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-6 gap-3">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-white">{{ summary.total || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">配置总数</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-green-400">{{ summary.ok || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">✅ 可用</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-red-400">{{ summary.failed || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">❌ key 失效</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-orange-400">{{ summary.decryptError || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">🔒 解密失败</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-gray-400">{{ summary.disabled || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">⏸ 已停用</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-gray-400">{{ summary.untested || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">未测试</div>
      </div>
    </div>

    <!-- 健康列表 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-400 border-b border-[#1A2240]">
              <th class="text-left px-4 py-3 font-medium">租户</th>
              <th class="text-left px-4 py-3 font-medium">Provider</th>
              <th class="text-left px-4 py-3 font-medium">模型</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">延迟</th>
              <th class="text-left px-4 py-3 font-medium">最近检查</th>
              <th class="text-left px-4 py-3 font-medium">错误信息</th>
              <th class="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in configs"
              :key="c.id"
              class="border-b border-[#141B36] hover:bg-[#111A38]/50"
              :class="issueMap.has(c.id) ? 'bg-red-500/5' : ''"
            >
              <td class="px-4 py-3 text-gray-300 font-mono">
                {{ c.tenantId?.slice(0, 8) }}
                <span v-if="issueMap.has(c.id)" class="ml-1 text-[10px] text-red-400">●</span>
              </td>
              <td class="px-4 py-3 text-gray-300">{{ c.provider }}</td>
              <td class="px-4 py-3 text-gray-300">{{ c.modelName }}</td>
              <td class="px-4 py-3">
                <span :class="badgeClass(c.healthStatus)">{{ statusLabel(c.healthStatus) }}</span>
                <span v-if="!c.enabled" class="ml-1 text-[10px] text-gray-500">(停用)</span>
              </td>
              <td class="px-4 py-3 text-gray-300">
                {{ c.healthLatencyMs ? c.healthLatencyMs + 'ms' : '-' }}
              </td>
              <td class="px-4 py-3 text-gray-400">
                {{ c.lastHealthCheckAt ? new Date(c.lastHealthCheckAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-' }}
              </td>
              <td class="px-4 py-3 text-red-400/80 max-w-[260px] truncate" :title="c.healthError || ''">
                {{ c.healthError || '-' }}
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <button
                  class="px-2 py-1 bg-[#1A2240] hover:bg-[#243054] text-gray-300 rounded text-[10px]"
                  :disabled="testing"
                  @click="testOne(c.id)"
                >测试</button>
                <div v-if="issueMap.get(c.id)" class="mt-1 max-w-[180px] text-[9px] text-amber-400/80 leading-snug">
                  ↳ {{ issueMap.get(c.id) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 治理提示 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
      <div class="text-gray-300 font-medium mb-1">🔧 治理指南</div>
      <div>· <span class="text-orange-400">解密失败</span>：CRYPTO_ENCRYPTION_KEY 曾变更，旧密文无法解开 → 需企业在后台重新保存 key（重新加密）</div>
      <div>· <span class="text-red-400">key 失效</span>：key 已过期/被吊销 → 需企业更新 key</div>
      <div>· 测试为真实 1-token 调用（15s 超时），失败不影响业务，仅记录状态</div>
      <div class="text-gray-500 mt-1">⚠️ API Key 永不明文展示；错误信息已脱敏，不含完整 key</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted } from 'vue'

const configs = ref<any[]>([])
const summary = ref<any>({})
const testing = ref(false)
const issues = ref<any[]>([])
const issueMap = computed(() => new Map(issues.value.map((i) => [i.id, i.suggestion])))
const issueOrgs = computed(() => {
  const names = [...new Set(issues.value.map((i) => i.orgName || i.tenantId?.slice(0, 8)))]
  return names.slice(0, 3).join('、') + (names.length > 3 ? ` 等 ${names.length} 家` : '')
})

function badgeClass(s: string) {
  return {
    ok: 'px-2 py-0.5 rounded bg-green-500/10 text-green-400',
    failed: 'px-2 py-0.5 rounded bg-red-500/10 text-red-400',
    decrypt_error: 'px-2 py-0.5 rounded bg-orange-500/10 text-orange-400',
    disabled: 'px-2 py-0.5 rounded bg-gray-500/10 text-gray-400',
    untested: 'px-2 py-0.5 rounded bg-gray-500/10 text-gray-400',
  }[s] || 'px-2 py-0.5 rounded bg-gray-500/10 text-gray-400'
}
function statusLabel(s: string) {
  return {
    ok: '✅ 可用',
    failed: '❌ key 失效',
    decrypt_error: '🔒 解密失败',
    disabled: '⏸ 已停用',
    untested: '未测试',
  }[s] || s
}

async function load() {
  const [res, issueRes] = await Promise.all([
    fetch('/api/admin/llm/health'),
    fetch('/api/admin/llm/health/issues'),
  ])
  const d = await res.json()
  configs.value = d.data || []
  summary.value = d.summary || {}
  const id = await issueRes.json()
  issues.value = id.data?.issues || []
}

async function testAll() {
  testing.value = true
  try {
    await fetch('/api/admin/llm/health/test/all', { method: 'POST' })
    await load()
  } finally {
    testing.value = false
  }
}

async function testOne(id: string) {
  testing.value = true
  try {
    await fetch(`/api/admin/llm/health/test/${id}`, { method: 'POST' })
    await load()
  } finally {
    testing.value = false
  }
}

// Sprint-06 T03: 一键重试全部异常配置（只测 failed/decrypt_error，不碰 disabled/untested）
async function retryIssues() {
  testing.value = true
  try {
    const retryable = issues.value.filter((i) => ['failed', 'decrypt_error'].includes(i.healthStatus))
    for (const i of retryable) {
      await fetch(`/api/admin/llm/health/test/${i.id}`, { method: 'POST' })
    }
    await load()
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>
