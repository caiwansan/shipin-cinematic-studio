<!-- Admin: AI 员工管理 -->
<!-- 位置：/admin/recruitment/agents.vue -->
<!-- 职责：全平台 AI 员工 Runtime — 搜索/筛选/详情/启停控制 + 模型配置（P5-ADMIN-01） -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">🤖 AI 员工管理</h1>
        <p class="text-xs text-gray-500 mt-1">全平台 AI 员工 Runtime 状态 · 模型配置</p>
      </div>
      <div class="flex gap-2">
        <button @click="openModelConfigPool" class="px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg text-xs hover:bg-purple-600/30 transition cursor-pointer border-none">🧠 模型池</button>
        <button @click="fetchData" class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">🔄 刷新</button>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
        <input
          v-model="searchKey"
          @keyup.enter="page = 1; fetchData()"
          placeholder="搜索 AI 员工名称、类型..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterState" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部状态</option>
        <option value="ACTIVE">Running</option>
        <option value="PAUSED">Paused</option>
        <option value="STOPPED">Stopped</option>
        <option value="RECOVERING">Recovering</option>
        <option value="EMERGENCY_STOP">Emergency</option>
      </select>
      <select v-model="filterType" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部类型</option>
        <option value="recruiter">Recruiter</option>
        <option value="marketing">Marketing</option>
        <option value="interview">Interview</option>
        <option value="career_advisor">Career Advisor</option>
        <option value="resume_analyzer">Resume Analyzer</option>
        <option value="talent_hunter">Talent Hunter</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载中...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      ⚠️ {{ error }} <button @click="fetchData" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <template v-else>
      <!-- Stats Bar -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-white/90">{{ total }}</div>
          <div class="text-[10px] text-gray-500">总数</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-green-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-green-400">{{ stateStats.ACTIVE || 0 }}</div>
          <div class="text-[10px] text-gray-500">Running</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-yellow-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-yellow-400">{{ stateStats.PAUSED || 0 }}</div>
          <div class="text-[10px] text-gray-500">Paused</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-blue-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-blue-400">{{ stateStats.RECOVERING || 0 }}</div>
          <div class="text-[10px] text-gray-500">Recovering</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-red-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-red-400">{{ (stateStats.EMERGENCY_STOP || 0) + (stateStats.STOPPED || 0) }}</div>
          <div class="text-[10px] text-gray-500">Stopped / Emergency</div>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-[#1A2240]">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-[#0D1328]">
              <th class="text-left py-3 px-4 text-gray-500 font-medium">名称</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">类型</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">状态</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">模型</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">所属企业</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">更新时间</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="7" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">🤖</div>
                暂无 AI 员工
              </td>
            </tr>
            <tr v-for="agent in list" :key="agent.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ agent.name }}</div>
                <div v-if="agent.description" class="text-gray-600 text-[10px]">{{ agent.description }}</div>
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="typeClass(agent.agentType)">{{ typeLabel(agent.agentType) }}</span>
              </td>
              <td class="py-3 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="stateClass(agent.lifecycleState)">{{ stateLabel(agent.lifecycleState) }}</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-gray-400">{{ agent.modelLabel || '未配置' }}</span>
              </td>
              <td class="py-3 px-4 text-gray-400">{{ agent.enterprise?.name || '—' }}</td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(agent.updatedAt) }}</td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button @click="openDetail(agent)" class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none">详情</button>
                  <button v-if="agent.lifecycleState === 'ACTIVE'" @click="updateAgentState(agent, 'PAUSED')" class="px-2 py-1 rounded text-[10px] bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 cursor-pointer border-none">暂停</button>
                  <button v-if="agent.lifecycleState === 'PAUSED'" @click="updateAgentState(agent, 'ACTIVE')" class="px-2 py-1 rounded text-[10px] bg-green-600/10 text-green-400 hover:bg-green-600/20 cursor-pointer border-none">恢复</button>
                  <button v-if="agent.lifecycleState !== 'EMERGENCY_STOP'" @click="updateAgentState(agent, 'EMERGENCY_STOP')" class="px-2 py-1 rounded text-[10px] bg-red-600/10 text-red-400 hover:bg-red-600/20 cursor-pointer border-none">急停</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between text-xs text-gray-500">
        <span>共 {{ total }} 条 · 第 {{ page }}/{{ totalPages }} 页</span>
        <div class="flex gap-2">
          <button @click="page--; fetchData()" :disabled="page <= 1" class="px-3 py-1.5 bg-[#0D1328] border border-[#1A2240] rounded-lg disabled:opacity-30 cursor-pointer hover:bg-white/5">上一页</button>
          <button @click="page++; fetchData()" :disabled="page >= totalPages" class="px-3 py-1.5 bg-[#0D1328] border border-[#1A2240] rounded-lg disabled:opacity-30 cursor-pointer hover:bg-white/5">下一页</button>
        </div>
      </div>
    </template>

    <!-- Detail Modal -->
    <Teleport to="body">
      <div v-if="detailItem" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="detailItem = null">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 mx-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-white/90">AI 员工详情</h2>
            <button @click="detailItem = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <template v-if="detailItem">
            <!-- 基本信息 -->
            <div class="space-y-4 text-xs">
              <div class="flex items-center gap-4 pb-4 border-b border-[#1A2240]">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-xl">🤖</div>
                <div>
                  <div class="text-white/90 font-semibold text-sm">{{ detailItem.name }}</div>
                  <div class="text-gray-500">{{ typeLabel(detailItem.agentType) }}</div>
                  <div class="mt-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="stateClass(detailItem.lifecycleState)">{{ stateLabel(detailItem.lifecycleState) }}</span>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div><span class="text-gray-500">所属企业：</span><span class="text-white/70">{{ detailItem.enterprise?.name || '—' }}</span></div>
                <div><span class="text-gray-500">最后恢复：</span><span class="text-white/70">{{ detailItem.lastRecoveredAt ? formatTime(detailItem.lastRecoveredAt) : '—' }}</span></div>
                <div><span class="text-gray-500">创建时间：</span><span class="text-white/70">{{ formatTime(detailItem.createdAt) }}</span></div>
                <div><span class="text-gray-500">更新时间：</span><span class="text-white/70">{{ formatTime(detailItem.updatedAt) }}</span></div>
              </div>
              <div v-if="detailItem.description">
                <div class="text-gray-500 mb-1">描述</div>
                <div class="text-white/70 leading-relaxed bg-black/20 rounded-lg p-3">{{ detailItem.description }}</div>
              </div>
              <div v-if="detailItem.capabilities?.length">
                <div class="text-gray-500 mb-1">能力标签</div>
                <div class="flex flex-wrap gap-1">
                  <span v-for="c in detailItem.capabilities" :key="c" class="px-2 py-0.5 rounded-full bg-purple-600/10 text-purple-400 text-[10px]">{{ c }}</span>
                </div>
              </div>
            </div>

            <!-- 模型配置面板（P5-ADMIN-01） -->
            <div class="mt-6 pt-4 border-t border-[#1A2240]">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-white/90">🧠 模型配置</h3>
                <button @click="showBindModel = !showBindModel" class="px-3 py-1 rounded-lg text-[10px] bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 cursor-pointer border-none">
                  {{ showBindModel ? '取消' : '+ 绑定模型' }}
                </button>
              </div>

              <!-- 绑定模型表单 -->
              <div v-if="showBindModel" class="bg-black/20 rounded-lg p-4 mb-3 space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">模型</label>
                    <select v-model="bindForm.llmConfigId" class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2">
                      <option value="">选择模型</option>
                      <option v-for="c in modelConfigList" :key="c.id" :value="c.id">{{ c.provider }}/{{ c.modelName }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">任务类型</label>
                    <select v-model="bindForm.taskType" class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2">
                      <option value="default">默认</option>
                      <option value="chat">对话</option>
                      <option value="analysis">分析</option>
                      <option value="generation">生成</option>
                      <option value="screening">筛选</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">Temperature</label>
                    <input v-model.number="bindForm.temperature" type="number" step="0.1" min="0" max="2" class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">Max Tokens</label>
                    <input v-model.number="bindForm.maxTokens" type="number" step="1024" min="256" max="128000" class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2" />
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <label class="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                    <input v-model="bindForm.fallbackEnabled" type="checkbox" class="rounded" />
                    启用 Fallback
                  </label>
                  <select v-model="bindForm.failureStrategy" class="bg-[#0D1328] border border-[#1A2240] rounded text-[10px] text-gray-400 px-2 py-1">
                    <option value="fallback">Fallback</option>
                    <option value="retry">Retry</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
                <div class="flex justify-end gap-2">
                  <button @click="bindModel" :disabled="!bindForm.llmConfigId || bindSaving" class="px-4 py-1.5 rounded-lg text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-30 cursor-pointer border-none">
                    {{ bindSaving ? '保存中...' : '确认绑定' }}
                  </button>
                </div>
              </div>

              <!-- 已绑定模型列表 -->
              <div v-if="modelBindings.length === 0" class="text-center py-4 text-gray-600 text-[10px]">
                暂未绑定模型
              </div>
              <div v-else class="space-y-2">
                <div v-for="b in modelBindings" :key="b.id" class="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
                  <div class="flex items-center gap-3">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400">{{ b.provider }}</span>
                    <span class="text-white/70 text-[11px]">{{ b.modelName }}</span>
                    <span class="text-gray-500 text-[10px]">/{{ b.taskType }}</span>
                    <span v-if="!b.enabled" class="px-1.5 py-0.5 rounded text-[9px] bg-red-500/10 text-red-400">已禁用</span>
                  </div>
                  <div class="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>t={{ b.temperature }}</span>
                    <span>max={{ b.maxTokens }}</span>
                    <button @click="toggleBinding(b)" class="px-2 py-0.5 rounded cursor-pointer border-none" :class="b.enabled ? 'bg-yellow-600/10 text-yellow-400' : 'bg-green-600/10 text-green-400'">
                      {{ b.enabled ? '禁用' : '启用' }}
                    </button>
                    <button @click="removeBinding(b)" class="px-2 py-0.5 rounded bg-red-600/10 text-red-400 cursor-pointer border-none">移除</button>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div class="flex justify-end gap-2 mt-6">
            <button v-if="detailItem?.lifecycleState === 'ACTIVE'" @click="updateAgentState(detailItem, 'PAUSED'); detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 cursor-pointer border-none">暂停</button>
            <button v-if="detailItem?.lifecycleState === 'PAUSED'" @click="updateAgentState(detailItem, 'ACTIVE'); detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-green-600/10 text-green-400 hover:bg-green-600/20 cursor-pointer border-none">恢复</button>
            <button v-if="detailItem?.lifecycleState !== 'EMERGENCY_STOP'" @click="updateAgentState(detailItem, 'EMERGENCY_STOP'); detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-red-600/10 text-red-400 hover:bg-red-600/20 cursor-pointer border-none">急停</button>
            <button @click="detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer border-none">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Model Config Pool Modal -->
    <Teleport to="body">
      <div v-if="showModelPool" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="showModelPool = false">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 mx-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-white/90">🧠 模型池管理</h2>
            <button @click="showModelPool = false" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>

          <!-- 新增模型表单 -->
          <div class="bg-black/20 rounded-lg p-4 mb-4 space-y-3">
            <div class="text-xs text-gray-400 font-medium">添加模型配置</div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">Provider</label>
                <select v-model="configForm.provider" class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2">
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">通义千问</option>
                  <option value="claude">Claude</option>
                  <option value="zhipu">智谱</option>
                  <option value="moonshot">月之暗面</option>
                  <option value="volcengine">火山引擎</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">Model Name</label>
                <input v-model="configForm.modelName" placeholder="e.g. gpt-4o" class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">Base URL (可选)</label>
                <input v-model="configForm.baseUrl" placeholder="https://..." class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label class="text-[10px] text-gray-500 block mb-1">API Key</label>
                <input v-model="configForm.apiKey" type="password" placeholder="sk-..." class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">Max Tokens/Day</label>
                <input v-model.number="configForm.maxTokensPerDay" type="number" min="0" placeholder="0=不限" class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2" />
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <button @click="testConfig" :disabled="configSaving" class="px-4 py-1.5 rounded-lg text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-30 cursor-pointer border-none">
                {{ configSaving ? '测试中...' : '测试连通性' }}
              </button>
              <button @click="saveConfig" :disabled="configSaving || !configForm.provider || !configForm.modelName || !configForm.apiKey" class="px-4 py-1.5 rounded-lg text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-30 cursor-pointer border-none">
                {{ configSaving ? '保存中...' : '保存' }}
              </button>
            </div>
            <div v-if="configTestResult" class="text-[10px] mt-2" :class="configTestResult.success ? 'text-green-400' : 'text-red-400'">
              {{ configTestResult.success ? '✅ 连通 (' + configTestResult.latencyMs + 'ms)' : '❌ ' + configTestResult.error }}
            </div>
          </div>

          <!-- 模型池列表 -->
          <div v-if="modelConfigList.length === 0" class="text-center py-8 text-gray-600 text-xs">
            暂无模型配置
          </div>
          <div v-else class="space-y-2">
            <div v-for="c in modelConfigList" :key="c.id" class="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
              <div class="flex items-center gap-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400">{{ c.provider }}</span>
                <span class="text-white/70 text-[11px]">{{ c.modelName }}</span>
                <span v-if="!c.enabled" class="px-1.5 py-0.5 rounded text-[9px] bg-red-500/10 text-red-400">已禁用</span>
              </div>
              <div class="flex items-center gap-2">
                <button @click="testConfigById(c.id)" class="px-2 py-0.5 rounded bg-blue-600/10 text-blue-400 text-[10px] cursor-pointer border-none">测试</button>
                <button @click="toggleConfig(c)" class="px-2 py-0.5 rounded text-[10px] cursor-pointer border-none" :class="c.enabled ? 'bg-yellow-600/10 text-yellow-400' : 'bg-green-600/10 text-green-400'">
                  {{ c.enabled ? '禁用' : '启用' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted, reactive } from 'vue'

// ─── 原有状态 ───
const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = ref(0)
const filterState = ref('')
const filterType = ref('')
const searchKey = ref('')
const detailItem = ref<any>(null)
const stateStats = ref<Record<string, number>>({})

// ─── P5-ADMIN-01: 模型配置状态 ───
const showBindModel = ref(false)
const showModelPool = ref(false)
const modelConfigList = ref<any[]>([])
const modelBindings = ref<any[]>([])
const bindSaving = ref(false)
const configSaving = ref(false)
const configTestResult = ref<any>(null)

const bindForm = reactive({
  llmConfigId: '',
  taskType: 'default',
  temperature: 0.7,
  maxTokens: 16384,
  fallbackEnabled: true,
  failureStrategy: 'fallback',
  enabled: true,
})

const configForm = reactive({
  provider: 'openai',
  modelName: '',
  apiKey: '',
  baseUrl: '',
  maxTokensPerDay: 0,
})

// ─── 原有函数 ───
function typeLabel(t: string) {
  return ({ recruiter: 'Recruiter', marketing: 'Marketing', interview: 'Interview', career_advisor: 'Career Advisor', resume_analyzer: 'Resume Analyzer', talent_hunter: 'Talent Hunter' } as Record<string, string>)[t] || t
}
function typeClass(t: string) {
  return ({ recruiter: 'bg-blue-500/10 text-blue-400', marketing: 'bg-purple-500/10 text-purple-400', interview: 'bg-green-500/10 text-green-400', career_advisor: 'bg-yellow-500/10 text-yellow-400', resume_analyzer: 'bg-cyan-500/10 text-cyan-400', talent_hunter: 'bg-orange-500/10 text-orange-400' } as Record<string, string>)[t] || 'bg-gray-500/10 text-gray-400'
}
function stateLabel(s: string) {
  return ({ ACTIVE: 'Running', PAUSED: 'Paused', STOPPED: 'Stopped', RECOVERING: 'Recovering', EMERGENCY_STOP: 'Emergency' } as Record<string, string>)[s] || s
}
function stateClass(s: string) {
  return ({ ACTIVE: 'bg-green-500/10 text-green-400', PAUSED: 'bg-yellow-500/10 text-yellow-400', STOPPED: 'bg-gray-500/10 text-gray-400', RECOVERING: 'bg-blue-500/10 text-blue-400', EMERGENCY_STOP: 'bg-red-500/10 text-red-400' } as Record<string, string>)[s] || 'bg-gray-500/10 text-gray-400'
}

function formatTime(t: string) {
  if (!t) return '—'
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

function openDetail(agent: any) {
  detailItem.value = agent
  showBindModel.value = false
  loadModelBindings(agent.id)
}

async function updateAgentState(agent: any, state: string) {
  const label = stateLabel(state)
  if (!confirm(`确认将「${agent.name}」状态设为「${label}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${agent.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fetchData()
  } catch (e: any) {
    error.value = '操作失败：' + (e.message || '未知错误')
  }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (filterState.value) params.set('state', filterState.value)
    if (filterType.value) params.set('type', filterType.value)
    if (searchKey.value) params.set('keyword', searchKey.value)
    const res = await fetch(`/api/admin/recruitment/agents?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    total.value = json.total
    totalPages.value = Math.ceil(json.total / pageSize)
    stateStats.value = json.stateStats || {}
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ─── P5-ADMIN-01: 模型配置函数 ──-

async function openModelConfigPool() {
  showModelPool.value = true
  loadModelConfigList()
}

async function loadModelConfigList() {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/admin/recruitment/agent-model-config', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    modelConfigList.value = json.list || []
  } catch (e: any) {
    error.value = '加载模型池失败：' + e.message
  }
}

async function loadModelBindings(agentId: string) {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${agentId}/model-binding`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    modelBindings.value = json.bindings || []
  } catch (e: any) {
    modelBindings.value = []
  }
}

async function bindModel() {
  if (!bindForm.llmConfigId || !detailItem.value) return
  bindSaving.value = true
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${detailItem.value.id}/model-binding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(bindForm),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    showBindModel.value = false
    loadModelBindings(detailItem.value.id)
  } catch (e: any) {
    error.value = '绑定失败：' + e.message
  } finally {
    bindSaving.value = false
  }
}

async function removeBinding(b: any) {
  if (!confirm(`确认移除模型绑定「${b.provider}/${b.modelName}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${detailItem.value.id}/model-binding/${b.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loadModelBindings(detailItem.value.id)
  } catch (e: any) {
    error.value = '移除失败：' + e.message
  }
}

async function toggleBinding(b: any) {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${detailItem.value.id}/model-binding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        llmConfigId: b.llmConfigId,
        taskType: b.taskType,
        temperature: b.temperature,
        maxTokens: b.maxTokens,
        fallbackEnabled: b.fallbackEnabled,
        failureStrategy: b.failureStrategy,
        enabled: !b.enabled,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loadModelBindings(detailItem.value.id)
  } catch (e: any) {
    error.value = '操作失败：' + e.message
  }
}

async function saveConfig() {
  configSaving.value = true
  configTestResult.value = null
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/admin/recruitment/agent-model-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(configForm),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    configForm.modelName = ''
    configForm.apiKey = ''
    configForm.baseUrl = ''
    configForm.maxTokensPerDay = 0
    loadModelConfigList()
  } catch (e: any) {
    error.value = '保存失败：' + e.message
  } finally {
    configSaving.value = false
  }
}

async function testConfig() {
  configSaving.value = true
  configTestResult.value = null
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    // 先保存再测试
    const saveRes = await fetch('/api/admin/recruitment/agent-model-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(configForm),
    })
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}))
      configTestResult.value = { success: false, error: err.error || `HTTP ${saveRes.status}` }
      return
    }
    const saved = await saveRes.json()
    // 测试连通性
    const testRes = await fetch(`/api/admin/recruitment/agent-model-config/${saved.id}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    configTestResult.value = await testRes.json()
    loadModelConfigList()
  } catch (e: any) {
    configTestResult.value = { success: false, error: e.message }
  } finally {
    configSaving.value = false
  }
}

async function testConfigById(id: string) {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agent-model-config/${id}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    alert(result.success ? `✅ 连通 (${result.latencyMs}ms)` : `❌ ${result.error}`)
  } catch (e: any) {
    alert('测试失败：' + e.message)
  }
}

async function toggleConfig(c: any) {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agent-model-config/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: !c.enabled }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    loadModelConfigList()
  } catch (e: any) {
    error.value = '操作失败：' + e.message
  }
}

onMounted(() => { fetchData() })
</script>