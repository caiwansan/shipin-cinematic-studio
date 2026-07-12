<!-- DiscoveryEmptyState.vue — 无品牌引导 -->
<template>
  <section class="geo-d-empty">
    <div class="geo-d-empty__card">
      <div class="geo-d-empty__icon">🔬</div>
      <h2 class="geo-d-empty__title">还没有品牌</h2>
      <p class="geo-d-empty__desc">
        创建一个品牌，系统会自动扫描该品牌在 AI 世界中的可见性、
        发现优化机会，并指导您完成 Knowledge 构建和优化。
      </p>
      <div class="geo-d-empty__actions">
        <NuxtLink to="/workspace/geo/brand/create" class="geo-d-empty__btn geo-d-empty__btn--primary">
          + 创建品牌
        </NuxtLink>
        <NuxtLink to="/workspace/geo/dashboard" class="geo-d-empty__btn">
          ← 返回工作台
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.geo-d-empty {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.geo-d-empty__card {
  text-align: center;
  max-width: 460px;
  padding: 48px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.geo-d-empty__icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.geo-d-empty__title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 8px;
}

.geo-d-empty__desc {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  margin: 0 0 24px;
}

.geo-d-empty__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.geo-d-empty__btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid #e2e8f0;
  color: #1a1a2e;
  transition: background .15s, border-color .15s;
}

.geo-d-empty__btn:hover {
  background: #f8fafc;
  border-color: #3b82f6;
}

.geo-d-empty__btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.geo-d-empty__btn--primary:hover {
  background: #2563eb;
}
</style>
