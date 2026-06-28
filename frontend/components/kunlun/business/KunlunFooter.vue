<template>
  <footer class="kunlun-footer">
    <div class="footer-row">
      <div class="footer-brand">
        <span class="footer-logo-icon">
          <img src="/logo.png" alt="昆仑镜" class="footer-logo-img" />
        </span>
        <span class="footer-logo-text">昆仑镜</span>
      </div>
      <div class="footer-links">
        <a href="https://aigc.fushtn.com" target="_blank">aigc.fushtn.com</a>
      </div>
    </div>
    <div class="footer-divider" />
    <div class="footer-legal">
      <span>豫ICP备2025152782号-2 ｜ 增值电信业务经营许可证：豫B2-20260120</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
/**
 * KunlunFooter — 昆仑镜首页 Footer
 *
 * 层级：L4 business
 * 用途：品牌信息 + ICP 备案 + 链接
 */
</script>

<style scoped>
.kunlun-footer {
  position: relative;
  z-index: 2;
  padding: 32px 24px;
  background: rgba(8, 19, 31, 0.8);
  border-top: 1px solid rgba(248, 246, 241, 0.06);
}

.footer-row {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-logo-icon {
  display: flex;
  align-items: center;
}

.footer-logo-img {
  height: 28px;
  width: auto;
}

.footer-logo-text {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.8);
}

.footer-links {
  display: flex;
  gap: 20px;
}

.footer-links a {
  color: rgba(248, 246, 241, 0.4);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.3s ease;
}

.footer-links a:hover {
  color: rgba(248, 246, 241, 0.7);
}

.footer-divider {
  max-width: 1100px;
  margin: 20px auto 16px;
  height: 1px;
  background: rgba(248, 246, 241, 0.06);
}

.footer-legal {
  max-width: 1100px;
  margin: 0 auto;
  text-align: center;
}

.footer-legal span {
  font-size: 0.75rem;
  color: rgba(248, 246, 241, 0.25);
}
</style>
