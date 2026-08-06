<template>
  <div class="community-hero">
    <!-- 远山 + 天青晕染背景 -->
    <svg class="hero-mountains" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="cn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#BFE0E6" />
          <stop offset="55%" stop-color="#E4F0F0" />
          <stop offset="100%" stop-color="#F6F1E3" />
        </linearGradient>
        <linearGradient id="cn-mist" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#D9EAEE" stop-opacity="0" />
          <stop offset="50%" stop-color="#E8F2F1" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#D9EAEE" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="1440" height="320" fill="url(#cn-sky)" />
      <!-- 远山（淡墨） -->
      <path d="M0 240 L180 130 L330 215 L520 90 L700 205 L880 120 L1080 220 L1260 150 L1440 215 L1440 320 L0 320 Z" fill="#A9C6CE" opacity="0.55" />
      <path d="M0 280 L240 180 L430 260 L640 160 L860 265 L1060 190 L1290 270 L1440 220 L1440 320 L0 320 Z" fill="#7FA9B8" opacity="0.5" />
      <path d="M0 320 L300 235 L560 300 L820 225 L1120 305 L1360 250 L1440 280 L1440 320 L0 320 Z" fill="#5E8FA4" opacity="0.55" />
      <!-- 云雾 -->
      <ellipse cx="360" cy="150" rx="260" ry="34" fill="url(#cn-mist)" />
      <ellipse cx="1080" cy="120" rx="300" ry="30" fill="url(#cn-mist)" />
      <!-- 海水江崖（hero 底部） -->
      <g fill="none" stroke="#26547C" stroke-width="1.6" opacity="0.5">
        <path d="M0 296 q40 -14 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" />
        <path d="M0 308 q40 -12 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" />
        <path d="M0 320 q40 -10 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" />
      </g>
    </svg>

    <!-- 云纹飘带 -->
    <span class="hero-cloud hero-cloud--1" aria-hidden="true" />
    <span class="hero-cloud hero-cloud--2" aria-hidden="true" />
    <span class="hero-cloud hero-cloud--3" aria-hidden="true" />

    <div class="hero-content">
      <span class="hero-kicker"><span class="cn-huiwen hero-huiwen" aria-hidden="true" /> 云 端 论 道 <span class="cn-huiwen hero-huiwen" aria-hidden="true" /></span>
      <h1 class="hero-title">昆仑镜 · 创作者社区</h1>
      <p class="hero-desc">
        分享 AI 短剧作品，交流创作经验，以光影为墨、以创意为笔
      </p>
      <div class="hero-actions">
        <NuxtLink to="/community/new" class="cn-seal-btn hero-seal">
          发 帖
        </NuxtLink>
      </div>
      <!-- 朱砂落款 -->
      <span class="hero-chop" aria-hidden="true">昆仑</span>
    </div>
  </div>
</template>

<style scoped>
.community-hero {
  position: relative;
  padding: 64px 24px 78px;
  text-align: center;
  overflow: hidden;
}
.hero-mountains {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 640px;
  margin: 0 auto;
}
.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-family: var(--cn-serif);
  font-size: 0.8rem;
  letter-spacing: 6px;
  color: var(--cn-cobalt-deep);
  margin-bottom: 18px;
  opacity: 0.85;
}
.hero-huiwen {
  width: 64px;
  height: 10px;
  background-size: 60px 10px;
  opacity: 0.8;
}
.hero-title {
  font-family: var(--cn-serif);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--cn-cobalt-deep);
  margin: 0 0 14px;
  line-height: 1.3;
  letter-spacing: 4px;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
}
.hero-desc {
  font-size: 0.95rem;
  color: var(--cn-ink-soft);
  line-height: 1.8;
  margin-bottom: 28px;
  letter-spacing: 1px;
}
.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.hero-seal {
  font-size: 1rem;
  padding: 10px 28px;
}
/* 朱砂落款 */
.hero-chop {
  display: block;
  width: 40px;
  height: 40px;
  margin: 22px auto 0;
  background: var(--cn-cinnabar);
  color: #FBF6EA;
  font-family: var(--cn-kai);
  font-size: 0.85rem;
  letter-spacing: 1px;
  border-radius: 5px;
  border: 2px solid var(--cn-cinnabar-deep);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(-6deg);
  opacity: 0.9;
}
/* 云纹飘带 */
.hero-cloud {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='80' viewBox='0 0 160 80'%3E%3Cpath d='M24 56c0-13 10-22 23-22 9-16 32-18 43-5 7-9 22-9 29 1 11-6 27-4 31 8 9 3 15 9 15 18 0 10-11 19-24 19H46c-13 0-22-8-22-19z' fill='%23FFFFFF' opacity='0.6'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
}
.hero-cloud--1 { width: 150px; height: 70px; top: 14%; left: 7%; opacity: 0.55; animation: cn-drift 26s ease-in-out infinite alternate; }
.hero-cloud--2 { width: 110px; height: 52px; top: 46%; right: 9%; opacity: 0.45; animation: cn-drift 32s ease-in-out infinite alternate-reverse; }
.hero-cloud--3 { width: 90px; height: 42px; top: 8%; right: 26%; opacity: 0.35; animation: cn-drift 38s ease-in-out infinite alternate; }
@keyframes cn-drift {
  from { transform: translateX(-14px); }
  to { transform: translateX(14px); }
}

@media (max-width: 768px) {
  .hero-title { font-size: 1.7rem; letter-spacing: 2px; }
  .hero-kicker { font-size: 0.7rem; letter-spacing: 3px; }
  .community-hero { padding: 44px 20px 60px; }
}
</style>
