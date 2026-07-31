<template>
  <div class="space-y-6">
    <!-- Sprint-ADMIN-IA-REALITY-03 T02: Tab 导航 -->
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">🏗️ 大模型管理</h2>
      <div class="flex gap-1 border border-[#1A2240] rounded-lg p-0.5">
        <button v-for="t in tabs" :key="t.id" @click="tab = t.id"
          class="px-3 py-1.5 rounded-md text-[11px] transition-all"
          :class="tab === t.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'">
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- ═══ Tab 1: Provider 注册表 ═══ -->
    <div v-if="tab === 'providers'" class="space-y-4">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm text-white/70 font-medium">🔌 Provider 注册表</h3>
            <p class="text-[10px] text-gray-500 mt-1">平台统一 Provider 治理，workspace 不得自建 Provider</p>
          </div>
          <div class="flex items-center gap-2">
            <button @click="addProviderDialog = true" class="px-3 py-1.5 rounded-lg text-[11px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 transition-all cursor-pointer">+ 新增 Provider</button>
          </div>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="pr in aiProviders" :key="pr.providerCode" class="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-sm">{{ getProviderIcon(pr.providerCode) }}</span>
              <span class="text-[11px] text-white/70 font-medium flex-1">{{ pr.name }}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded" :class="statusClass(pr.credentialStatus)">{{ statusLabel(pr.credentialStatus) }}</span>
            </div>
            <div class="text-[9px] text-gray-600 truncate mb-2">{{ pr.endpoint || '未配置 Endpoint' }}</div>
            <div class="flex items-center gap-1.5 text-[9px] text-gray-500 mb-2">
              <span class="px-1.5 py-0.5 bg-white/[0.04] rounded">{{ pr.modelCount }} 模型</span>
              <span class="px-1.5 py-0.5 bg-white/[0.04] rounded" :class="pr.hasPlatformKey ? 'text-emerald-400' : 'text-gray-600'">{{ pr.hasPlatformKey ? '🔑 有Key' : '无Key' }}</span>
              <span v-if="pr.capabilities.length" class="px-1.5 py-0.5 bg-white/[0.04] rounded">{{ pr.capabilities.join('/') }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button @click="testProvider(pr)" :disabled="testingProvider === pr.providerCode" class="px-2 py-1 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 cursor-pointer transition-all">
                {{ testingProvider === pr.providerCode ? '⏳' : '🩺 测试' }}
              </button>
              <button @click="toggleProviderReg(pr)" class="px-2 py-1 rounded text-[10px] cursor-pointer transition-all" :class="pr.enabled ? 'bg-white/[0.04] text-gray-400 hover:text-yellow-400' : 'bg-emerald-500/10 text-emerald-400'">
                {{ pr.enabled ? '禁用' : '启用' }}
              </button>
              <button @click="deleteProvider(pr)" class="px-2 py-1 rounded text-[10px] bg-white/[0.04] text-gray-500 hover:text-red-400 cursor-pointer transition-all">删除</button>
            </div>
          </div>
        </div>
        <div v-if="providersSummary" class="mt-3 flex gap-3 text-[9px] text-gray-500">
          <span>共 {{ providersSummary.total }} 个 Provider</span>
          <span class="text-emerald-400">✓ {{ providersSummary.ok }} 健康</span>
          <span class="text-red-400">✗ {{ providersSummary.failed }} 失败</span>
          <span class="text-gray-400">? {{ providersSummary.untested }} 未测</span>
        </div>
      </div>
    </div>

    <!-- ═══ Tab 2: 平台默认模型 ═══ -->
    <div v-if="tab === 'defaults'" class="space-y-4">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <div class="mb-4">
          <h3 class="text-sm text-white/70 font-medium">🎯 平台默认模型</h3>
          <p class="text-[10px] text-gray-500 mt-1">优先级：用户 BYOK → 企业配置 → 平台默认 → env fallback。能力白名单防止跨能力调用。</p>
        </div>
        <div class="space-y-3">
          <div v-for="dm in defaultModels" :key="dm.stage" class="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] text-white/70 font-medium">{{ dm.label }}</span>
              <div class="flex items-center gap-2">
                <span v-if="dm.config?.enabled" class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">已启用</span>
                <span v-else class="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400">已禁用</span>
                <button @click="testDefaultModel(dm)" class="px-2 py-1 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 cursor-pointer transition-all">🩺 测试</button>
              </div>
            </div>
            <div class="flex gap-2 mb-2">
              <select v-model="dm.form.provider" class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-[10px] text-white/70 outline-none">
                <option v-for="pr in aiProviders" :key="pr.providerCode" :value="pr.providerCode">{{ pr.name }}</option>
              </select>
              <select v-model="dm.form.model" class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-[10px] text-white/70 outline-none">
                <option v-for="m in dm.candidateModels" :key="m.id" :value="m.name">{{ m.name }} <span v-if="!m.hasKey" class="text-gray-600">(无Key)</span></option>
              </select>
              <button @click="saveDefaultModel(dm)" :disabled="savingDefault === dm.stage" class="px-3 py-1.5 rounded-lg text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 cursor-pointer transition-all">
                {{ savingDefault === dm.stage ? '⏳' : '💾 保存' }}
              </button>
            </div>
            <div v-if="dm.msg" class="text-[9px]" :class="dm.msgErr ? 'text-red-400' : 'text-emerald-400'">{{ dm.msg }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Tab 3: 调用统计 ═══ -->
    <div v-if="tab === 'usage'" class="space-y-4">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm text-white/70 font-medium">📊 模型调用统计</h3>
            <p class="text-[10px] text-gray-500 mt-1">基于 usage_logs 真实数据，回答：哪个业务最贵？哪个 Agent 最赚钱？</p>
          </div>
          <select v-model="usageDays" @change="loadUsageStats" class="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-white/70 outline-none">
            <option :value="7">近 7 天</option>
            <option :value="30">近 30 天</option>
            <option :value="90">近 90 天</option>
          </select>
        </div>
        <div v-if="usageSummary" class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div class="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <div class="text-[9px] text-gray-500">总调用</div>
            <div class="text-sm text-white/80 font-medium mt-1">{{ usageSummary.totalCalls }}</div>
          </div>
          <div class="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <div class="text-[9px] text-gray-500">总成本</div>
            <div class="text-sm text-amber-400 font-medium mt-1">\${{ usageSummary.totalCost }}</div>
          </div>
          <div class="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <div class="text-[9px] text-gray-500">Token 消耗</div>
            <div class="text-sm text-white/80 font-medium mt-1">{{ formatTokens(usageSummary.totalTokens) }}</div>
          </div>
          <div class="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <div class="text-[9px] text-gray-500">平台成本</div>
            <div class="text-sm text-emerald-400 font-medium mt-1">\${{ usageSummary.platformCost }}</div>
          </div>
          <div class="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <div class="text-[9px] text-gray-500">用户 BYOK 成本</div>
            <div class="text-sm text-blue-400 font-medium mt-1">\${{ usageSummary.userCost }}</div>
          </div>
        </div>

        <!-- 趋势图（简化柱状） -->
        <div v-if="usageTrend.length" class="mb-5">
          <h4 class="text-[10px] text-gray-500 mb-2">每日成本趋势</h4>
          <div class="flex items-end gap-1 h-20">
            <div v-for="t in usageTrend" :key="t.date" class="flex-1 flex flex-col items-center gap-1">
              <div class="w-full rounded-t bg-blue-500/30 hover:bg-blue-500/50 transition-all" :style="{ height: barHeight(t.cost) + 'px' }" :title="t.date + ' $' + t.cost"></div>
            </div>
          </div>
        </div>

        <!-- 按模型 -->
        <div class="mb-4">
          <h4 class="text-[10px] text-gray-500 mb-2">按模型/任务聚合（TOP）</h4>
          <div class="space-y-1.5">
            <div v-for="row in usageByModel.slice(0, 8)" :key="row.provider + row.taskType" class="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-[10px]">
              <span class="w-20 text-white/60">{{ row.provider }}</span>
              <span class="flex-1 text-white/70">{{ row.taskType }}</span>
              <span class="text-gray-500">{{ row.calls }} 次</span>
              <span class="text-gray-500">{{ formatTokens(row.tokens) }}</span>
              <span class="text-amber-400 font-medium">\${{ row.cost }}</span>
            </div>
          </div>
        </div>

        <!-- 按 Agent -->
        <div>
          <h4 class="text-[10px] text-gray-500 mb-2">按 Agent 成本（回答：哪个 Agent 最贵）</h4>
          <div class="space-y-1.5">
            <div v-for="row in usageByAgent.slice(0, 6)" :key="row.agent" class="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-[10px]">
              <span class="flex-1 text-white/70">{{ row.agent }}</span>
              <span class="text-gray-500">{{ row.calls }} 次</span>
              <span class="text-amber-400 font-medium">\${{ row.cost }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Tab 4: 供应商模型库（原有） ═══ -->
    <div v-if="tab === 'models'" class="space-y-4">

    <!-- Sprint-06A: 业务 AI 模型配置（按 businessType 隔离） -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm text-white/70 font-medium">🏷️ 业务 AI 模型配置</h3>
          <p class="text-[10px] text-gray-500 mt-1">平台自供 LLM，各业务独立配置，用户无需 BYOK</p>
        </div>
        <button @click="saveBusinessTypeConfig" :disabled="savingBusinessType" class="px-4 py-1.5 rounded-lg text-[11px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 transition-all cursor-pointer">
          {{ savingBusinessType ? '⏳ 保存中...' : '💾 保存配置' }}
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="bt in businessTypes" :key="bt.key" class="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm">{{ bt.icon }}</span>
            <span class="text-[11px] text-white/70 font-medium">{{ bt.label }}</span>
            <span v-if="bt.config.hasApiKey" class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">已配置 Key</span>
          </div>
          <div class="space-y-2">
            <div>
              <label class="text-[9px] text-gray-500 block mb-0.5">供应商</label>
              <select v-model="bt.config.provider" class="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-white/70 outline-none">
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="volcengine">火山引擎</option>
                <option value="aliyun">阿里百炼</option>
                <option value="qwen">通义千问</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] text-gray-500 block mb-0.5">模型</label>
              <input v-model="bt.config.model" class="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-white/70 outline-none" placeholder="deepseek-v4-flash" />
            </div>
            <div>
              <label class="text-[9px] text-gray-500 block mb-0.5">API Key</label>
              <input v-model="bt.config.apiKey" type="password" class="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-white/70 outline-none" placeholder="sk-********（留空则不修改）" />
            </div>
            <div>
              <label class="text-[9px] text-gray-500 block mb-0.5">Base URL（可选）</label>
              <input v-model="bt.config.baseUrl" class="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-white/70 outline-none" placeholder="https://api.deepseek.com" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="businessTypeMsg" class="mt-2 text-[10px]" :class="businessTypeMsgErr ? 'text-red-400' : 'text-emerald-400'">{{ businessTypeMsg }}</div>
    </div>

    <!-- Sprint-06A: 分割线 -->
    <div class="border-t border-[#1A2240]/50 my-2"></div>

    <!-- API Key 配置区域 -->
    <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm text-white/70 font-medium">🔑 API Key 配置</h3>
          <p class="text-[10px] text-gray-500 mt-1">以下 Key 仅管理员用于同步官方模型列表，不会被用户调用</p>
        </div>
      </div>
      <div class="space-y-3">
        <div v-for="provKey in providerKeys" :key="provKey.provider" class="flex items-center gap-4">
          <div class="w-24 shrink-0 text-[11px] text-white/60 font-medium">{{ getProviderIcon(provKey.provider) }} {{ provKey.label }}</div>
          <div class="flex-1 flex gap-2">
            <input v-model="provKey.display" :type="provKey.show ? 'text' : 'password'" class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40 transition" :placeholder="provKey.keyHint" />
            <button @click="provKey.show = !provKey.show" class="px-2.5 py-1 rounded-lg text-[10px] bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 cursor-pointer transition-all">{{ provKey.show ? '🙈' : '👁️' }}</button>
            <button @click="toggleEdit(provKey)" class="px-2.5 py-1 rounded-lg text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer">
              {{ provKey.editing ? '取消' : '编辑' }}
            </button>
          </div>
        </div>
        <div class="flex justify-end pt-2">
          <button @click="saveKeys" :disabled="savingKeys" class="px-4 py-1.5 rounded-lg text-[11px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 transition-all cursor-pointer">
            {{ savingKeys ? '⏳ 保存中...' : '💾 保存 API Key' }}
          </button>
          <span v-if="keyMsg" class="ml-3 text-[10px] flex items-center" :class="keyMsgErr ? 'text-red-400' : 'text-emerald-400'">{{ keyMsg }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchData" class="ml-2 underline">重试</button>
    </div>

    <template v-else>
      <div v-for="prov in providers" :key="prov.provider" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <!-- 供应商头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-[#1A2240]">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0" :class="prov.enabled ? 'bg-green-500/10' : 'bg-white/[0.04]'">
              {{ getProviderIcon(prov.provider) }}
            </div>
            <div>
              <div class="text-sm text-white/80 font-medium">{{ prov.providerName }}</div>
              <div class="text-[10px] text-gray-500 mt-0.5">{{ getModelCount(prov) }} 个模型</div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px]" :class="prov.enabled ? 'text-green-400' : 'text-gray-500'">
              {{ prov.enabled ? '已启用' : '已禁用' }}
            </span>
            <label class="relative inline-block w-10 h-5 cursor-pointer">
              <input type="checkbox" :checked="prov.enabled" class="opacity-0 w-0 h-0 peer" @change="toggleProvider(prov)" />
              <span class="absolute inset-0 rounded-full transition-colors peer-checked:bg-blue-500/40 bg-white/[0.08] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform after:peer-checked:translate-x-5 after:peer-checked:bg-blue-400"></span>
            </label>
          </div>
        </div>

        <!-- 模型类别列表 -->
        <div class="px-5 py-3 space-y-3">
          <div v-for="type in modelTypes" :key="type.key" class="flex items-start gap-4 py-2 border-b border-[#1A2240]/50 last:border-b-0">
            <div class="w-20 shrink-0 text-[10px] text-gray-400 font-medium pt-1">{{ type.label }}</div>
            <div class="flex-1">
              <!-- 已选模型标签 -->
              <div class="flex flex-wrap gap-1.5 mb-2">
                <span v-for="model in getModelsForType(prov, type.key)" :key="model.name"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] border border-white/[0.08] text-white/60">
                  {{ model.label || model.name }}
                </span>
                <span v-if="getModelsForType(prov, type.key).length === 0" class="text-[10px] text-gray-600">暂无模型</span>
              </div>
              <!-- 操作按钮 -->
              <div class="flex gap-2">
                <button @click="showModelManager(prov, type.key)" class="px-2.5 py-1 rounded-lg text-[10px] bg-indigo-600/15 text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600/25 transition-all">
                  ✏️ 编辑模型列表
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="providers.length === 0" class="text-center py-16 text-gray-600 text-sm">暂无供应商数据</div>
    </template>
    </div>
    <!-- /Tab 4 结束 -->

    <!-- 新增 Provider 弹窗 -->
    <div v-if="addProviderDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="addProviderDialog = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-[420px] max-w-[90vw] p-6">
        <h3 class="text-sm font-semibold text-white/80 mb-4">+ 新增 Provider</h3>
        <div class="space-y-3">
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">Provider Code（唯一，如 deepseek）</label>
            <input v-model="newProvider.providerCode" placeholder="deepseek" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-blue-500/40" />
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">名称</label>
            <input v-model="newProvider.name" placeholder="DeepSeek" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-blue-500/40" />
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">Endpoint（可选）</label>
            <input v-model="newProvider.endpoint" placeholder="https://api.deepseek.com/v1" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-white/70 outline-none focus:border-blue-500/40" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button @click="addProviderDialog = false" class="px-4 py-1.5 rounded-lg text-[10px] bg-white/[0.06] text-white/50 hover:bg-white/[0.1] cursor-pointer transition-all">取消</button>
          <button @click="createProvider" class="px-4 py-1.5 rounded-lg text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 hover:bg-indigo-600/30 cursor-pointer transition-all">创建</button>
        </div>
      </div>
    </div>

    <!-- 模型编辑弹窗 -->
    <div v-if="editDialog.visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="editDialog.visible = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-[#1A2240]">
          <div>
            <h3 class="text-sm font-semibold text-white/80">✏️ 编辑模型列表</h3>
            <p class="text-[10px] text-gray-500 mt-0.5">{{ getProviderIcon(editDialog.provider) }} {{ getProviderName(editDialog.provider) }} · {{ getModelTypeLabel(editDialog.modelType) }}</p>
          </div>
          <button @click="editDialog.visible = false" class="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 border-none cursor-pointer text-xs">✕</button>
        </div>
        <div class="px-6 py-4 overflow-y-auto flex-1 space-y-2">
          <div v-if="editDialog.models.length === 0" class="text-center py-8 text-gray-600 text-xs">暂无模型，可点击「同步官方模型列表」获取</div>
          <div v-for="(model, idx) in editDialog.models" :key="idx"
            class="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <input type="checkbox" v-model="model.checked" class="accent-indigo-500" />
            <div class="flex-1 min-w-0">
              <div class="text-[11px] text-white/70 truncate">{{ model.label || model.name }}</div>
              <div class="text-[9px] text-gray-500 truncate">{{ model.name }}</div>
            </div>
            <button @click="removeModel(idx)" class="text-[10px] text-red-400/50 hover:text-red-400 bg-transparent border-none cursor-pointer">✕</button>
          </div>
        </div>
        <div class="flex items-center justify-between px-6 py-4 border-t border-[#1A2240]">
          <div class="flex gap-2">
            <button @click="addModelInput" class="px-3 py-1.5 rounded-lg text-[10px] bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-white/70 cursor-pointer transition-all">
              + 添加模型
            </button>
          </div>
          <div class="flex gap-2">
            <button @click="editDialog.visible = false" class="px-4 py-1.5 rounded-lg text-[10px] bg-white/[0.06] text-white/50 border-none cursor-pointer hover:bg-white/[0.1]">取消</button>
            <button @click="saveEditModels" class="px-4 py-1.5 rounded-lg text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 cursor-pointer hover:bg-indigo-600/30 transition-all">
              💾 保存模型列表
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, reactive, onMounted } from 'vue'

const loading = ref(true)
const error = ref('')
const syncing = ref(false)
const savingKeys = ref(false)
const keyMsg = ref('')
const keyMsgErr = ref(false)
const providers = ref<any[]>([])

// ─── Sprint-ADMIN-IA-REALITY-03 T02: Tab 状态 ───
const tab = ref<'providers' | 'defaults' | 'usage' | 'models'>('providers')
const tabs = [
  { id: 'providers', label: '🔌 Provider' },
  { id: 'defaults', label: '🎯 默认模型' },
  { id: 'usage', label: '📊 统计' },
  { id: 'models', label: '📚 模型库' },
]
const aiProviders = ref<any[]>([])
const providersSummary = ref<any>(null)
const testingProvider = ref('')
const addProviderDialog = ref(false)
const newProvider = reactive({ providerCode: '', name: '', endpoint: '' })
const defaultModels = ref<any[]>([])
const savingDefault = ref('')
const usageDays = ref(30)
const usageSummary = ref<any>(null)
const usageTrend = ref<any[]>([])
const usageByModel = ref<any[]>([])
const usageByAgent = ref<any[]>([])

const CAP_LABEL: Record<string, string> = { llm: '文本', image: '图片', video: '视频', tts: '语音', music: '音乐' }

function statusClass(s: string): string {
  return { ok: 'bg-emerald-500/10 text-emerald-400', failed: 'bg-red-500/10 text-red-400', untested: 'bg-gray-500/10 text-gray-400', decrypt_error: 'bg-orange-500/10 text-orange-400', disabled: 'bg-gray-500/10 text-gray-500' }[s] || 'bg-gray-500/10 text-gray-400'
}
function statusLabel(s: string): string {
  return { ok: '✓ 健康', failed: '✗ 失败', untested: '? 未测', decrypt_error: '⚠ 解密失败', disabled: '— 禁用' }[s] || s
}
function formatTokens(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}
function barHeight(cost: number): number {
  const max = Math.max(...usageTrend.value.map(t => t.cost), 0.01)
  return Math.max(2, Math.round((cost / max) * 70))
}

// ─── T02: Provider 管理 ───
async function loadAiProviders() {
  try {
    const token = getToken()
    const res = await fetch('/api/admin/ai-providers', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const d = await res.json()
    if (d.success) { aiProviders.value = d.data || []; providersSummary.value = d.summary || null }
  } catch { /* ignore */ }
}

async function testProvider(pr: any) {
  testingProvider.value = pr.providerCode
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/ai-providers/${pr.providerCode}/test`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const d = await res.json()
    if (d.success) {
      pr.credentialStatus = d.data?.credentialStatus
      alert(`Provider ${pr.name}: ${statusLabel(d.data?.credentialStatus)}` + (d.data?.detail?.error ? ' — ' + d.data.detail.error : ''))
    }
  } catch (e: any) { alert('测试失败: ' + e.message) }
  testingProvider.value = ''
  await loadAiProviders()
}

async function toggleProviderReg(pr: any) {
  try {
    const token = getToken()
    await fetch(`/api/admin/ai-providers/${pr.providerCode}/toggle`, { method: 'PATCH', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    await loadAiProviders()
  } catch { /* ignore */ }
}

async function deleteProvider(pr: any) {
  if (!confirm(`确定删除 Provider ${pr.name}？`)) return
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/ai-providers/${pr.providerCode}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const d = await res.json()
    if (!d.success) { alert(d.error || '删除失败') } else { await loadAiProviders() }
  } catch (e: any) { alert('删除失败: ' + e.message) }
}

async function createProvider() {
  if (!newProvider.providerCode || !newProvider.name) { alert('请填写 providerCode 和名称'); return }
  try {
    const token = getToken()
    const res = await fetch('/api/admin/ai-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...newProvider }),
    })
    const d = await res.json()
    if (!d.success) { alert(d.error || '创建失败') } else { addProviderDialog.value = false; newProvider.providerCode = ''; newProvider.name = ''; newProvider.endpoint = ''; await loadAiProviders() }
  } catch (e: any) { alert('创建失败: ' + e.message) }
}

// ─── T02: 平台默认模型 ───
async function loadDefaultModels() {
  try {
    const token = getToken()
    const res = await fetch('/api/admin/platform-default-models', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const d = await res.json()
    if (d.success) {
      defaultModels.value = (d.data || []).map((dm: any) => ({
        ...dm,
        form: { provider: dm.config?.provider || '', model: dm.config?.model || '' },
        msg: '', msgErr: false,
      }))
    }
  } catch { /* ignore */ }
}

async function saveDefaultModel(dm: any) {
  savingDefault.value = dm.stage
  dm.msg = ''
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/platform-default-models/${dm.stage}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ provider: dm.form.provider, model: dm.form.model }),
    })
    const d = await res.json()
    if (d.success) { dm.msg = '✅ 已保存'; dm.config = { ...dm.config, provider: dm.form.provider, model: dm.form.model, enabled: true } }
    else { dm.msg = '❌ ' + (d.error || '保存失败'); dm.msgErr = true }
  } catch (e: any) { dm.msg = '❌ ' + e.message; dm.msgErr = true }
  savingDefault.value = ''
  setTimeout(() => { dm.msg = '' }, 3000)
}

async function testDefaultModel(dm: any) {
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/platform-default-models/${dm.stage}/test`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const d = await res.json()
    if (d.success) { dm.msg = d.data?.ok ? `✅ ${d.data.model} 连通 (${d.data.latency}ms)` : `❌ ${d.data?.error || '失败'}`; dm.msgErr = !d.data?.ok }
    else { dm.msg = '❌ ' + (d.error || '失败'); dm.msgErr = true }
    setTimeout(() => { dm.msg = '' }, 4000)
  } catch (e: any) { alert('测试失败: ' + e.message) }
}

// ─── T02: 调用统计 ───
async function loadUsageStats() {
  try {
    const token = getToken()
    const h = token ? { Authorization: `Bearer ${token}` } : {}
    const [s, m, a] = await Promise.all([
      fetch(`/api/admin/usage/stats?days=${usageDays.value}`, { headers: h }).then(r => r.json()),
      fetch(`/api/admin/usage/stats/by-model?days=${usageDays.value}`, { headers: h }).then(r => r.json()),
      fetch(`/api/admin/usage/stats/by-agent?days=${usageDays.value}`, { headers: h }).then(r => r.json()),
    ])
    if (s.success) { usageSummary.value = s.data?.summary || null; usageTrend.value = s.data?.trend || [] }
    if (m.success) usageByModel.value = m.data || []
    if (a.success) usageByAgent.value = a.data || []
  } catch { /* ignore */ }
}

function switchTab(id: string) {
  tab.value = id as any
  if (id === 'providers' && aiProviders.value.length === 0) loadAiProviders()
  if (id === 'defaults') { loadDefaultModels(); if (aiProviders.value.length === 0) loadAiProviders() }
  if (id === 'usage') loadUsageStats()
  if (id === 'models') fetchData()
}

// ─── Sprint-06A: 业务 AI 模型配置 ───
const savingBusinessType = ref(false)
const businessTypeMsg = ref('')
const businessTypeMsgErr = ref(false)
const businessTypes = reactive([
  { key: 'career_advisor', icon: '🎯', label: '求职顾问', config: { provider: 'deepseek', model: '', apiKey: '', baseUrl: '', hasApiKey: false } },
  { key: 'music', icon: '🎵', label: '音乐', config: { provider: 'deepseek', model: '', apiKey: '', baseUrl: '', hasApiKey: false } },
])

async function loadBusinessTypeConfig() {
  try {
    const token = getToken()
    for (const bt of businessTypes) {
      const res = await fetch(`/api/admin/global-config/business-type/${bt.key}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      const d = await res.json()
      if (d.success && d.config) {
        bt.config.provider = d.config.provider || 'deepseek'
        bt.config.model = d.config.model || ''
        bt.config.hasApiKey = !!d.config.hasApiKey
        bt.config.apiKey = ''
        bt.config.baseUrl = ''
      }
    }
  } catch { /* ignore */ }
}

async function saveBusinessTypeConfig() {
  savingBusinessType.value = true
  businessTypeMsg.value = ''
  businessTypeMsgErr.value = false
  try {
    const token = getToken()
    for (const bt of businessTypes) {
      const res = await fetch(`/api/admin/global-config/business-type/${bt.key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider: bt.config.provider,
          model: bt.config.model,
          apiKey: bt.config.apiKey,
          baseUrl: bt.config.baseUrl,
        })
      })
      const d = await res.json()
      if (!d.success) {
        businessTypeMsg.value = `❌ ${bt.label}: ${d.error || '保存失败'}`
        businessTypeMsgErr.value = true
        savingBusinessType.value = false
        return
      }
      // 更新 hasApiKey 状态
      bt.config.hasApiKey = d.config?.hasApiKey || false
      bt.config.apiKey = ''
    }
    businessTypeMsg.value = '✅ 业务 AI 模型配置已保存'
    businessTypeMsgErr.value = false
  } catch (e: any) {
    businessTypeMsg.value = '❌ ' + e.message
    businessTypeMsgErr.value = true
  }
  savingBusinessType.value = false
  setTimeout(() => { businessTypeMsg.value = '' }, 3000)
}

