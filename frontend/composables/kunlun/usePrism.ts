/**
 * usePrism — 棱镜折射光效组合式函数
 *
 * 实现卡片边缘的彩色折射光效果（Prism Edge）
 * 通过 mouse hover 追踪，在卡片边缘渲染七彩渐变光晕
 */

import { ref, type Ref } from 'vue'
import { colors } from '~/utils/kunlun/colors'

export interface PrismOptions {
  intensity?: number
  spread?: number
  colors?: string[]
}

export function usePrism(options: PrismOptions = {}) {
  const opts = {
    intensity: options.intensity ?? 0.6,
    spread: options.spread ?? 60,
    colors: options.colors ?? [
      colors.prism.red,
      colors.prism.orange,
      colors.prism.yellow,
      colors.prism.green,
      colors.prism.blue,
      colors.prism.indigo,
      colors.prism.violet,
    ],
  }

  const elementRef: Ref<HTMLElement | null> = ref(null)
  const prismStyle = ref<Record<string, string>>({})
  const isHovered = ref(false)

  function onMouseMove(e: MouseEvent) {
    if (!elementRef.value) return

    const rect = elementRef.value.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    // 棱镜折射 — 在鼠标位置生成彩虹渐变
    const angle = Math.atan2(y - 50, x - 50) * (180 / Math.PI)
    const gradientStops = opts.colors.map((c, i) => {
      const offset = (i / (opts.colors.length - 1)) * 100
      return `${c} ${offset}%`
    }).join(', ')

    prismStyle.value = {
      '--prism-x': `${x}%`,
      '--prism-y': `${y}%`,
      '--prism-angle': `${angle}deg`,
      '--prism-opacity': String(opts.intensity),
      '--prism-spread': `${opts.spread}px`,
      background: `radial-gradient(circle at ${x}% ${y}%, ${gradientStops})`,
      opacity: String(opts.intensity),
    }
    isHovered.value = true
  }

  function onMouseLeave() {
    isHovered.value = false
    prismStyle.value = {}
  }

  function bindEvents() {
    const el = elementRef.value
    if (!el) return
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)
  }

  function unbindEvents() {
    const el = elementRef.value
    if (!el) return
    el.removeEventListener('mousemove', onMouseMove)
    el.removeEventListener('mouseleave', onMouseLeave)
  }

  return {
    elementRef,
    prismStyle,
    isHovered,
    bindEvents,
    unbindEvents,
  }
}
