<!--
  @deprecated — GEO v3 Legacy Workspace
  Product Shell v1: 此组件已不再作为导航入口。
  所有非 workspace-v1 panel 的请求自动重定向到 GeoWorkspaceV1。
  保留代码不删除，但仅通过 v1.5 Tab 系统或 URL 直接访问。
-->
<template>
  <GeoWorkspaceV1 />
</template>

<script setup lang="ts">
/**
 * GEO Product Shell v1 — 唯一入口收口
 *
 * BrandGEOWorkspace (v3 Legacy) 现在只作为 GeoWorkspaceV1 的透传壳。
 * 所有 panel-based 路由（brands/dashboard/wizard/keyword 等）不再通过此组件导航。
 * 用户访问 /workspace/geo 时，始终渲染 GeoWorkspaceV1。
 *
 * 历史 panel 参数会被忽略，如需访问旧功能，后续应迁移到 v1.5 Tab 系统。
 */
import GeoWorkspaceV1 from '~/legacy/brand-geo-v2/GeoWorkspaceV1.vue'
console.warn('[GEO] BrandGEOWorkspace (v3) is deprecated. All traffic redirected to GeoWorkspaceV1 (v1.5).')
</script>