function maskValue(val: string): string {
  if (!val) return ''
  if (val.length <= 4) return '****' + val
  return '****' + val.slice(-4)
}

const providerKeys = reactive([
  { provider: 'aliyun', label: '阿里百炼', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'volcengine', label: '火山引擎', key: '', display: '', show: false, editing: false, keyHint: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'siliconflow', label: '硅基流动', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'deepseek', label: 'DeepSeek', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'google', label: 'Google Gemini', key: '', display: '', show: false, editing: false, keyHint: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'anthropic', label: 'Anthropic Claude', key: '', display: '', show: false, editing: false, keyHint: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'xai', label: 'xAI Grok', key: '', display: '', show: false, editing: false, keyHint: 'xai-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'moonshot', label: '月之暗面 Moonshot', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'zhipu', label: '智谱 GLM', key: '', display: '', show: false, editing: false, keyHint: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { provider: 'openai', label: 'OpenAI ChatGPT', key: '', display: '', show: false, editing: false, keyHint: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
])

function toggleEdit(provKey: any) {
  provKey.editing = !provKey.editing
  if (provKey.editing) {
    provKey.display = provKey.key
  } else {
    // 取消：恢复掩码
    provKey.display = provKey.key ? maskValue(provKey.key) : ''
    provKey.show = false
  }
}

const modelTypes = [
  { key: 'llm', label: '语言模型' },
  { key: 'image', label: '图片模型' },
  { key: 'video', label: '视频模型' },
  { key: 'tts', label: '语音模型' },
]

const editDialog = reactive({
  visible: false,
  provider: '',
  modelType: '',
  models: [] as any[],
})

const PROVIDER_ICONS: Record<string, string> = {
  volcengine: '🔮',
  aliyun: '☁️',
  siliconflow: '💧',
  deepseek: '🧠',
  google: '🌀',
  anthropic: '🎭',
  xai: '🤖',
  moonshot: '🌙',
  zhipu: '📊',
  openai: '🤗',
}

function getProviderIcon(id: string): string { return PROVIDER_ICONS[id] || '🔌' }

function getProviderName(id: string): string {
  const p = providers.value.find(p => p.provider === id)
  return p?.providerName || id
}

function getModelTypeLabel(key: string): string {
  return modelTypes.find(t => t.key === key)?.label || key
}

function getModelCount(prov: any): number {
  if (prov.models && prov.models.length > 0) return prov.models.length
  let n = 0
  for (const k of ['llm', 'image', 'video', 'tts']) {
    if (prov.defaultParams?.models?.[k]) n += prov.defaultParams.models[k].length
  }
  return n
}

function getModelsForType(prov: any, type: string): any[] {
  if (prov.models) {
    return prov.models
      .filter((m: any) => m.type === type)
      .map((m: any) => ({ name: m.id, label: m.label || m.name || m.id, isActive: true }))
  }
  return prov.defaultParams?.models?.[type] || []
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/global-models', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const d = await res.json()
    if (d.success) {
      providers.value = d.providers || []
    } else {
      error.value = d.error || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  }
  loading.value = false
}

async function toggleProvider(p: any) {
  const prev = p.enabled
  p.enabled = !p.enabled
  try {
    const token = getToken()
    await fetch('/api/admin/global-models/toggle', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ provider: p.provider, enabled: p.enabled })
    })
  } catch {
    p.enabled = prev
  }
}

