<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-xs text-white/60 font-medium">分类列表</h3>
      <button @click="$emit('openCreate')"
        class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
        + 新增分类
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">{{ error }}</div>

    <template v-else>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-[#1A2240] text-gray-500">
              <th class="text-left px-4 py-3 font-medium">排序</th>
              <th class="text-left px-4 py-3 font-medium">名称</th>
              <th class="text-left px-4 py-3 font-medium">商品数</th>
              <th class="text-left px-4 py-3 font-medium">可见</th>
              <th class="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in categories" :key="c.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 text-gray-500">{{ c.sort }}</td>
              <td class="px-4 py-3 text-white/80">{{ c.name }}</td>
              <td class="px-4 py-3 text-gray-400">{{ c._count?.products || 0 }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="c.visible ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ c.visible ? '可见' : '隐藏' }}
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
            <tr v-if="categories.length === 0">
              <td colspan="5" class="px-4 py-12 text-center text-gray-600">暂无分类</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Category Form Modal -->
    <Transition name="modal-fade">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="$emit('closeForm')">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[360px] shadow-2xl">
          <h3 class="text-sm text-white/80 font-medium mb-4">{{ editing ? '编辑分类' : '新增分类' }}</h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">名称 *</label>
              <input v-model="form.name" type="text" placeholder="分类名称"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">排序</label>
              <input v-model.number="form.sort" type="number" min="0"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <label class="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" v-model="form.visible" class="accent-blue-500" />
              前台可见
            </label>
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
  categories: any[]
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
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
