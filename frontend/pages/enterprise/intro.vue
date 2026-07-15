<template>
  <div class="enterprise-intro">
    <!-- Hero -->
    <div class="hero-section">
      <div class="hero-badge">🚀 昆仑镜企业数字部门</div>
      <h1 class="hero-title">给企业配置一支<br/>7×24 工作的 AI 增长团队</h1>
      <p class="hero-subtitle">
        市场分析 · 内容运营 · 客户开发 · 销售支持<br/>
        让 AI 员工帮助企业持续获得客户和收入
      </p>
      <div class="hero-cta">
        <NuxtLink to="/enterprise" class="cta-primary">
          立即体验 →
        </NuxtLink>
      </div>
    </div>

    <!-- 数据验证 -->
    <div class="validation-section">
      <h2>Tesla 模拟运营 7 天结果</h2>
      <div class="validation-metrics">
        <div class="metric-card">
          <div class="metric-num">19</div>
          <div class="metric-name">篇行业内容</div>
        </div>
        <div class="metric-card">
          <div class="metric-num">95</div>
          <div class="metric-name">次用户互动</div>
        </div>
        <div class="metric-card highlight">
          <div class="metric-num">38</div>
          <div class="metric-name">个销售线索</div>
        </div>
        <div class="metric-card">
          <div class="metric-num">40%</div>
          <div class="metric-name">线索转化率</div>
        </div>
      </div>
    </div>

    <!-- 5个AI员工 -->
    <div class="team-section">
      <h2>您的 AI 增长部门</h2>
      <div class="team-grid">
        <div class="team-card">
          <div class="team-icon">🎯</div>
          <div class="team-role">AI增长总监</div>
          <div class="team-desc">市场扫描、行业机会分析、生成增长任务</div>
          <div class="team-time">每日 09:00</div>
        </div>
        <div class="team-card">
          <div class="team-icon">📊</div>
          <div class="team-role">AI市场分析师</div>
          <div class="team-desc">新能源行业趋势、竞争动态、客户需求变化</div>
          <div class="team-time">每日 11:00</div>
        </div>
        <div class="team-card">
          <div class="team-icon">✍️</div>
          <div class="team-role">AI内容经理</div>
          <div class="team-desc">公众号 2篇/天 · 小红书 3篇/天 · 抖音脚本</div>
          <div class="team-time">每日 10:00</div>
        </div>
        <div class="team-card">
          <div class="team-icon">💬</div>
          <div class="team-role">AI客户运营</div>
          <div class="team-desc">评论私信 · 互动分析 · 客户分类 · Lead生成</div>
          <div class="team-time">每日 14:00</div>
        </div>
        <div class="team-card">
          <div class="team-icon">🤝</div>
          <div class="team-role">AI销售助理</div>
          <div class="team-desc">客户画像 · 需求摘要 · 成交概率 · 跟进建议</div>
          <div class="team-time">每日 17:00</div>
        </div>
      </div>
    </div>

    <!-- 套餐 -->
    <div class="pricing-section">
      <h2>适合不同阶段的企业</h2>
      <div class="pricing-grid">
        <div class="pricing-card">
          <div class="pricing-name">Starter</div>
          <div class="pricing-target">初创企业</div>
          <div class="pricing-features">
            <div>✅ 完整 AI 增长部门</div>
            <div>✅ 5个AI员工</div>
            <div>✅ 基础渠道接入</div>
            <div>✅ 增长日报</div>
          </div>
          <div class="pricing-cta">
            <NuxtLink to="/enterprise" class="cta-btn">开始试用</NuxtLink>
          </div>
        </div>
        <div class="pricing-card featured">
          <div class="pricing-badge">推荐</div>
          <div class="pricing-name">Growth</div>
          <div class="pricing-target">成长型企业</div>
          <div class="pricing-features">
            <div>✅ 完整 AI 增长部门</div>
            <div>✅ 全渠道发布（公众号/抖音/小红书/企微）</div>
            <div>✅ Lead Intelligence 线索分析</div>
            <div>✅ 增长收益</div>
          </div>
          <div class="pricing-cta">
            <NuxtLink to="/enterprise" class="cta-btn primary">开始试用</NuxtLink>
          </div>
        </div>
        <div class="pricing-card">
          <div class="pricing-name">Enterprise</div>
          <div class="pricing-target">大型企业</div>
          <div class="pricing-features">
            <div>✅ 私有部署</div>
            <div>✅ 企业模型接入</div>
            <div>✅ 定制化Agent</div>
            <div>✅ 数据隔离</div>
          </div>
          <div class="pricing-cta">
            <NuxtLink to="/enterprise" class="cta-btn">联系销售</NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer CTA -->
    <div class="footer-cta">
      <p>已验证商业闭环 · Tesla模拟7天38个线索 · 转化率40%</p>
      <NuxtLink to="/enterprise" class="cta-primary large">
        立即配置您的AI增长部门 →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