function showModelManager(prov: any, type: string) {
  editDialog.provider = prov.provider
  editDialog.modelType = type
  const srcModels = prov.models
    ? prov.models.filter((m: any) => m.type === type)
    : (prov.defaultParams?.models?.[type] || [])
  editDialog.models = srcModels.map((m: any) => ({
    name: m.name || m.id,
    label: m.label || m.name || m.id,
    checked: m.isActive !== false,
  }))
  editDialog.visible = true
}

function addModelInput() {
  const name = prompt('输入模型名称（如 qwen-max）')
  if (!name?.trim()) return
  const label = prompt('输入展示名称（可选，留空使用模型名）', name) || name
  editDialog.models.push({ name: name.trim(), label, checked: true })
}

function removeModel(idx: number) {
  editDialog.models.splice(idx, 1)
}

async function saveEditModels() {
  const prov = providers.value.find(p => p.provider === editDialog.provider)
  if (!prov) return

  if (!prov.defaultParams) prov.defaultParams = {}
  if (!prov.defaultParams.models) prov.defaultParams.models = {}

  prov.defaultParams.models[editDialog.modelType] = editDialog.models.map(m => ({
    name: m.name,
    label: m.label,
    isActive: m.checked,
  }))

  try {
    const token = getToken()
    const res = await fetch('/api/admin/global-models/save-models', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        provider: editDialog.provider,
        models: prov.defaultParams.models,
      })
    })
    const d = await res.json()
    if (d.success) {
      editDialog.visible = false
    } else {
      alert('保存失败: ' + (d.error || '未知错误'))
    }
  } catch (e: any) {
    alert('保存失败: ' + e.message)
  }
}

