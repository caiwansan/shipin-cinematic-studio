<template>
  <div class="space-y-6">
    <!-- 顶部导航 tab -->
    <div class="flex items-center gap-1 border-b border-[#1A2240] pb-0">
      <button v-for="t in tabs" :key="t.id"
        @click="activeTab = t.id"
        class="px-4 py-2 text-xs transition cursor-pointer border-b-2"
        :class="activeTab === t.id ? 'text-blue-400 border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'">
        {{ t.label }}
      </button>
    </div>

    <!-- Tab: 代理商列表 -->
    <div v-if="activeTab === 'agents'">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm text-white/70 font-medium">代理商列表</h2>
        <button @click="openCreate"
          class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
          + 新增代理
        </button>
      </div>

      <div v-if="loadingAgents" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

      <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
        {{ error }}
        <button @click="fetchAgents" class="ml-2 underline">重试</button>
      </div>

      <template v-else>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-[#1A2240] text-gray-500">
                <th class="text-left px-4 py-3 font-medium">代理名称</th>
                <th class="text-left px-4 py-3 font-medium">类型</th>
                <th class="text-left px-4 py-3 font-medium">管辖区域</th>
                <th class="text-left px-4 py-3 font-medium">联系人</th>

                <th class="text-left px-4 py-3 font-medium">佣金比例</th>
                <th class="text-left px-4 py-3 font-medium">推广用户</th>
                <th class="text-left px-4 py-3 font-medium">累计佣金</th>
                <th class="text-left px-4 py-3 font-medium">待结算</th>
                <th class="text-left px-4 py-3 font-medium">已结算</th>
                <th class="text-left px-4 py-3 font-medium">状态</th>
                <th class="text-left px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in agents" :key="a.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
                <td class="px-4 py-3 text-white/80 font-medium">{{ a.name }}</td>
                <td class="px-4 py-3">
                  <span class="text-[10px] px-1.5 py-0.5 rounded"
                    :class="a.agentType === 'city' ? 'bg-purple-500/10 text-purple-400' : a.agentType === 'district' ? 'bg-orange-500/10 text-orange-400' : 'bg-gray-500/10 text-gray-400'">
                    {{ a.agentType === 'city' ? '市级' : a.agentType === 'district' ? '区县' : '普通' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-gray-400 text-[10px]">{{ a.regionName || '-' }}</td>
                <td class="px-4 py-3 text-gray-400">{{ a.contactPerson }}</td>

                <td class="px-4 py-3 text-blue-400">{{ a.commissionRate }}%</td>
                <td class="px-4 py-3 text-gray-400">{{ a.referredUsers }}</td>
                <td class="px-4 py-3 text-gray-300">¥{{ a.totalCommission.toFixed(2) }}</td>
                <td class="px-4 py-3 text-yellow-400">¥{{ a.pendingCommission.toFixed(2) }}</td>
                <td class="px-4 py-3 text-green-400">¥{{ a.settledCommission.toFixed(2) }}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px]"
                    :class="a.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                    {{ a.status === 'active' ? '正常' : '冻结' }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <button @click="openEdit(a)" class="text-blue-400 hover:text-blue-300 text-[10px] mr-2">编辑</button>
                  <button @click="viewMembers(a)" class="text-[10px] text-cyan-400 hover:text-cyan-300 mr-2 border-none cursor-pointer">旗下会员</button>
                  <button @click="deleteAgent(a)" class="text-[10px] text-red-400 hover:text-red-300 mr-2 border-none cursor-pointer">删除</button>
                  <button @click="toggleStatus(a)" class="text-[10px] transition cursor-pointer border-none mr-2"
                    :class="a.status === 'active' ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'">
                    {{ a.status === 'active' ? '冻结' : '解冻' }}
                  </button>
                </td>
              </tr>
              <tr v-if="agents.length === 0">
                <td colspan="11" class="px-4 py-12 text-center text-gray-600">暂无代理</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="text-[10px] text-gray-600 mt-2">共 {{ agents.length }} 个代理商</div>
      </template>
    </div>
    <!-- Tab: 佣金订单 -->
    <div v-if="activeTab === 'orders'">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm text-white/70 font-medium">佣金订单明细</h2>
        <div class="flex gap-2">
          <select v-model="orderFilter.agentId" @change="fetchOrders"
            class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-2 py-1 text-[10px] text-white/60 outline-none">
            <option value="">全部代理</option>
            <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <select v-model="orderFilter.status" @change="fetchOrders"
            class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-2 py-1 text-[10px] text-white/60 outline-none">
            <option value="">全部状态</option>
            <option value="pending">待结算</option>
            <option value="settled">已结算</option>
          </select>
          <button @click="batchSettle" :disabled="selectedOrders.length === 0"
            class="px-3 py-1 rounded-lg text-[10px] transition cursor-pointer border-none disabled:opacity-40"
            :class="selectedOrders.length > 0 ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-gray-600/20 text-gray-500'">
            批量结算 ({{ selectedOrders.length }})
          </button>
        </div>
      </div>

      <div v-if="loadingOrders" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

      <template v-else>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-[#1A2240] text-gray-500">
                <th class="px-3 py-3 w-8"><input type="checkbox" @change="toggleSelectAll" :checked="allSelected" class="accent-blue-500" /></th>
                <th class="text-left px-3 py-3 font-medium">代理ID</th>
                <th class="text-left px-3 py-3 font-medium">用户ID</th>
                <th class="text-left px-3 py-3 font-medium">订单金额</th>
                <th class="text-left px-3 py-3 font-medium">佣金比例</th>
                <th class="text-left px-3 py-3 font-medium">佣金金额</th>
                <th class="text-left px-3 py-3 font-medium">状态</th>
                <th class="text-left px-3 py-3 font-medium">备注</th>
                <th class="text-left px-3 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in orders" :key="o.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
                <td class="px-3 py-3">
                  <input type="checkbox" :checked="selectedOrders.includes(o.id)"
                    @change="toggleOrder(o.id)" class="accent-blue-500" :disabled="o.status === 'settled'" />
                </td>
                <td class="px-3 py-3 text-gray-500 text-[10px]">{{ o.agentId.substring(0,8) }}...</td>
                <td class="px-3 py-3 text-gray-500 text-[10px]">{{ o.userId.substring(0,8) }}...</td>
                <td class="px-3 py-3 text-gray-300">¥{{ o.orderAmount.toFixed(2) }}</td>
                <td class="px-3 py-3 text-gray-400">{{ o.commissionRate }}%</td>
                <td class="px-3 py-3 text-green-400">¥{{ o.commissionAmount.toFixed(2) }}</td>
                <td class="px-3 py-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px]"
                    :class="o.status === 'settled' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'">
                    {{ o.status === 'settled' ? '已结算' : '待结算' }}
                  </span>
                </td>
                <td class="px-3 py-3 text-gray-500 text-[10px]">{{ o.remark || '—' }}</td>
                <td class="px-3 py-3 text-gray-500 text-[10px]">{{ formatDate(o.createdAt) }}</td>
              </tr>
              <tr v-if="orders.length === 0">
                <td colspan="9" class="px-4 py-12 text-center text-gray-600">暂无佣金记录</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="text-[10px] text-gray-600 mt-2">共 {{ orders.length }} 条记录</div>
      </template>
    </div>

    <!-- Tab: 代理套餐 -->
    <div v-if="activeTab === 'plans'">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm text-white/70 font-medium">代理套餐管理</h2>
        <button @click="showPlanDialog = true; editPlanId = ''; Object.assign(planForm, { level:'', name:'', price:0, months:12, commissionRate:10, benefits:'[]', icon:'⭐', color:'#6366f1', sortOrder:0, enabled:true })"
          class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
          + 新增套餐
        </button>
      </div>

      <div v-if="loadingPlans" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

      <template v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="p in plans" :key="p.id"
            class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ p.icon }}</span>
                <span class="text-sm text-white/80 font-medium">{{ p.name }}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full" :class="p.enabled ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ p.enabled ? '上架' : '下架' }}
                </span>
              </div>
              <div class="flex gap-1">
                <button @click="editPlan(p)" class="text-blue-400 hover:text-blue-300 text-[10px] border-none cursor-pointer bg-transparent">编辑</button>
                <button @click="deletePlan(p)" class="text-red-400 hover:text-red-300 text-[10px] border-none cursor-pointer bg-transparent">删除</button>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span class="text-gray-500">价格</span>
                <div class="text-blue-400 font-semibold">¥{{ p.price }}</div>
              </div>
              <div>
                <span class="text-gray-500">有效期</span>
                <div class="text-white/70">{{ p.months }} 个月</div>
              </div>
              <div>
                <span class="text-gray-500">佣金比例</span>
                <div class="text-green-400">{{ p.commissionRate }}%</div>
              </div>
            </div>
            <div class="mt-2">
              <span class="text-[10px] text-gray-500">权益：</span>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-for="(b, i) in parseBenefits(p.benefits)" :key="i" class="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">{{ b }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="text-[10px] text-gray-600 mt-2">共 {{ plans.length }} 个套餐</div>
      </template>
    </div>

    <!-- Tab: 提现审核 -->
    <div v-if="activeTab === 'withdraws'">
      <h2 class="text-sm text-white/70 font-medium mb-4">提现审核</h2>
      <div v-if="loadingWithdraws" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>
      <template v-else>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-[#1A2240] text-gray-500">
                <th class="text-left px-3 py-3 font-medium">用户</th>
                <th class="text-left px-3 py-3 font-medium">金额</th>
                <th class="text-left px-3 py-3 font-medium">收款方式</th>
                <th class="text-left px-3 py-3 font-medium">收款人</th>
                <th class="text-left px-3 py-3 font-medium">收款码</th>
                <th class="text-left px-3 py-3 font-medium">状态</th>
                <th class="text-left px-3 py-3 font-medium">申请时间</th>
                <th class="text-left px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in withdraws" :key="w.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
                <td class="px-3 py-3 text-gray-400 text-[10px]">{{ w.username || w.userId?.substring(0,8) || '—' }}</td>
                <td class="px-3 py-3 text-blue-400 font-medium">¥{{ Number(w.amount).toFixed(2) }}</td>
                <td class="px-3 py-3 text-gray-400 text-[10px]">
                  {{ w.accountType === 'alipay' ? '支付宝' : w.accountType === 'wechat' ? '微信' : w.accountType || '—' }}
                </td>
                <td class="px-3 py-3 text-gray-400 text-[10px]">{{ w.accountName || '—' }}</td>
                <td class="px-3 py-3">
                  <img v-if="w.qrCodeUrl" :src="w.qrCodeUrl" class="qr-thumb-xs cursor-pointer" @click="previewQrCode = w.qrCodeUrl" />
                  <span v-else class="text-gray-600 text-[10px]">—</span>
                </td>
                <td class="px-3 py-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px]" :class="{
                    'bg-yellow-500/10 text-yellow-400': w.status === 'pending',
                    'bg-green-500/10 text-green-400': w.status === 'approved',
                    'bg-red-500/10 text-red-400': w.status === 'rejected',
                  }">
                    {{ w.status === 'pending' ? '待审核' : w.status === 'approved' ? '已通过' : '已拒绝' }}
                  </span>
                </td>
                <td class="px-3 py-3 text-gray-500 text-[10px]">{{ formatDate(w.createdAt) }}</td>
                <td class="px-3 py-3">
                  <div v-if="w.status === 'pending'" class="flex gap-1">
                    <button @click="approveWithdraw(w)" class="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] hover:bg-green-500/30 border-none cursor-pointer">通过</button>
                    <button @click="rejectWithdraw(w)" class="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] hover:bg-red-500/30 border-none cursor-pointer">拒绝</button>
                  </div>
                  <span v-else class="text-gray-600 text-[10px]">已处理</span>
                </td>
              </tr>
              <tr v-if="withdraws.length === 0">
                <td colspan="8" class="px-4 py-12 text-center text-gray-600">暂无提现申请</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <!-- 收款码大图预览 -->
      <div v-if="previewQrCode" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click.self="previewQrCode = ''">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-6 max-w-lg w-full mx-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-white/80 font-medium text-sm">收款码</h3>
            <button @click="previewQrCode = ''" class="text-gray-500 hover:text-white text-lg border-none cursor-pointer bg-transparent">✕</button>
          </div>
          <img :src="previewQrCode" class="w-full rounded-lg" />
        </div>
      </div>
    </div>
    <div v-if="showPlanDialog" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      @click.self="showPlanDialog = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-md mx-4">
        <div class="text-sm text-white/80 font-medium mb-4">{{ editPlanId ? '编辑套餐' : '新增套餐' }}</div>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">标识 (level) *</label>
              <input v-model="planForm.level" :disabled="!!editPlanId" type="text" placeholder="senior"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">名称</label>
              <input v-model="planForm.name" type="text" placeholder="高级代理商"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">价格 (元)</label>
              <input v-model.number="planForm.price" type="number" step="0.01" min="0"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">有效期(月)</label>
              <input v-model.number="planForm.months" type="number" min="1"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">佣金比例(%)</label>
              <input v-model.number="planForm.commissionRate" type="number" step="0.1" min="0" max="100"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">权益（回车换行，每条一行）</label>
            <textarea v-model="planBenefitsText" rows="4" placeholder="月交易量≥30个视频
月交易量≥50000元
享受最高佣金比例"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 resize-none"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">图标 emoji</label>
              <input v-model="planForm.icon" type="text"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">颜色值</label>
              <input v-model="planForm.color" type="text" placeholder="#818cf8"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" v-model="planForm.enabled" class="accent-blue-500" />
            <span class="text-[10px] text-gray-500">启用（上架）</span>
          </div>
        </div>
        <div v-if="planError" class="text-red-400 text-[10px] mt-2">{{ planError }}</div>
        <div class="flex gap-2 mt-4">
          <button @click="savePlan" :disabled="savingPlan"
            class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50 border-none">
            {{ savingPlan ? '保存中...' : '保存' }}
          </button>
          <button @click="showPlanDialog = false"
            class="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer border-none">
            取消
          </button>
        </div>
      </div>
    </div>


    <!-- 新增/编辑弹窗（卡片式：先选会员再建代理） -->
    <div v-if="showDialog" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      @click.self="showDialog = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div class="text-sm text-white/80 font-medium mb-4">{{ isEditing ? '编辑代理' : '新增代理商' }}</div>

        <!-- 选择会员 -->
        <div class="mb-4">
          <label class="text-[10px] text-gray-500 block mb-1.5">选择会员 <span class="text-red-400">*</span></label>
          <div class="relative">
            <input v-model="memberSearch" @input="debounceSearchMember" type="text" placeholder="输入会员昵称或手机号搜索..."
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            <!-- 搜索加载 -->
            <div v-if="searchingMember" class="absolute right-3 top-2.5">
              <span class="text-gray-500 text-[10px]">搜索中...</span>
            </div>
          </div>

          <!-- 搜索结果列表 -->
          <div v-if="memberSearchResults.length > 0" class="mt-2 bg-[#0B1020] border border-[#1A2240] rounded-lg max-h-40 overflow-y-auto">
            <div v-for="m in memberSearchResults" :key="m.id" @click="selectMember(m)"
              class="px-3 py-2 text-xs text-white/70 hover:bg-blue-500/10 cursor-pointer border-b border-[#1A2240]/50 last:border-0 flex items-center justify-between">
              <div>
                <span class="text-white/90">{{ m.username || '未命名' }}</span>
                <span v-if="m.phone" class="text-gray-500 ml-2">{{ m.phone }}</span>
              </div>
              <span class="text-[10px] text-gray-600">{{ m.email || '—' }}</span>
            </div>
          </div>
          <div v-else-if="memberSearch && !searchingMember" class="mt-2 text-[10px] text-gray-600">
            未找到匹配的会员，请输入昵称或手机号搜索
          </div>

          <!-- 已选会员 -->
          <div v-if="selectedMember" class="mt-2 bg-blue-500/5 border border-blue-500/20 rounded-lg p-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-blue-400 text-xs">✓</span>
              <div>
                <span class="text-white/90 text-xs">{{ selectedMember.username || '未命名' }}</span>
                <span v-if="selectedMember.phone" class="text-gray-500 text-[10px] ml-2">{{ selectedMember.phone }}</span>
              </div>
            </div>
            <button @click="clearSelectedMember" class="text-gray-500 hover:text-red-400 text-[10px] border-none cursor-pointer bg-transparent">取消选择</button>
          </div>
        </div>

        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">代理名称 *</label>
              <input v-model="form.name" type="text" placeholder="公司/团队名称"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">代理类型 *</label>
              <select v-model="form.agentType" @change="onAgentTypeChange"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                <option value="city">🏙️ 市级代理</option>
                <option value="district">🏘️ 区县级代理</option>
              </select>
            </div>
          </div>

          <!-- 管辖区域（市级/区县级代理必选） -->
          <div class="region-fields">
            <label class="text-[10px] text-gray-500 block mb-1">
              管辖区域
            </label>
            <div class="grid grid-cols-3 gap-2">
              <select v-model="form.regionProvince" @change="onAgentProvinceChange" 
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                <option value="">省份</option>
                <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }}</option>
              </select>
              <select v-model="form.regionCity" @change="onAgentCityChange" 
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                <option value="">城市</option>
                <option v-for="c in agentCities" :key="c.code" :value="c.code">{{ c.name }}</option>
              </select>
              <select v-if="form.agentType === 'district'" v-model="form.regionDistrict" @change="onAgentDistrictChange"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                <option value="">区县</option>
                <option v-for="d in agentDistricts" :key="d.code" :value="d.code">{{ d.name }}</option>
              </select>
            </div>
            <div v-if="form.regionName" class="text-[10px] text-blue-400 mt-1">
              已选区域：{{ form.regionName }}
            </div>
          </div>

          <!-- 联系人信息 -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">联系人</label>
              <input v-model="form.contactPerson" type="text" placeholder="姓名"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">联系电话</label>
              <input v-model="form.phone" type="text" placeholder="手机号"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
          </div>

          <div>
            <label class="text-[10px] text-gray-500 block mb-1">佣金比例 (%)</label>
            <div class="flex items-center gap-2">
              <input v-model.number="form.commissionRate" type="number" step="0.1" min="0" max="100"
                class="w-28 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              <span class="text-gray-500 text-[10px]">%</span>
            </div>
          </div>

          <div>
            <label class="text-[10px] text-gray-500 block mb-1">结算周期</label>
            <select v-model="form.settlementCycle"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
              <option value="monthly">月结</option>
              <option value="quarterly">季结</option>
              <option value="yearly">年结</option>
            </select>
          </div>

          <div class="border-t border-[#1A2240] pt-3 mt-1">
            <div class="text-[10px] text-gray-500 mb-2">银行信息（可选）</div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">开户行</label>
                <input v-model="form.bankName" type="text" placeholder="银行名称"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">户名</label>
                <input v-model="form.accountName" type="text" placeholder="持卡人"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              </div>
            </div>
            <div class="mt-3">
              <label class="text-[10px] text-gray-500 block mb-1">银行账号</label>
              <input v-model="form.bankAccount" type="text" placeholder="银行卡号"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
          </div>

          <div>
            <label class="text-[10px] text-gray-500 block mb-1">备注</label>
            <textarea v-model="form.remark" rows="2" placeholder="备注信息"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50 resize-none" />
          </div>
        </div>
        <div v-if="formError" class="text-red-400 text-[10px] mt-2">{{ formError }}</div>
        <div class="flex gap-2 mt-4">
          <button @click="saveAgent" :disabled="saving"
            class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50 border-none">
            {{ saving ? '保存中...' : (isEditing ? '保存修改' : '创建代理商') }}
          </button>
          <button @click="showDialog = false"
            class="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer border-none">
            取消
          </button>
        </div>
      </div>
    </div>
    <!-- 旗下会员弹窗 -->
    <div v-if="memberDialog.visible" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      @click.self="closeMembers">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <div>
            <span class="text-sm text-white/80 font-medium">{{ memberDialog.agentName }}</span>
            <span class="text-[11px] text-gray-500 ml-2">旗下会员 ({{ memberDialog.members.length }})</span>
          </div>
          <button @click="closeMembers"
            class="text-gray-500 hover:text-white text-sm border-none cursor-pointer bg-transparent">✕</button>
        </div>

        <div v-if="memberDialog.loading" class="flex items-center justify-center py-12 text-gray-500 text-sm">加载中...</div>

        <template v-else-if="memberDialog.members.length === 0">
          <div class="text-center py-12 text-gray-600 text-xs">暂无旗下会员</div>
        </template>

        <template v-else>
          <div class="bg-[#0A0F1E]/60 border border-[#1A2240] rounded-xl overflow-hidden">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-[#1A2240] text-gray-500">
                  <th class="text-left px-3 py-2.5 font-medium">用户名</th>
                  <th class="text-left px-3 py-2.5 font-medium">邮箱</th>
                  <th class="text-left px-3 py-2.5 font-medium">VIP</th>
                  <th class="text-left px-3 py-2.5 font-medium">到期时间</th>
                  <th class="text-left px-3 py-2.5 font-medium">积分</th>
                  <th class="text-left px-3 py-2.5 font-medium">累计消费</th>
                  <th class="text-left px-3 py-2.5 font-medium">注册时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in memberDialog.members" :key="m.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
                  <td class="px-3 py-2.5 text-white/80">{{ m.username }}</td>
                  <td class="px-3 py-2.5 text-gray-400">{{ m.email || '—' }}</td>
                  <td class="px-3 py-2.5">
                    <span v-if="m.isVip" class="px-2 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-400">已开通</span>
                    <span v-else class="px-2 py-0.5 rounded-full text-[10px] bg-gray-500/10 text-gray-500">未开通</span>
                  </td>
                  <td class="px-3 py-2.5 text-gray-500 text-[10px]">{{ m.memberExpiresAt ? formatDate(m.memberExpiresAt) : '—' }}</td>
                  <td class="px-3 py-2.5 text-gray-400">{{ m.coins || 0 }}</td>
                  <td class="px-3 py-2.5 text-cyan-400">
                    ¥{{ memberDialog.orderAmountMap[m.id] ? memberDialog.orderAmountMap[m.id].toFixed(2) : '0.00' }}
                  </td>
                  <td class="px-3 py-2.5 text-gray-500 text-[10px]">{{ formatDate(m.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, reactive, computed, watch, onMounted } from 'vue'

const tabs = [
  { id: 'agents', label: '👥 代理商列表' },
  { id: 'orders', label: '📋 佣金订单' },
  { id: 'plans', label: '🎯 代理套餐' },
  { id: 'withdraws', label: '💰 提现审核' },
]
const activeTab = ref('agents')

// ---- 统计概览 ----




// ---- 代理商 CRUD ----
const loadingAgents = ref(true)
const error = ref('')
const agents = ref<any[]>([])
const showDialog = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const saving = ref(false)
const formError = ref('')

// 会员搜索
const memberSearch = ref('')
const memberSearchResults = ref<any[]>([])
const selectedMember = ref<any>(null)
const searchingMember = ref(false)

let searchTimer: any = null
function debounceSearchMember() {
  clearTimeout(searchTimer)
  if (!memberSearch.value.trim()) {
    memberSearchResults.value = []
    return
  }
  searchingMember.value = true
  searchTimer = setTimeout(async () => {
    try {
      const token = getToken()
      const res = await fetch(`/api/admin/members?search=${encodeURIComponent(memberSearch.value.trim())}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const d = await res.json()
        memberSearchResults.value = (d.data || []).filter((u: any) => u.id).slice(0, 10)
      }
    } catch {}
    searchingMember.value = false
  }, 300)
}

function selectMember(m: any) {
  selectedMember.value = m
  memberSearch.value = ''
  memberSearchResults.value = []
  // 自动填入联系人信息
  if (!form.contactPerson) form.contactPerson = m.username || ''
  if (!form.phone) form.phone = m.phone || ''
}

function clearSelectedMember() {
  selectedMember.value = null
}
const form = reactive({
  name: '', contactPerson: '', phone: '', email: '',
  commissionRate: 10, settlementCycle: 'monthly',
  bankName: '', bankAccount: '', accountName: '', remark: '',
  agentType: 'city',
  regionProvince: '', regionCity: '', regionDistrict: '',
  regionCode: '', regionName: '',
})

// 区域级联
const provinces = ref<any[]>([])
const agentCities = ref<any[]>([])
const agentDistricts = ref<any[]>([])
const regionNameMap = ref<Record<string, string>>({})

async function fetchRegions(parentCode?: string) {
  try {
    const url = parentCode ? `/api/regions?parentCode=${parentCode}` : '/api/regions'
    const res = await fetch(url)
    const d = await res.json()
    return d.data || []
  } catch { return [] }
}

async function loadProvinces() {
  provinces.value = await fetchRegions()
  provinces.value.forEach((p: any) => { regionNameMap.value[p.code] = p.name })
}

function onAgentTypeChange() {
  form.regionProvince = ''
  form.regionCity = ''
  form.regionDistrict = ''
  form.regionCode = ''
  form.regionName = ''
  agentCities.value = []
  agentDistricts.value = []
}

function onAgentProvinceChange() {
  form.regionCity = ''
  form.regionDistrict = ''
  form.regionCode = ''
  form.regionName = ''
  agentCities.value = []
  agentDistricts.value = []
  if (form.regionProvince) {
    fetchRegions(form.regionProvince).then(data => {
      agentCities.value = data
      data.forEach((c: any) => { regionNameMap.value[c.code] = c.name })
    })
  }
}

function onAgentCityChange() {
  form.regionDistrict = ''
  form.regionCode = ''
  form.regionName = ''
  agentDistricts.value = []
  if (form.regionCity) {
    if (form.agentType === 'city') {
      // 市级代理：regionCode=城市代码
      form.regionCode = form.regionCity
      form.regionName = regionNameMap.value[form.regionProvince] + ' ' + regionNameMap.value[form.regionCity]
    } else {
      fetchRegions(form.regionCity).then(data => {
        agentDistricts.value = data
        data.forEach((d: any) => { regionNameMap.value[d.code] = d.name })
      })
    }
  }
}

function onAgentDistrictChange() {
  if (form.regionDistrict) {
    form.regionCode = form.regionDistrict
    form.regionName = (regionNameMap.value[form.regionProvince] || '') + ' ' + (regionNameMap.value[form.regionCity] || '') + ' ' + (regionNameMap.value[form.regionDistrict] || '')
  }
}

function updateRegionFromDistrict() {
  if (form.agentType === 'district' && form.regionDistrict) {
    form.regionCode = form.regionDistrict
    form.regionName = (regionNameMap.value[form.regionProvince] || '') + ' ' + (regionNameMap.value[form.regionCity] || '') + ' ' + (regionNameMap.value[form.regionDistrict] || '')
  }
}

// 监听区县选择
watch(() => form.regionDistrict, () => {
  updateRegionFromDistrict()
})



async function fetchAgents() {
  loadingAgents.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/market-agents', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      agents.value = d.data || []
    } else {
      error.value = `请求失败: HTTP ${res.status}`
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  }
  loadingAgents.value = false
}

function openCreate() {
  isEditing.value = false
  editingId.value = ''
  selectedMember.value = null
  memberSearch.value = ''
  memberSearchResults.value = []
  Object.assign(form, {
    name: '', contactPerson: '', phone: '', email: '',
    commissionRate: 10, settlementCycle: 'monthly',
    bankName: '', bankAccount: '', accountName: '', remark: '',
    agentType: 'city',
    regionProvince: '', regionCity: '', regionDistrict: '',
    regionCode: '', regionName: '',
  })
  formError.value = ''
  showDialog.value = true
  loadProvinces()
}

function openEdit(a: any) {
  isEditing.value = true
  editingId.value = a.id
  selectedMember.value = a.userId ? { id: a.userId, username: a.username || '', phone: a.phone || '', email: a.email || '' } : null
  memberSearch.value = ''
  memberSearchResults.value = []
  Object.assign(form, {
    name: a.name,
    contactPerson: a.contactPerson || '',
    phone: a.phone || '',
    email: a.email || '',
    commissionRate: a.commissionRate || 0,
    settlementCycle: a.settlementCycle || 'monthly',
    bankName: a.bankName || '',
    bankAccount: a.bankAccount || '',
    accountName: a.accountName || '',
    remark: a.remark || '',
    agentType: a.agentType || 'city',
    regionProvince: '',
    regionCity: '',
    regionDistrict: '',
    regionCode: a.regionCode || '',
    regionName: a.regionName || '',
  })
  formError.value = ''
  // 加载省份列表后尝试还原区域选择
  loadProvinces().then(() => {
    const code = a.regionCode
    if (code && a.agentType) {
      if (a.agentType === 'city' && code.length >= 4) {
        form.regionProvince = code.substring(0, 2)
        onAgentProvinceChange()
        setTimeout(() => {
          form.regionCity = code
          onAgentCityChange()
        }, 200)
      } else if (a.agentType === 'district' && code.length >= 6) {
        form.regionProvince = code.substring(0, 2)
        onAgentProvinceChange()
        setTimeout(() => {
          form.regionCity = code.substring(0, 4)
          onAgentCityChange()
          setTimeout(() => {
            form.regionDistrict = code
            updateRegionFromDistrict()
          }, 200)
        }, 200)
      }
    }
  })
  showDialog.value = true
}

async function saveAgent() {
  if (!form.name) {
    formError.value = '代理名称不能为空'
    return
  }
  if (!isEditing && !selectedMember.value) {
    formError.value = '请先选择会员'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const token = getToken()
    const url = isEditing.value
      ? `/api/admin/market-agents/${editingId.value}`
      : '/api/admin/market-agents'
    const body: any = {
      name: form.name,
      contactPerson: form.contactPerson,
      phone: form.phone,
      email: form.email,
      commissionRate: form.commissionRate,
      settlementCycle: form.settlementCycle,
      bankName: form.bankName,
      bankAccount: form.bankAccount,
      accountName: form.accountName,
      remark: form.remark,
      agentType: form.agentType,
      regionCode: form.regionCode || '',
      regionName: form.regionName || '',
    }
    // 传 userId 同步到会员中心（新增或编辑时都允许绑定/更换会员）
    if (selectedMember.value) {
      body.userId = selectedMember.value.id
    }
    const res = await fetch(url, {
      method: isEditing.value ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      showDialog.value = false
      await fetchAgents()
    } else {
      const d = await res.json().catch(() => ({}))
      formError.value = d.error || '保存失败'
    }
  } catch (e: any) {
    formError.value = e.message || '网络错误'
  }
  saving.value = false
}

// ---- 代理套餐 ----
const loadingPlans = ref(true)
const plans = ref<any[]>([])
const showPlanDialog = ref(false)
const editPlanId = ref('')
const savingPlan = ref(false)
const planError = ref('')
const planForm = reactive({
  level: '', name: '', price: 0, months: 12, commissionRate: 10,
  benefits: '[]', icon: '⭐', color: '#6366f1', sortOrder: 0, enabled: true,
})
const planBenefitsText = computed({
  get: () => {
    try { return JSON.parse(planForm.benefits).join('\n') } catch { return planForm.benefits }
  },
  set: (val: string) => {
    const lines = val.split('\n').filter(l => l.trim())
    planForm.benefits = JSON.stringify(lines)
  }
})

function parseBenefits(b: string): string[] {
  try { return JSON.parse(b) } catch { return [] }
}

async function fetchPlans() {
  loadingPlans.value = true
  try {
    const token = getToken()
    const res = await fetch('/api/admin/agent-plans', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      plans.value = d.data || []
    }
  } catch {}
  loadingPlans.value = false
}

function editPlan(p: any) {
  editPlanId.value = p.id
  Object.assign(planForm, {
    level: p.level,
    name: p.name,
    price: p.price,
    months: p.months,
    commissionRate: p.commissionRate,
    benefits: p.benefits || '[]',
    icon: p.icon || '⭐',
    color: p.color || '#6366f1',
    sortOrder: p.sortOrder || 0,
    enabled: p.enabled,
  })
  showPlanDialog.value = true
}

async function savePlan() {
  if (!planForm.name) { planError.value = '名称不能为空'; return }
  planError.value = ''
  savingPlan.value = true
  try {
    const token = getToken()
    const url = editPlanId.value ? `/api/admin/agent-plans/${editPlanId.value}` : '/api/admin/agent-plans'
    const res = await fetch(url, {
      method: editPlanId.value ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(planForm),
    })
    if (res.ok) {
      showPlanDialog.value = false
      await fetchPlans()
    } else {
      const errText = await res.text().catch(() => '')
      planError.value = `保存失败: ${errText}`
    }
  } catch { planError.value = '网络错误' }
  savingPlan.value = false
}

async function deletePlan(p: any) {
  if (!confirm(`确认删除套餐「${p.name}」？`)) return
  try {
    const token = getToken()
    await fetch(`/api/admin/agent-plans/${p.id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    await fetchPlans()
  } catch {}
}

// ---- 提现审核 ----
const loadingWithdraws = ref(true)
const withdraws = ref<any[]>([])
const previewQrCode = ref('')

async function fetchWithdraws() {
  loadingWithdraws.value = true
  try {
    const token = getToken()
    const res = await fetch('/api/admin/wallet/withdraws', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      withdraws.value = d.data?.items || []
    }
  } catch {}
  loadingWithdraws.value = false
}

async function approveWithdraw(w: any) {
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/wallet/withdraw/${w.id}/approve`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) { w.status = 'approved'; await fetchWithdraws() }
  } catch {}
}

async function rejectWithdraw(w: any) {
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/wallet/withdraw/${w.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ remark: '审核拒绝（管理员操作）' }),
    })
    if (res.ok) { w.status = 'rejected'; await fetchWithdraws() }
  } catch {}
}

// ---- 旗下会员弹窗 ----
const memberDialog = reactive({
  visible: false,
  loading: false,
  agentName: '',
  agentId: '',
  members: [] as any[],
  orderAmountMap: {} as Record<string, number>,
})

async function viewMembers(a: any) {
  memberDialog.agentName = a.name
  memberDialog.agentId = a.id
  memberDialog.visible = true
  memberDialog.loading = true
  memberDialog.members = []
  memberDialog.orderAmountMap = {}
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/market-agents/${a.id}/members`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      memberDialog.members = d.data || []
      // 计算每个用户的累计消费
      const map: Record<string, number> = {}
      for (const m of memberDialog.members) {
        const total = (m.orders || []).reduce((s: number, o: any) => s + o.orderAmount, 0)
        map[m.id] = total
      }
      memberDialog.orderAmountMap = map
    }
  } catch {}
  memberDialog.loading = false
}

function closeMembers() {
  memberDialog.visible = false
}

async function toggleStatus(a: any) {
  const newStatus = a.status === 'active' ? 'frozen' : 'active'
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/market-agents/${a.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      a.status = newStatus
    }
  } catch {}
}

async function deleteAgent(a: any) {
  if (!confirm(`确认删除代理「${a.name}」？删除后将同时清除该代理关联的会员代理身份。`)) return
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/market-agents/${a.id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      agents.value = agents.value.filter((x: any) => x.id !== a.id)
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || '删除失败')
    }
  } catch (e: any) {
    alert(e.message || '网络错误')
  }
}

// ---- 佣金配置 ----




// ---- 佣金订单明细 ----
const loadingOrders = ref(true)
const orders = ref<any[]>([])
const selectedOrders = ref<string[]>([])
const orderFilter = reactive({ agentId: '', status: '' })

const allSelected = computed(() =>
  orders.value.filter(o => o.status === 'pending').length > 0 &&
  orders.value.filter(o => o.status === 'pending').every(o => selectedOrders.value.includes(o.id))
)

function toggleOrder(id: string) {
  const idx = selectedOrders.value.indexOf(id)
  if (idx >= 0) selectedOrders.value.splice(idx, 1)
  else selectedOrders.value.push(id)
}

function toggleSelectAll() {
  const pending = orders.value.filter(o => o.status === 'pending')
  if (allSelected.value) {
    selectedOrders.value = selectedOrders.value.filter(id => !pending.some(o => o.id === id))
  } else {
    for (const o of pending) {
      if (!selectedOrders.value.includes(o.id)) selectedOrders.value.push(o.id)
    }
  }
}

async function fetchOrders() {
  loadingOrders.value = true
  try {
    const token = getToken()
    const params = new URLSearchParams()
    if (orderFilter.agentId) params.set('agentId', orderFilter.agentId)
    if (orderFilter.status) params.set('status', orderFilter.status)
    const res = await fetch(`/api/admin/commission-orders?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      orders.value = d.data || []
      selectedOrders.value = []
    }
  } catch {}
  loadingOrders.value = false
}

async function batchSettle() {
  if (selectedOrders.value.length === 0) return
  try {
    const token = getToken()
    const res = await fetch('/api/admin/commission-orders/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ ids: selectedOrders.value }),
    })
    if (res.ok) {
      await fetchOrders()
      await fetchAgents()
      await fetchSummary()
    }
  } catch {}
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

onMounted(async () => {
  await Promise.all([
    fetchAgents(),
    fetchOrders(),
    fetchPlans(),
    fetchWithdraws(),
    loadProvinces(),
  ])
})
</script>

<style scoped>
.level-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
}
/* 等级样式已简化，市级/县级通过 agentType 区分 */
</style>
