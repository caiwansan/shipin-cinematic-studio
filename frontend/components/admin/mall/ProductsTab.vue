<template>
  <div class="space-y-4">
    <!-- 搜索 + 新增 -->
    <div class="flex items-center justify-between">
      <div class="flex gap-2">
        <input v-model="localSearch" type="text" placeholder="搜索商品名称..."
          class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none focus:border-blue-500/50 w-52"
          @keyup.enter="$emit('search')" />
        <button @click="$emit('search')"
          class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">搜索</button>
      </div>
      <button @click="$emit('openCreate')"
        class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
        + 新增商品
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="$emit('search')" class="ml-2 underline">重试</button>
    </div>

    <!-- Table -->
    <template v-else>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-[#1A2240] text-gray-500">
              <th class="text-left px-4 py-3 font-medium">名称</th>
              <th class="text-left px-4 py-3 font-medium">分类</th>
              <th class="text-left px-4 py-3 font-medium">原价</th>
              <th class="text-left px-4 py-3 font-medium">售价</th>
              <th class="text-left px-4 py-3 font-medium">库存</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">推荐</th>
              <th class="text-left px-4 py-3 font-medium">新品</th>
              <th class="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 text-white/80">{{ p.name }}</td>
              <td class="px-4 py-3 text-gray-400">{{ p.category?.name || '—' }}</td>
              <td class="px-4 py-3 text-gray-400">{{ p.originalPrice ? '¥' + p.originalPrice : '—' }}</td>
              <td class="px-4 py-3 text-white/90">¥{{ p.price }}</td>
              <td class="px-4 py-3 text-gray-400">{{ p.stock }}</td>
              <td class="px-4 py-3">
                <button @click="$emit('toggleActive', p)"
                  class="px-2 py-0.5 rounded-full text-[10px] border-none cursor-pointer"
                  :class="p.isActive ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ p.isActive ? '上架' : '下架' }}
                </button>
              </td>
              <td class="px-4 py-3">
                <button @click="$emit('toggleRecommend', p)"
                  class="px-2 py-0.5 rounded-full text-[10px] border-none cursor-pointer"
                  :class="p.isRecommend ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ p.isRecommend ? '是' : '否' }}
                </button>
              </td>
              <td class="px-4 py-3">
                <button @click="$emit('toggleNew', p)"
                  class="px-2 py-0.5 rounded-full text-[10px] border-none cursor-pointer"
                  :class="p.isNew ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ p.isNew ? '是' : '否' }}
                </button>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1.5">
                  <button @click="$emit('openEdit', p)"
                    class="px-2 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] hover:bg-blue-600/30 transition cursor-pointer border-none">编辑</button>
                  <button @click="$emit('delete', p)"
                    class="px-2 py-1 bg-red-600/20 text-red-400 rounded-lg text-[10px] hover:bg-red-600/30 transition cursor-pointer border-none">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="products.length === 0">
              <td colspan="9" class="px-4 py-12 text-center text-gray-600">暂无商品</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between text-[10px] text-gray-600">
        <span>共 {{ total }} 件商品，第 {{ page }}/{{ totalPages }} 页</span>
        <div class="flex gap-2">
          <button @click="$emit('prevPage')" :disabled="page <= 1"
            class="px-3 py-1 rounded border border-[#1A2240] text-gray-500 hover:text-white/70 disabled:opacity-30 cursor-pointer disabled:cursor-default bg-transparent text-[11px]">上一页</button>
          <button @click="$emit('nextPage')" :disabled="page >= totalPages"
            class="px-3 py-1 rounded border border-[#1A2240] text-gray-500 hover:text-white/70 disabled:opacity-30 cursor-pointer disabled:cursor-default bg-transparent text-[11px]">下一页</button>
        </div>
      </div>
    </template>

    <!-- Product Form Modal -->
    <Transition name="modal-fade">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="$emit('closeForm')">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[620px] max-h-[90vh] overflow-y-auto shadow-2xl">
          <h3 class="text-sm text-white/80 font-medium mb-4">{{ editing ? '编辑商品' : '新增商品' }}</h3>
          <div class="space-y-4">
            <!-- 基本信息 -->
            <div>
              <div class="text-[10px] text-gray-500 uppercase mb-2">基本信息</div>
              <div class="space-y-3">
                <div>
                  <label class="text-[10px] text-gray-500 block mb-1">商品名称 *</label>
                  <input v-model="form.name" type="text" placeholder="商品名称"
                    class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">副标题</label>
                    <input v-model="form.subtitle" type="text" placeholder="副标题"
                      class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">分类</label>
                    <select v-model="form.categoryId"
                      class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
                      <option value="">无分类</option>
                      <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                    </select>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">原价</label>
                    <input v-model.number="form.originalPrice" type="number" min="0" step="0.01"
                      class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">售价 *</label>
                    <input v-model.number="form.price" type="number" min="0" step="0.01"
                      class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <label class="text-[10px] text-gray-500 block mb-1">库存</label>
                    <input v-model.number="form.stock" type="number" min="0"
                      class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 商品主图（封面 + 轮播图集） -->
            <div>
              <div class="text-[10px] text-gray-500 uppercase mb-2">商品主图</div>
              <!-- 封面图 -->
              <div class="mb-3">
                <label class="text-[10px] text-gray-500 block mb-1">封面图</label>
                <div class="flex items-center gap-3">
                  <div class="w-16 h-16 bg-[#0B1020] border border-[#1A2240] rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                    <img v-if="form.cover" :src="form.cover" class="w-full h-full object-cover" alt="封面" />
                    <span v-else class="text-gray-600 text-[10px]">无</span>
                  </div>
                  <div class="flex-1">
                    <div v-if="uploadingCover" class="text-[10px] text-yellow-400/60">上传中...</div>
                    <label v-else class="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      上传封面
                      <input ref="coverInputRef" type="file" accept="image/*" class="hidden" @change="uploadCover" />
                    </label>
                    <button v-if="form.cover" @click="form.cover = ''" class="ml-2 text-[10px] text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer">清除</button>
                  </div>
                </div>
              </div>
              <!-- 轮播图集 -->
              <div>
                <label class="text-[10px] text-gray-500 block mb-1">轮播图集 <span class="text-gray-600">（支持多张）</span></label>
                <div class="flex flex-wrap gap-2 mb-2">
                  <div v-for="(img, idx) in imageList" :key="idx" class="relative group w-16 h-16 bg-[#0B1020] border border-[#1A2240] rounded-lg overflow-hidden">
                    <img :src="img" class="w-full h-full object-cover" alt="" />
                    <button @click="removeImage(idx)"
                      class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600/80 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer border-none">×</button>
                  </div>
                  <label class="w-16 h-16 bg-[#0B1020] border border-dashed border-[#1A2240] rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500/50 transition"
                    :class="{ 'opacity-50 pointer-events-none': uploadingImages }">
                    <svg v-if="!uploadingImages" class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    <span v-else class="text-[9px] text-yellow-400/60">上传中</span>
                    <input type="file" accept="image/*" class="hidden" @change="uploadImages" />
                  </label>
                </div>
              </div>
            </div>

            <!-- 图文详情 -->
            <div>
              <div class="text-[10px] text-gray-500 uppercase mb-2">图文详情</div>
              <div class="flex flex-wrap gap-2 mb-2">
                <div v-for="(img, idx) in detailImages" :key="'d'+idx" class="relative group w-24 h-24 bg-[#0B1020] border border-[#1A2240] rounded-lg overflow-hidden">
                  <img :src="img" class="w-full h-full object-cover" alt="" />
                  <button @click="removeDetailImage(idx)"
                    class="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600/80 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer border-none">×</button>
                </div>
                <label class="w-24 h-24 bg-[#0B1020] border border-dashed border-[#1A2240] rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500/50 transition"
                  :class="{ 'opacity-50 pointer-events-none': uploadingDetail }">
                  <svg v-if="!uploadingDetail" class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  <span v-else class="text-[9px] text-yellow-400/60">上传中</span>
                  <input type="file" accept="image/*" class="hidden" @change="uploadDetailImage" />
                </label>
              </div>
            </div>

            <!-- 标记 + 排序 -->
            <div>
              <div class="text-[10px] text-gray-500 uppercase mb-2">标记与排序</div>
              <div class="grid grid-cols-3 gap-3">
                <label class="flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" v-model="form.isRecommend" class="accent-blue-500" />
                  推荐商品
                </label>
                <label class="flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" v-model="form.isNew" class="accent-blue-500" />
                  新品
                </label>
                <div>
                  <input v-model.number="form.sort" type="number" min="0" placeholder="排序"
                    class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
                </div>
              </div>
            </div>

            <div class="flex gap-2 justify-end pt-2 border-t border-[#1A2240]">
              <button @click="$emit('closeForm')"
                class="px-4 py-1.5 text-[11px] text-gray-400 hover:text-white/70 border border-[#1A2240] rounded-lg bg-transparent cursor-pointer">取消</button>
              <button @click="handleSave"
                class="px-4 py-1.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer border-none" :disabled="uploadingCover || uploadingImages || uploadingDetail">保存</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getToken } from '~/utils/token-cache'

