<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-xs text-white/60 font-medium">Banner 列表</h3>
      <button @click="$emit('openCreate')"
        class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
        + 新增 Banner
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
              <th class="text-left px-4 py-3 font-medium">图片</th>
              <th class="text-left px-4 py-3 font-medium">链接</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in banners" :key="b.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 text-gray-500">{{ b.sortOrder ?? b.sort }}</td>
              <td class="px-4 py-3">
                <img v-if="b.image || b.imageUrl" :src="b.image || b.imageUrl" class="h-8 w-14 object-cover rounded" alt="" />
                <span v-else class="text-gray-600">—</span>
              </td>
              <td class="px-4 py-3 text-gray-400 max-w-[200px] truncate">{{ b.link || b.linkValue || '—' }}</td>
              <td class="px-4 py-3">
                <button @click="$emit('toggleActive', b)"
                  class="px-2 py-0.5 rounded-full text-[10px] border-none cursor-pointer"
                  :class="b.isActive ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ b.isActive ? '启用' : '禁用' }}
                </button>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1.5">
                  <button @click="$emit('openEdit', b)"
                    class="px-2 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] hover:bg-blue-600/30 transition cursor-pointer border-none">编辑</button>
                  <button @click="$emit('delete', b)"
                    class="px-2 py-1 bg-red-600/20 text-red-400 rounded-lg text-[10px] hover:bg-red-600/30 transition cursor-pointer border-none">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="banners.length === 0">
              <td colspan="5" class="px-4 py-12 text-center text-gray-600">暂无 Banner</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Banner Form Modal -->
    <Transition name="modal-fade">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="$emit('closeForm')">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[480px] shadow-2xl">
          <h3 class="text-sm text-white/80 font-medium mb-4">{{ editing ? '编辑 Banner' : '新增 Banner' }}</h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">图片 *</label>
              <div v-if="form.image || form.imageUrl" class="relative mb-2">
                <img :src="form.image || form.imageUrl" class="h-20 w-full object-cover rounded-lg border border-[#1A2240]" alt="banner预览" />
                <button @click="form.image = ''; form.imageUrl = ''"
                  class="absolute top-1 right-1 bg-black/60 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center hover:bg-black/80 border-none cursor-pointer">✕</button>
              </div>
              <div class="flex gap-2">
                <input type="file" accept="image/*" @change="uploadBannerImage"
                  class="hidden" ref="bannerFileInput" />
                <button @click="($refs as any).bannerFileInput?.click()"
                  class="px-3 py-2 bg-[#0B1020] border border-dashed border-[#1A2240] rounded-lg text-[10px] text-gray-500 hover:text-white/70 hover:border-gray-500 transition cursor-pointer">
                  📤 选择图片上传
                </button>
                <div v-if="uploading" class="flex items-center text-[10px] text-yellow-400">
                  <span class="inline-block w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mr-1"></span>
                  上传中...
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">链接类型</label>
                <select v-model="form.linkType"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                  <option value="">无</option>
                  <option value="product">商品</option>
                  <option value="category">分类</option>
                  <option value="url">外部链接</option>
                </select>
              </div>
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">链接值</label>
                <input v-model="form.linkValue" type="text" placeholder="商品ID或URL"
                  class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
              </div>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">排序</label>
              <input v-model.number="form.sortOrder" type="number" min="0"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
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
import { ref } from 'vue'
import { getToken } from '~/utils/token-cache'
const props = defineProps<{
  loading: boolean
  error: string
  banners: any[]
  showForm: boolean
  editing: any
  form: any
}>()

defineEmits<{
  openCreate: []
  openEdit: [b: any]
  save: []
  delete: [b: any]
  toggleActive: [b: any]
  closeForm: []
}>()

const uploading = ref(false)

async function uploadBannerImage(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const file = input.files[0]
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', 'mall')
    const res = await fetch('/api/v1/upload/local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    })
    const data = await res.json()
    if (data.success) {
      const url = data.data?.url || data.data
      if (url) { props.form.image = url; props.form.imageUrl = url }
    }
  } catch (err) { console.error('上传失败', err) }
  finally { uploading.value = false }
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
