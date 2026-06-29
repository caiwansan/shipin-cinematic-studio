<template>
  <div class="geo-stub-panel">
    <div class="geo-stub-banner">
      ⚠️ Phase 2 Module — Backend Not Available
    </div>
    <div class="geo-stub-body">
      <div class="geo-stub-icon">🌐</div>
      <h3 class="geo-stub-title">网站扫描</h3>
      <p class="geo-stub-desc">
        网站扫描功能属于 GEO 产品扩展域，当前后端 API 未实现（Layer 3）。
        该模块已冻结，不会出现在 Sidebar 导航中。
      </p>
      <div class="geo-stub-meta">
        <span class="geo-stub-tag">Phase 2</span>
        <span class="geo-stub-tag">No API Contract</span>
        <span class="geo-stub-tag">Read-Only Stub</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// WebsiteScannerPage — Phase 2 Stub
// Backend not available. No API contract. UI disabled / read-only placeholder.
// Do NOT add store.fetch or onMounted logic here.
</script>

<style scoped>
.geo-stub-panel { padding: 24px; max-width: 600px; margin: 0 auto; }
.geo-stub-banner {
  padding: 8px 14px; border-radius: 6px;
  background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5; font-size: 12px; font-weight: 600; text-align: center;
  margin-bottom: 24px;
}
.geo-stub-body { text-align: center; padding: 48px 24px; }
.geo-stub-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
.geo-stub-title { font-size: 22px; font-weight: 700; color: #6b7280; margin: 0 0 12px; }
.geo-stub-desc { font-size: 14px; color: #4b5563; line-height: 1.6; max-width: 400px; margin: 0 auto 20px; }
.geo-stub-meta { display: flex; gap: 8px; justify-content: center; }
.geo-stub-tag {
  padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;
  background: rgba(107, 114, 128, 0.1); color: #6b7280; border: 1px solid rgba(107, 114, 128, 0.2);
}
</style>
