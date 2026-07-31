<!-- ============================================================
Runtime Console — DEPRECATED（SPRINT-ADMIN-CLEANUP-02-FIX）
============================================================
历史：AI Runtime Readiness Dashboard（Hermes/Worker 执行监控 +
Provider 池管理 + Recovery Queue）。
废弃原因（Reality Gate 审计）：
  1. 消费的 3 组 API 全部从未挂载（死路由）：
     - /api/runtime/summary            → credential-lifecycle 路由群 0 注册
     - /api/runtime/recovery/errors    → credential-lifecycle 路由群 0 注册
     - /api/admin/platform-runtime/*   → 路由 0 注册 + platform_provider_config 表不存在
  2. Hybrid AI Runtime 架构从未落地（表未建），无真实数据源
  3. 功能已被数据罗盘第八层「AI 基础设施」取代（Provider/Token/成本/系统健康）
替代：/admin/dashboard（数据罗盘）
本页保留为迁移提示页，禁止恢复 API 请求；如需重建 Hybrid Runtime，先建表再挂路由。
============================================================ -->

<template>
  <div class="space-y-6">
    <!-- ===== 迁移提示横幅 ===== -->
    <div class="px-4 py-3 rounded-xl flex items-center gap-3 border bg-amber-900/20 border-amber-700/40">
      <span class="text-lg">⚠️</span>
      <div>
        <p class="text-sm font-medium text-amber-300">Runtime Console 已废弃，迁移至数据罗盘</p>
        <p class="text-xs opacity-70 mt-0.5 text-amber-200/70">
          本页消费的 Runtime API 从未挂载（credential-lifecycle 路由群 0 注册、platform_provider_config 表不存在），
          AI 基础设施数据（Provider / Token / 成本 / 系统健康）已由数据罗盘第八层提供。
        </p>
      </div>
    </div>

    <!-- ===== 迁移入口 ===== -->
    <div class="rounded-xl p-8 border border-white/[0.06] bg-white/[0.02] text-center">
      <span class="text-4xl">📊</span>
      <h2 class="text-sm text-white/80 font-medium mt-3">前往数据罗盘查看 AI 基础设施</h2>
      <p class="text-[11px] text-gray-500 mt-1">Provider 排行 · Token 用量 · 成本统计 · 系统健康（DB/Redis/队列/API/模型/COS）</p>
      <NuxtLink
        to="/admin/dashboard"
        class="inline-block mt-4 px-4 py-2 rounded-lg text-[11px] bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/30 transition no-underline"
      >→ 打开数据罗盘</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
// DEPRECATED：本页不再发起任何 API 请求（原 8 处 Runtime API 调用全部移除）
definePageMeta({ layout: 'admin-aigc' })
</script>
