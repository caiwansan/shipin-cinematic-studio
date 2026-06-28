/**
 * useMotion — 滚动/入场动画组合式函数
 *
 * 基于 GSAP + ScrollTrigger 的滚动入场动画
 * 同时支持新旧两种调用方式：
 *   旧式: useScrollTrigger(element, { opacity: { from: 0, to: 1 }, y: { from: 20, to: 0 }, duration: 0.8 })
 *   新式: useScrollTrigger({ from: 'bottom', duration: 0.8 })
 */

import { ref, isRef, onMounted, type Ref } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { motion } from '~/utils/kunlun/motion'

// 注册 ScrollTrigger 插件（全局一次）
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export interface RevealOptions {
  from?: 'bottom' | 'left' | 'right' | 'top' | 'scale' | 'fade'
  delay?: number
  duration?: number
  distance?: number
  threshold?: number
  stagger?: number
  once?: boolean
}

/**
 * 旧版 useScrollTrigger 参数格式
 * 场景组件沿用：useScrollTrigger(el, { opacity: { from, to }, y: { from, to }, ... })
 */
export interface LegacyScrollOptions {
  opacity?: { from: number; to: number }
  x?: { from: number; to: number }
  y?: { from: number; to: number }
  scale?: { from: number; to: number }
  duration?: number
  delay?: number
  ease?: string
  once?: boolean
  onComplete?: () => void
}

export function useReveal(options: RevealOptions = {}) {
  const opts = {
    from: options.from ?? 'bottom',
    delay: options.delay ?? 0,
    duration: options.duration ?? motion.duration.narrative / 1000,
    distance: options.distance ?? 60,
    threshold: options.threshold ?? motion.scroll.enter,
    stagger: options.stagger ?? 0,
    once: options.once ?? true,
  }

  const elementRef: Ref<HTMLElement | null> = ref(null)
  const isVisible = ref(false)

  function createAnimation() {
    const el = elementRef.value
    if (!el) return

    const vars: gsap.TweenVars = {
      opacity: 1,
      duration: opts.duration,
      ease: motion.ease.css.narrative,
      delay: opts.delay,
      onStart: () => { isVisible.value = true },
    }

    switch (opts.from) {
      case 'bottom':
        vars.y = 0
        gsap.set(el, { y: opts.distance, opacity: 0 })
        break
      case 'top':
        vars.y = 0
        gsap.set(el, { y: -opts.distance, opacity: 0 })
        break
      case 'left':
        vars.x = 0
        gsap.set(el, { x: -opts.distance, opacity: 0 })
        break
      case 'right':
        vars.x = 0
        gsap.set(el, { x: opts.distance, opacity: 0 })
        break
      case 'scale':
        vars.scale = 1
        gsap.set(el, { scale: 0.9, opacity: 0 })
        break
      case 'fade':
        gsap.set(el, { opacity: 0 })
        break
    }

    // 判断是否已在视口中
    const rect = el.getBoundingClientRect()
    const viewportH = window.innerHeight || document.documentElement.clientHeight
    const isAlreadyVisible = rect.top < viewportH && rect.bottom > 0

    if (isAlreadyVisible) {
      // 已在视口：直接播放
      gsap.to(el, vars)
    } else {
      ScrollTrigger.create({
        trigger: el,
        start: `top bottom+=${(1 - opts.threshold) * 100}%`,
        onEnter: () => {
          gsap.to(el, vars)
        },
        ...(opts.once ? { once: true } : {}),
      })
    }
  }

  function refresh() {
    ScrollTrigger.refresh()
  }

  onMounted(() => {
    // 等 nextTick 确保 DOM 就绪
    setTimeout(createAnimation, 100)
  })

  return {
    elementRef,
    isVisible,
    refresh,
  }
}

/**
 * 数字滚动动画
 */
export function useCountUp(target: number, duration = 2) {
  const value = ref(0)

  function animate() {
    gsap.to(value, {
      value: target,
      duration,
      ease: motion.ease.css.narrative,
      onUpdate: () => {
        value.value = Math.round(value.value)
      },
    })
  }

  return { value, animate }
}