// 企业数字部门介绍页 — 非企业用户落地页
</script>

<style scoped>
.enterprise-intro {
  max-width: 1000px;
  margin: 0 auto;
  padding: 80px 24px 60px;
  color: #e0e0e0;
}

/* Hero */
.hero-section {
  text-align: center;
  margin-bottom: 60px;
}
.hero-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 20px;
  font-size: 14px;
  color: rgba(96, 165, 250, 0.9);
  margin-bottom: 24px;
}
.hero-title {
  font-size: 42px;
  font-weight: bold;
  line-height: 1.3;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #e0e0e0, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-subtitle {
  font-size: 18px;
  color: #aab;
  line-height: 1.8;
  margin-bottom: 32px;
}
.cta-primary {
  display: inline-block;
  padding: 14px 36px;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.9), rgba(59, 130, 246, 0.9));
  color: white;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}
.cta-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(96, 165, 250, 0.3);
}
.cta-primary.large { padding: 16px 48px; font-size: 18px; }

/* 验证数据 */
.validation-section {
  text-align: center;
  margin-bottom: 60px;
}
.validation-section h2 {
  font-size: 24px;
  margin-bottom: 24px;
  color: #ccd;
}
.validation-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.metric-card {
  padding: 24px 12px;
  background: #1a1a2e;
  border-radius: 12px;
  border: 1px solid #2a2a3e;
}
.metric-card.highlight {
  border-color: rgba(96, 165, 250, 0.4);
  background: rgba(96, 165, 250, 0.05);
}
.metric-num {
  font-size: 36px;
  font-weight: bold;
  color: #60a5fa;
}
.metric-name {
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}

/* AI团队 */
.team-section {
  margin-bottom: 60px;
}
.team-section h2 {
  font-size: 24px;
  text-align: center;
  margin-bottom: 24px;
  color: #ccd;
}
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.team-card {
  padding: 20px;
  background: #1a1a2e;
  border-radius: 12px;
  border: 1px solid #2a2a3e;
  text-align: center;
}
.team-icon { font-size: 32px; margin-bottom: 8px; }
.team-role { font-weight: bold; font-size: 15px; margin-bottom: 8px; }
.team-desc { font-size: 13px; color: #888; line-height: 1.5; margin-bottom: 8px; }
.team-time { font-size: 12px; color: rgba(96, 165, 250, 0.7); }

/* Pricing */
.pricing-section {
  margin-bottom: 60px;
}
.pricing-section h2 {
  font-size: 24px;
  text-align: center;
  margin-bottom: 24px;
  color: #ccd;
}
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.pricing-card {
  padding: 24px;
  background: #1a1a2e;
  border-radius: 12px;
  border: 1px solid #2a2a3e;
  position: relative;
}
.pricing-card.featured {
  border-color: rgba(96, 165, 250, 0.4);
  transform: scale(1.02);
}
.pricing-badge {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  background: rgba(96, 165, 250, 0.9);
  border-radius: 12px;
  font-size: 12px;
  color: white;
  font-weight: bold;
}
.pricing-name {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}
.pricing-target {
  font-size: 14px;
  color: #888;
  margin-bottom: 16px;
}
.pricing-features {
  margin-bottom: 20px;
}
.pricing-features div {
  font-size: 14px;
  padding: 4px 0;
  color: #aab;
}
.cta-btn {
  display: block;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  background: #2a2a3e;
  color: #ccd;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}
.cta-btn.primary {
  background: rgba(96, 165, 250, 0.9);
  color: white;
}

/* Footer */
.footer-cta {
  text-align: center;
  padding: 40px 0;
  border-top: 1px solid #2a2a3e;
}
.footer-cta p {
  font-size: 13px;
  color: #666;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .hero-title { font-size: 28px; }
  .validation-metrics { grid-template-columns: repeat(2, 1fr); }
  .pricing-grid { grid-template-columns: 1fr; }
}
</style>
