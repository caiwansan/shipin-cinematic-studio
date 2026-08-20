<template>
  <div class="community-hero">
    <!-- 粒子网格背景 -->
    <canvas ref="particleCanvas" class="hero-particles" aria-hidden="true" />
    
    <!-- 全息扫描线 -->
    <div class="hero-scanline" aria-hidden="true" />
    
    <!-- 几何装饰 -->
    <div class="hero-geo hero-geo--1" aria-hidden="true" />
    <div class="hero-geo hero-geo--2" aria-hidden="true" />
    <div class="hero-geo hero-geo--3" aria-hidden="true" />

    <div class="hero-content">
      <span class="hero-kicker">
        <span class="hero-kicker-dot" />
        QUANTUM CREATOR NETWORK
      </span>
      <h1 class="hero-title">
        <span class="hero-title-main">昆仑镜</span>
        <span class="hero-title-sub">创 作 者 社 区</span>
      </h1>
      <p class="hero-desc">
        以 AI 为笔、以光影为墨，探索数字内容创作的无限边界
      </p>
      <div class="hero-actions">
        <NuxtLink to="/community/new" class="cn-seal-btn hero-cta">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          发 布 内 容
        </NuxtLink>
      </div>
      <!-- 数据流指示器 -->
      <div class="hero-stats">
        <div class="hero-stat">
          <span class="hero-stat-value">{{ postCount }}</span>
          <span class="hero-stat-label">POSTS</span>
        </div>
        <div class="hero-stat-divider" />
        <div class="hero-stat">
          <span class="hero-stat-value">{{ memberCount }}</span>
          <span class="hero-stat-label">CREATORS</span>
        </div>
        <div class="hero-stat-divider" />
        <div class="hero-stat">
          <span class="hero-stat-value">{{ activityCount }}</span>
          <span class="hero-stat-label">ACTIVITY</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const particleCanvas = ref<HTMLCanvasElement | null>(null)
let animFrame: number | null = null

// 粒子动画
onMounted(() => {
  const canvas = particleCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const resize = () => {
    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = canvas.offsetHeight * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  }
  resize()
  window.addEventListener('resize', resize)

  // 粒子系统
  const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = []
  const w = canvas.offsetWidth
  const h = canvas.offsetHeight
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
    })
  }

  function draw() {
    if (!ctx) return
    const cw = canvas!.offsetWidth
    const ch = canvas!.offsetHeight
    ctx.clearRect(0, 0, cw, ch)

    // 绘制连线
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120) {
          ctx.beginPath()
          ctx.strokeStyle = `rgba(0, 229, 255, ${0.08 * (1 - dist / 120)})`
          ctx.lineWidth = 0.5
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.stroke()
        }
      }
    }

    // 绘制粒子
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0 || p.x > cw) p.vx *= -1
      if (p.y < 0 || p.y > ch) p.vy *= -1
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(0, 229, 255, ${p.opacity})`
      ctx.fill()
    }

    animFrame = requestAnimationFrame(draw)
  }
  draw()
})

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
})

// 模拟数据（实际可接 API）
const postCount = '2,847'
const memberCount = '1,203'
const activityCount = '98%'
</script>

<style scoped>
.community-hero {
  position: relative;
  padding: 80px 24px 90px;
  text-align: center;
  overflow: hidden;
  background: linear-gradient(180deg, var(--sf-bg-deep) 0%, var(--sf-bg-void) 100%);
}

/* 粒子画布 */
.hero-particles {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 扫描线 */
.hero-scanline {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.hero-scanline::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--sf-cyan-glow), transparent);
  animation: sf-scan-line 6s linear infinite;
  opacity: 0.4;
}

/* 几何装饰 */
.hero-geo {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  border: 1px solid var(--sf-border-glow);
  border-radius: 4px;
  opacity: 0.3;
}
.hero-geo--1 {
  width: 80px;
  height: 80px;
  top: 15%;
  left: 8%;
  transform: rotate(45deg);
  animation: sf-float 8s ease-in-out infinite;
}
.hero-geo--2 {
  width: 50px;
  height: 50px;
  top: 60%;
  right: 10%;
  border-radius: 50%;
  animation: sf-float 10s ease-in-out infinite reverse;
}
.hero-geo--3 {
  width: 60px;
  height: 60px;
  top: 25%;
  right: 20%;
  transform: rotate(15deg);
  border-color: var(--sf-purple-glow);
  animation: sf-float 12s ease-in-out infinite;
}

/* 内容 */
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 700px;
  margin: 0 auto;
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--sf-mono);
  font-size: 0.72rem;
  letter-spacing: 4px;
  color: var(--sf-cyan);
  margin-bottom: 24px;
  text-transform: uppercase;
}
.hero-kicker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sf-cyan);
  box-shadow: 0 0 8px var(--sf-cyan-glow);
  animation: sf-pulse 2s ease-in-out infinite;
}

.hero-title {
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.hero-title-main {
  font-family: var(--sf-sans);
  font-size: 3rem;
  font-weight: 800;
  color: var(--sf-text-primary);
  letter-spacing: 8px;
  background: linear-gradient(135deg, var(--sf-text-primary) 0%, var(--sf-cyan-bright) 50%, var(--sf-text-primary) 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: sf-shimmer 4s ease-in-out infinite;
}
.hero-title-sub {
  font-family: var(--sf-sans);
  font-size: 1rem;
  font-weight: 400;
  color: var(--sf-text-secondary);
  letter-spacing: 12px;
}

.hero-desc {
  font-size: 0.95rem;
  color: var(--sf-text-tertiary);
  line-height: 1.8;
  margin-bottom: 32px;
  letter-spacing: 1px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}
.hero-cta {
  font-size: 0.9rem;
  padding: 10px 28px;
}

/* 数据统计 */
.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 48px;
}
.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.hero-stat-value {
  font-family: var(--sf-mono);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--sf-cyan);
  text-shadow: 0 0 12px var(--sf-cyan-glow);
}
.hero-stat-label {
  font-family: var(--sf-mono);
  font-size: 0.62rem;
  letter-spacing: 2px;
  color: var(--sf-text-tertiary);
}
.hero-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--sf-border-default);
}

@media (max-width: 768px) {
  .hero-title-main { font-size: 2rem; letter-spacing: 4px; }
  .hero-title-sub { font-size: 0.8rem; letter-spacing: 6px; }
  .community-hero { padding: 52px 20px 64px; }
  .hero-stats { gap: 16px; }
  .hero-stat-value { font-size: 1rem; }
}
</style>