const props = defineProps<{
  loading: boolean
  error: string
  products: any[]
  total: number
  page: number
  totalPages: number
  searchQuery: string
  categories: any[]
  showForm: boolean
  editing: any
}>()

const emit = defineEmits<{
  search: []
  prevPage: []
  nextPage: []
  openCreate: []
  openEdit: [p: any]
  save: []
  delete: [p: any]
  toggleActive: [p: any]
  toggleRecommend: [p: any]
  toggleNew: [p: any]
  closeForm: []
}>()

const localSearch = defineModel<string>('searchQuery')
const form = defineModel<any>('form')

// ─── 图片上传 ───
const coverInputRef = ref<HTMLInputElement | null>(null)
const uploadingCover = ref(false)
const uploadingImages = ref(false)
const uploadingDetail = ref(false)

async function uploadFile(file: File, token?: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const tk = token || getToken()
  console.log('[uploadFile] token:', tk ? tk.substring(0, 20) + '...' : 'EMPTY')
  const res = await fetch('/api/v1/upload/local', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tk}` },
    body: fd,
  })
  const data = await res.json()
  const url = data.url || data.data?.url
  if (!url) throw new Error('上传失败')
  return url
}

async function uploadCover(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.[0]) return
  uploadingCover.value = true
  const token = getToken()
  console.log('[uploadCover] token:', token ? token.substring(0, 20) + '...' : 'EMPTY')
  try {
    form.value.cover = await uploadFile(input.files[0], token)
  } catch {
    // ignore
  } finally {
    uploadingCover.value = false
    input.value = ''
  }
}

async function uploadImages(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  uploadingImages.value = true
  try {
    const urls: string[] = []
    for (const file of Array.from(input.files)) {
      urls.push(await uploadFile(file))
    }
    const current = imageList.value
    imageList.value = [...current, ...urls]
  } catch {
    // ignore
  } finally {
    uploadingImages.value = false
    input.value = ''
  }
}

async function uploadDetailImage(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.[0]) return
  uploadingDetail.value = true
  try {
    const url = await uploadFile(input.files[0])
    const current = detailImages.value
    detailImages.value = [...current, url]
  } catch {
    // ignore
  } finally {
    uploadingDetail.value = false
    input.value = ''
  }
}

// ─── 图片列表管理 ───
const imageList = computed({
  get: () => {
    const raw = form.value.images
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch { return [] }
    }
    return []
  },
  set: (val) => { form.value.images = val },
})

function removeImage(idx: number) {
  const list = imageList.value.filter((_: any, i: number) => i !== idx)
  imageList.value = list
}

const detailImages = computed({
  get: () => {
    const raw = form.value.detail
    if (!raw) return []
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      } catch {
        const urls = raw.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp|bmp)/gi)
        return urls || []
      }
    }
    return []
  },
  set: (val) => {
    form.value.detail = JSON.stringify(val)
  },
})

function removeDetailImage(idx: number) {
  const list = detailImages.value.filter((_: any, i: number) => i !== idx)
  detailImages.value = list
}

function handleSave() {
  emit('save')
}
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
