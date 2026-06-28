/**
 * useAurora — 极光背景组合式函数
 *
 * 慢速极光层效果，用于 Hero 和 Final CTA 背景
 * 使用 Canvas 2D 实现，轻量无 Three 依赖
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { colors } from '~/utils/kunlun/colors'

export interface AuroraOptions {
  layers?: number
  speed?: number
  opacity?: number
  colors?: string[]
}

export function useAurora(containerOrOptions: HTMLElement | AuroraOptions = {}, options?: AuroraOptions) {
  let rawOpts: AuroraOptions
  if (containerOrOptions instanceof HTMLElement) {
    rawOpts = options ?? {}
  } else {
    rawOpts = containerOrOptions
  }
  const opts = {
    layers: rawOpts.layers ?? 3,
    speed: rawOpts.speed ?? 0.002,
    opacity: rawOpts.opacity ?? 0.5,
    colors: rawOpts.colors ?? [
      colors.aurora.top || 'rgba(0, 212, 255, 0.06)',
      colors.aurora.middle || 'rgba(201, 168, 108, 0.04)',
      colors.aurora.bottom || 'rgba(167, 139, 250, 0.06)',
    ],
  }

  const canvasRef: Ref<HTMLCanvasElement | null> = ref(null)
  let ctx: CanvasRenderingContext2D | null = null
  let animationId: number | null = null
  let time = 0
  let width = 0
  let height = 0

  function resize() {
    if (!canvasRef.value) return
    width = canvasRef.value.clientWidth || window.innerWidth
    height = canvasRef.value.clientHeight || window.innerHeight
    canvasRef.value.width = width * 2
    canvasRef.value.height = height * 2
    canvasRef.value.style.width = `${width}px`
    canvasRef.value.style.height = `${height}px`
    ctx = canvasRef.value.getContext('2d')
  }

  function draw() {
    if (!ctx) return
    time += opts.speed
    ctx.clearRect(0, 0, width * 2, height * 2)

    for (let l = 0; l < opts.layers; l++) {
      const layerOpacity = opts.opacity * (1 - l / opts.layers)
      ctx.save()
      ctx.globalAlpha = layerOpacity

      const offsetY = height * 0.2 * l
      const freq1 = 0.003 + l * 0.001
      const freq2 = 0.005 + l * 0.002

      ctx.beginPath()
      ctx.moveTo(0, height * 2)

      for (let x = 0; x <= width * 2; x += 2) {
        const y =
          offsetY +
          Math.sin(x * freq1 + time * 2 + l) * height * 0.1 +
          Math.sin(x * freq2 + time * 1.5 - l * 0.5) * height * 0.06 +
          Math.sin(x * 0.001 + time * 0.8 + l * 2) * height * 0.04
        ctx.lineTo(x, y)
      }

      ctx.lineTo(width * 2, height * 2)
      ctx.closePath()

      const gradient = ctx.createLinearGradient(0, 0, width * 2 * 0.3, height * 2)
      const colorIndex = l % opts.colors.length
      gradient.addColorStop(0, opts.colors[colorIndex])
      gradient.addColorStop(0.5, opts.colors[(colorIndex + 1) % opts.colors.length])
      gradient.addColorStop(1, 'transparent')

      ctx.fillStyle = gradient
      ctx.fill()
      ctx.restore()
    }

    animationId = requestAnimationFrame(draw)
  }

  function start() {
    resize()
    draw()
    window.addEventListener('resize', resize)
  }

  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    window.removeEventListener('resize', resize)
  }

  return {
    canvasRef,
    start,
    stop,
  }
}
