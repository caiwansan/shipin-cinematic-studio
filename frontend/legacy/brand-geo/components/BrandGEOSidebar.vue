<!--
  @deprecated — GEO v3 Legacy Sidebar
  Product Shell v1: 侧栏已弃用，仅保留返回首页入口。
  旧版导航全部移除，用户通过 GeoWorkspaceV1 v1.5 Tab 系统操作。
-->
<template>
  <aside class="geo-sidebar">
    <a href="/" class="geo-brand-logo" title="返回首页">
      <span class="geo-brand-icon">🌐</span>
      <span class="geo-brand-name">品牌GEO</span>
    </a>

    <nav class="geo-sidebar-nav">
      <div class="text-xs text-gray-500 px-4 py-6 text-center">
        Product Shell v1
      </div>
    </nav>

    <div class="geo-sidebar-footer">
      <div class="geo-sidebar-footer-card" @click="goHome">
        <span class="geo-footer-icon">🏠</span>
        <span class="geo-footer-label">返回首页</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
function goHome() {
  window.location.href = '/'
}
</script>

<style scoped>
.geo-sidebar {
  width: 220px;
  min-width: 220px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: #0a0a12;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.geo-brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 16px 14px;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.geo-brand-logo:hover { opacity: 0.85; }
.geo-brand-icon { font-size: 24px; }
.geo-brand-name {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 1px;
}

.geo-sidebar-nav {
  flex: 1;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.geo-sidebar-footer {
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geo-sidebar-footer-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  color: #6b7280;
  font-size: 12px;
}
.geo-sidebar-footer-card:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #9ca3af;
}
.geo-footer-icon { font-size: 14px; }
.geo-footer-label { font-weight: 500; }
</style>
