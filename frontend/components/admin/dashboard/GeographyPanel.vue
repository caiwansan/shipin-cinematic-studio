<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">🗺️ 用户区域分布</h3>
      <span class="text-[9px] text-gray-600">User Profile</span>
    </div>

    <div v-if="!data" class="text-center py-10 text-[10px] text-gray-600">加载中...</div>

    <!-- 无数据：显示「暂无地区信息」 -->
    <div v-else-if="data.provinces.length === 0" class="py-10 text-center">
      <div class="text-3xl mb-2">📍</div>
      <div class="text-[11px] text-gray-500">暂无地区信息</div>
      <div class="text-[9px] text-gray-700 mt-1">用户未完善省市区资料（共 {{ data.totalUsers }} 位用户，{{ data.withRegion }} 位有地区）</div>
    </div>

    <template v-else>
      <div class="text-[9px] text-gray-600 mb-3">
        共 {{ data.totalUsers }} 位用户，{{ data.withRegion }} 位已完善地区
      </div>
      <div class="space-y-2">
        <div v-for="(p, i) in data.provinces" :key="p.province"
          class="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <span class="text-[10px] text-white/70 flex-1 truncate">{{ p.province }}</span>
          <div class="w-28 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div class="h-full rounded-full" :style="{ width: p.pct + '%', background: barColor(i) }"></div>
          </div>
          <span class="text-[10px] text-white/80 font-mono w-10 text-right">{{ p.count }}</span>
          <span class="text-[9px] text-gray-500 font-mono w-10 text-right">{{ p.pct }}%</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{ data: any }>()
const barColor = (i: number) => ['linear-gradient(90deg,#60a5fa,#3b82f6)', 'linear-gradient(90deg,#34d399,#10b981)', 'linear-gradient(90deg,#a78bfa,#8b5cf6)', 'linear-gradient(90deg,#fbbf24,#f59e0b)', 'linear-gradient(90deg,#22d3ee,#06b6d4)'][i % 5]
</script>
