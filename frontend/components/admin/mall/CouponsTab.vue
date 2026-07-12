<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-xs text-white/60 font-medium">优惠券列表</h3>
      <button @click="$emit('openCreate')"
        class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
        + 新增优惠券
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">{{ error }}</div>

    <template v-else>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-[#1A2240] text-gray-500">
              <th class="text-left px-4 py-3 font-medium">名称</th>
              <th class="text-left px-4 py-3 font-medium">类型</th>
              <th class="text-left px-4 py-3 font-medium">面值</th>
              <th class="text-left px-4 py-3 font-medium">最低消费</th>
              <th class="text-left px-4 py-3 font-medium">每人限领</th>
              <th class="text-left px-4 py-3 font-medium">已领/总量</th>
              <th class="text-left px-4 py-3 font-medium">有效期</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in coupons" :key="c.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 text-white/80">{{ c.name }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="c.type === 'discount' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'">
                  {{ c.type === 'discount' ? '折扣券' : c.type === 'cash' ? '代金券' : c.type === 'full_reduce' ? '满减券' : c.type }}
                </span>
              </td>
              <td class="px-4 py-3 text-white/90">
                {{ c.type === 'discount' ? c.value + '折' : '¥' + c.value }}
              </td>
              <td class="px-4 py-3 text-gray-400">¥{{ c.minAmount || 0 }}</td>
              <td class="px-4 py-3 text-gray-400">{{ c.maxPerUser || 1 }}</td>
              <td class="px-4 py-3 text-gray-400">{{ c._count?.userCoupons || 0 }}/{{ c.totalCount || '不限' }}</td>
              <td class="px-4 py-3 text-gray-400 text-[10px]">
                <template v-if="c.startAt || c.endAt">
                  {{ c.startAt ? formatDate(c.startAt) : '不限' }} ~ {{ c.endAt ? formatDate(c.endAt) : '不限' }}
                </template>
                <span v-else class="text-gray-600">长期有效</span>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="c.isActive ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ c.isActive ? '启用' : '停用' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1.5">
                  <button @click="$emit('openEdit', c)"
                    class="px-2 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] hover:bg-blue-600/30 transition cursor-pointer border-none">编辑</button>
                  <button @click="$emit('delete', c)"
                    class="px-2 py-1 bg-red-600/20 text-red-400 rounded-lg text-[10px] hover:bg-red-600/30 transition cursor-pointer border-none">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="coupons.length === 0">
              <td colspan="9" class="px-4 py-12 text-center text-gray-600">暂无优惠券</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Coupon Form Modal -->
    <Transition name="modal-fade">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="$emit('closeForm')">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[480px] shadow-2xl">
          <h3 class="text-sm text-white/80 font-medium mb-4">{{ editing ? '编辑优惠券' : '新增优惠券' }}</h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">名称 *</label>
              <input v-model="form.name" type="text" placeholder="优惠券名称"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">类型 *</label>
                <select v-model="form.type"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                  <option value="discount">折扣券</option>
                  <option value="cash">代金券</option>
                  <option value="full_reduce">满减券</option>
                </select>
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">面值 *</label>
                <input v-model.number="form.value" type="number" min="0" step="0.01"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50"
                  :placeholder="form.type === 'discount' ? '如 9.5' : '如 10'" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">最低消费</label>
                <input v-model.number="form.minAmount" type="number" min="0"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">每人限领</label>
                <input v-model.number="form.maxPerUser" type="number" min="1"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">发行总量</label>
                <input v-model.number="form.totalCount" type="number" min="0" placeholder="0=不限"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">开始时间</label>
                <input v-model="form.startAt" type="datetime-local"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">结束时间</label>
                <input v-model="form.endAt" type="datetime-local"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              </div>
            </div>
            <div class="flex gap-2 justify-end pt-2">
              <button @click="$emit('closeForm')"
                class="px-4 py-1.5 text-[11px] text-gray-400 hover:text-white/70 border border-[#1A2240] rounded-lg bg-transparent cursor-pointer">取消</button>
              <button @click="$emit('save')"
                class="px-4 py-1.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer border-none">保存</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean
  error: string
  coupons: any[]
  showForm: boolean
  editing: any
  form: any
}>()

defineEmits<{
  openCreate: []
  openEdit: [c: any]
  save: []
  delete: [c: any]
  closeForm: []
}>()

function formatDate(d: string | Date) {
  if (!d) return ''
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
