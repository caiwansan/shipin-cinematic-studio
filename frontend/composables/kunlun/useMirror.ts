/**
 * useMirror — 镜面核心组合式函数
 *
 * 实现昆仑镜主视觉：
 * - 半透明玻璃镜面缓慢旋转
 * - 镜面折射彩虹光谱
 * - 边缘动态能量流
 * - 鼠标跟踪高光
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { motion } from '~/utils/kunlun/motion'
import { colors } from '~/utils/kunlun/colors'

export interface MirrorOptions {
  size?: number
  autoRotate?: boolean
  floatAmplitude?: number
  mouseTrack?: boolean
}

export function useMirror(options: MirrorOptions = {}) {
  const opts = {
    size: options.size ?? 600,
    autoRotate: options.autoRotate ?? true,
    floatAmplitude: options.floatAmplitude ?? motion.mirror.floatAmplitude,
    mouseTrack: options.mouseTrack ?? true,
  }

  const mirrorRef: Ref<HTMLDivElement | null> = ref(null)
  const rotation = ref(0)
  const glowIntensity = ref(0.5)
  const highlightPos = ref({ x: 50, y: 50 })

  let floatPhase = 0
  let animationId: number | null = null

  function animate() {
    if (!opts.autoRotate) return
    floatPhase += motion.mirror.rotationSpeed
    rotation.value = floatPhase * 180 / Math.PI

    // 光谱循环
    glowIntensity.value = 0.4 + Math.sin(floatPhase * 0.5) * 0.15

    animationId = requestAnimationFrame(animate)
  }

  function onMouseMove(e: MouseEvent) {
    if (!mirrorRef.value || !opts.mouseTrack) return
    const rect = mirrorRef.value.getBoundingClientRect()
    highlightPos.value = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  function start() {
    animationId = requestAnimationFrame(animate)
    if (opts.mouseTrack) {
      window.addEventListener('mousemove', onMouseMove)
    }
  }

  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    if (opts.mouseTrack) {
      window.removeEventListener('mousemove', onMouseMove)
    }
  }

  const mirrorStyle = (): Record<string, string> => ({
    width: `${opts.size}px`,
    height: `${opts.size}px`,
    transform: `rotateY(${rotation.value}deg)`,
    '--mirror-rotation': `${rotation.value}deg`,
    '--mirror-glow': String(glowIntensity.value),
    '--highlight-x': `${highlightPos.value.x}%`,
    '--highlight-y': `${highlightPos.value.y}%`,
  })

  return {
    mirrorRef,
    rotation,
    glowIntensity,
    highlightPos,
    mirrorStyle,
    start,
    stop,
  }
}
