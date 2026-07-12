<template>
  <div class="space-y-6">
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">{{ error }}</div>

    <template v-else>
      <!-- 首页推荐 -->
      <div>
        <h3 class="text-xs text-white/60 font-medium mb-3">首页推荐</h3>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-[#1A2240] text-gray-500">
                <th class="text-left px-4 py-3 font-medium">排序</th>
                <th class="text-left px-4 py-3 font-medium">商品</th>
                <th class="text-left px-4 py-3 font-medium">售价</th>
                <th class="text-left px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in recommended" :key="p.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
                <td class="px-4 py-3 text-gray-500">{{ p.sort }}</td>
                <td class="px-4 py-3 text-white/80">{{ p.name }}</td>
                <td class="px-4 py-3 text-gray-400">¥{{ p.price }}</td>
                <td class="px-4 py-3">
                  <button @click="$emit('toggleRecommend', p)"
                    class="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-[10px] hover:bg-yellow-500/30 transition cursor-pointer border-none">
                    取消推荐
                  </button>
                </td>
              </tr>
              <tr v-if="recommended.length === 0">
                <td colspan="4" class="px-4 py-8 text-center text-gray-600">暂无推荐商品<br>请在商品管理中设置推荐</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 热门推荐 -->
      <div>
        <h3 class="text-xs text-white/60 font-medium mb-3">新品推荐</h3>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-[#1A2240] text-gray-500">
                <th class="text-left px-4 py-3 font-medium">排序</th>
                <th class="text-left px-4 py-3 font-medium">商品</th>
                <th class="text-left px-4 py-3 font-medium">售价</th>
                <th class="text-left px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in newProducts" :key="p.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
                <td class="px-4 py-3 text-gray-500">{{ p.sort }}</td>
                <td class="px-4 py-3 text-white/80">{{ p.name }}</td>
                <td class="px-4 py-3 text-gray-400">¥{{ p.price }}</td>
                <td class="px-4 py-3">
                  <button @click="$emit('toggleNew', p)"
                    class="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-[10px] hover:bg-blue-500/30 transition cursor-pointer border-none">
                    取消新品
                  </button>
                </td>
              </tr>
              <tr v-if="newProducts.length === 0">
                <td colspan="4" class="px-4 py-8 text-center text-gray-600">暂无新品<br>请在商品管理中设置新品</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  loading: boolean
  error: string
  products: any[]
}>()

defineEmits<{
  toggleRecommend: [p: any]
  toggleNew: [p: any]
}>()

const recommended = computed(() => props.products.filter((p: any) => p.isRecommend))
const newProducts = computed(() => props.products.filter((p: any) => p.isNew))
</script>