/**
 * 旧式 useScrollTrigger — 兼容场景组件已有的调用模式
 * 用法: useScrollTrigger(element, { opacity: { from: 0, to: 1 }, y: { from: 20, to: 0 }, duration: 0.8 })
 */
function createLegacyScrollTrigger(element: HTMLElement | null, options: LegacyScrollOptions) {
  if (!element) return

  const duration = options.duration ?? 0.8
  const delay = options.delay ?? 0
  const ease = options.ease ?? motion.ease.css.narrative
  const once = options.once ?? true

  // 构建 GSAP fromVars — 初始状态
  const fromVars: gsap.TweenVars = {}
  if (options.opacity) fromVars.opacity = options.opacity.from
  if (options.x) fromVars.x = options.x.from
  if (options.y) fromVars.y = options.y.from
  if (options.scale) fromVars.scale = options.scale.from

  // 构建 GSAP toVars — 最终状态
  const toVars: gsap.TweenVars = {
    duration,
    delay,
    ease,
  }
  if (options.onComplete) toVars.onComplete = options.onComplete
  if (options.opacity) toVars.opacity = options.opacity.to
  if (options.x) toVars.x = options.x.to
  if (options.y) toVars.y = options.y.to
  if (options.scale) toVars.scale = options.scale.to

  // 判断元素是否已在视口中（首屏元素无需等待滚动）
  const rect = element.getBoundingClientRect()
  const viewportH = window.innerHeight || document.documentElement.clientHeight
  const isAlreadyVisible = rect.top < viewportH && rect.bottom > 0

  if (isAlreadyVisible) {
    // 已在视口：直接播放动画，不等 ScrollTrigger onEnter
    gsap.set(element, fromVars)
    gsap.to(element, toVars)
    const st = ScrollTrigger.create({
      trigger: element,
      start: 'top bottom-=10%',
      ...(once ? { once: true } : {}),
    })
    return st
  }

  const st = ScrollTrigger.create({
    trigger: element,
    start: 'top bottom-=10%',
    onEnter: () => {
      gsap.set(element, fromVars)
      gsap.to(element, toVars)
    },
    ...(once ? { once: true } : {}),
  })

  return st
}

/**
 * useMotion — 统一组合式函数
 *
 * useScrollTrigger 同时兼容两种调用模式：
 *   1. useScrollTrigger(element, options)  — 旧式，场景组件在用
 *   2. useScrollTrigger(options)           — 新式，返回 useReveal
 */
export function useMotion() {
  function useScrollTrigger(
    elOrOptions: HTMLElement | null | RevealOptions | LegacyScrollOptions,
    options?: LegacyScrollOptions
  ) {
    // 如果第一个参数是 DOM 元素 → 旧式调用 useScrollTrigger(el, opts)
    if (elOrOptions instanceof HTMLElement || elOrOptions === null) {
      return createLegacyScrollTrigger(elOrOptions, options ?? {})
    }
    // 如果第一个参数是 options → 新式调用 useScrollTrigger(opts) => useReveal
    return useReveal(elOrOptions as RevealOptions)
  }

  /**
   * animateNumber — 兼容用法
   * 用法1: animateNumber(ref, startVal, endVal, duration)
   *   场景组件用：animateNumber(currentCount, 0, props.data.countTarget, 2000)
   * 用法2: animateNumber(target, duration)
   *   返回 { value, animate }
   */
  function animateNumber(
    refOrTarget: Ref<number> | number,
    startValOrDuration?: number,
    endVal?: number,
    duration?: number
  ): any {
    // 用法1: animateNumber(ref, start, end, duration)
    if (isRef(refOrTarget) && typeof startValOrDuration === 'number' && typeof endVal === 'number') {
      const targetRef = refOrTarget
      const startVal = startValOrDuration
      const end = endVal
      const dur = duration ?? 2
      gsap.fromTo(targetRef, { value: startVal }, {
        value: end,
        duration: dur,
        ease: motion.ease.css.narrative,
        onUpdate: () => {
          targetRef.value = Math.round(targetRef.value)
        },
      })
      return
    }
    // 用法2: animateNumber(target, duration)
    if (typeof refOrTarget === 'number') {
      return useCountUp(refOrTarget, startValOrDuration ?? 2)
    }
  }

  return { useScrollTrigger, useReveal, useCountUp, animateNumber }
}