async function syncAll() {
  syncing.value = true
  try {
    const token = getToken()
    const res = await fetch('/api/admin/global-models/sync-aliyun', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: '{}'
    })
    const d = await res.json()
    if (d.success) {
      await fetchData()
    } else {
      alert('同步失败: ' + (d.error || '未知错误'))
    }
  } catch (e: any) {
    alert('同步失败: ' + e.message)
  }
  syncing.value = false
}

async function loadKeys() {
  try {
    const token = getToken()
    if (!token) return
    const res = await fetch('/api/admin/api-keys', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const d = await res.json()
    if (d.success && d.keys) {
      for (const pk of providerKeys) {
        const found = d.keys.find((x: any) => x.provider === pk.provider)
        if (found) {
          const rawKey = found.keyValue?.replace(/[*]/g, '') || ''
          pk.key = rawKey
          // 显示掩码版本
          pk.display = rawKey ? maskValue(rawKey) : ''
        }
      }
    }
  } catch (e) {
    // silently ignore
  }
}

async function saveKeys() {
  savingKeys.value = true
  keyMsg.value = ""
  keyMsgErr.value = false
  try {
    const token = getToken()
    if (!token) return
    for (const pk of providerKeys) {
      // 在编辑状态时，sync display back to key
      if (pk.editing) {
        pk.key = pk.display
      }
      if (!pk.key) continue
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: pk.provider, keyName: pk.provider + "_api_key", keyValue: pk.key })
      })
      const d = await res.json()
      if (!d.success) {
        keyMsg.value = "❌ " + pk.label + ": " + (d.error || "保存失败")
        keyMsgErr.value = true
        savingKeys.value = false
        return
      }
    }
    keyMsg.value = "✅ API Key 已保存（仅用于同步模型列表，不会泄露给用户）"
    keyMsgErr.value = false
    // 保存成功后重置编辑状态，显示掩码
    providerKeys.forEach(pk => {
      pk.show = false
      pk.editing = false
      pk.display = pk.key ? maskValue(pk.key) : ''
    })
  } catch (e: any) {
    keyMsg.value = "❌ " + e.message
    keyMsgErr.value = true
  }
  savingKeys.value = false
  setTimeout(() => { keyMsg.value = "" }, 3000)
}
onMounted(() => {
  loadAiProviders()
  fetchData()
  loadKeys()
  loadBusinessTypeConfig()
  loadDefaultModels()
  loadUsageStats()
})
</script>
