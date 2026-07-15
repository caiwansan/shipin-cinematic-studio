<template>
  <section class="enterprise-growth-banner">
    <div class="banner-inner">
      <div class="banner-content">
        <div class="banner-badge">🚀 企业 AI 增长部门</div>
        <h2 class="banner-title">给企业配置一支 7×24 工作的 AI 增长团队</h2>
        <p class="banner-desc">
          市场分析 · 内容运营 · 客户开发 · 销售支持<br/>
          已被验证：7 天产生 38 个销售线索，转化率 40%
        </p>
        <div class="banner-metrics">
          <div class="metric">
            <span class="metric-num">19</span>
            <span class="metric-label">篇内容</span>
          </div>
          <div class="metric">
            <span class="metric-num">95</span>
            <span class="metric-label">次互动</span>
          </div>
          <div class="metric highlight">
            <span class="metric-num">38</span>
            <span class="metric-label">销售线索</span>
          </div>
        </div>
        <NuxtLink to="/enterprise" class="banner-cta">
          立即体验 →
        </NuxtLink>
      </div>
      <div class="banner-visual">
        <div class="ai-team-preview">
          <div class="ai-member">🎯<br/>增长总监</div>
          <div class="ai-member">✍️<br/>内容经理</div>
          <div class="ai-member">📊<br/>市场分析师</div>
          <div class="ai-member">💬<br/>客户运营</div>
          <div class="ai-member">🤝<br/>销售助理</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// 企业AI增长部门首页横幅
</script>

<style scoped>
.enterprise-growth-banner {
  width: 100%;
  padding: 0 24px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
  border-top: 1px solid rgba(96, 165, 250, 0.1);
  border-bottom: 1px solid rgba(96, 165, 250, 0.1);
}
.banner-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 60px 0;
  display: flex;
  align-items: center;
  gap: 48px;
}
.banner-content { flex: 1; }
.banner-badge {
  display: inline-block;
  padding: 4px 14px;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 20px;
  font-size: 13px;
  color: rgba(96, 165, 250, 0.9);
  margin-bottom: 16px;
}
.banner-title {
  font-size: 32px;
  font-weight: bold;
  line-height: 1.3;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #e0e0e0, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.banner-desc {
  font-size: 16px;
  color: #aab;
  line-height: 1.7;
  margin-bottom: 24px;
}
.banner-metrics {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}
.metric {
  text-align: center;
}
.metric.highlight .metric-num {
  color: #60a5fa;
}
.metric-num {
  font-size: 28px;
  font-weight: bold;
  color: #e0e0e0;
  display: block;
}
.metric-label {
  font-size: 12px;
  color: #888;
}
.banner-cta {
  display: inline-block;
  padding: 12px 32px;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.9), rgba(59, 130, 246, 0.9));
  color: white;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}
.banner-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(96, 165, 250, 0.3);
}

/* Visual */
.banner-visual {
  display: flex;
  justify-content: center;
}
.ai-team-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.ai-member {
  width: 90px;
  padding: 14px 8px;
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  border-radius: 12px;
  text-align: center;
  font-size: 12px;
  line-height: 1.4;
}
.ai-member:first-child {
  grid-column: 1 / -1;
  justify-self: center;
  width: 120px;
}

@media (max-width: 768px) {
  .banner-inner { flex-direction: column; padding: 40px 0; }
  .banner-title { font-size: 24px; }
  .ai-team-preview { grid-template-columns: repeat(2, 1fr); }
  .ai-member { width: 75px; font-size: 11px; }
  .ai-member:first-child { grid-column: 1 / -1; width: 100px; }
}
</style>
