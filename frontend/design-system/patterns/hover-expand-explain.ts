/**
 * Brand OS Design System — Hover → Expand → Explain
 * DS-6.1 Interaction Pattern
 *
 * Composable for hover/expand tooltip behavior.
 * Provides a reactive state machine for hover interactions with explanation content.
 *
 * Reference: BRAND_OS_DESIGN_SYSTEM.md DS-6.1
 */

import { ref, computed, type Ref } from 'vue'

export interface HoverExpandState {
  /** Whether the element is currently hovered */
  isHovered: Ref<boolean>
  /** Whether the explanation is expanded (for click-to-toggle) */
  isExpanded: Ref<boolean>
  /** Combined visibility (hovered OR expanded) */
  isVisible: Ref<boolean>
  /** Mouse enter handler */
  onMouseEnter: () => void
  /** Mouse leave handler */
  onMouseLeave: () => void
  /** Toggle expanded state */
  toggle: () => void
  /** Show explanation (programmatic) */
  show: () => void
  /** Hide explanation (programmatic) */
  hide: () => void
}

export interface HoverExpandOptions {
  /** Delay before showing explanation (ms, default 200) */
  showDelay?: number
  /** Delay before hiding explanation (ms, default 300) */
  hideDelay?: number
  /** Allow click-to-toggle in addition to hover (default true) */
  allowToggle?: boolean
  /** Debounce hover events (default true) */
  debounce?: boolean
}

/**
 * Composable for the Hover → Expand → Explain interaction pattern (DS-6.1).
 *
 * Usage:
 * ```vue
 * <script setup>
 * const { isVisible, onMouseEnter, onMouseLeave, toggle } = useHoverExpandExplain()
 * </script>
 * <template>
 *   <div @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
 *     <span>Score: 82</span>
 *     <Transition v-if="isVisible">
 *       <Tooltip content="Brand Health is calculated from..." />
 *     </Transition>
 *   </div>
 * </template>
 * ```
 */
export function useHoverExpandExplain(options: HoverExpandOptions = {}): HoverExpandState {
  const {
    showDelay = 200,
    hideDelay = 300,
    allowToggle = true,
    debounce = true,
  } = options

  const isHovered = ref(false)
  const isExpanded = ref(false)

  let showTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  const isVisible = computed(() => isHovered.value || isExpanded.value)

  function clearTimers() {
    if (showTimer !== null) {
      clearTimeout(showTimer)
      showTimer = null
    }
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function onMouseEnter() {
    clearTimers()
    if (debounce) {
      showTimer = setTimeout(() => {
        isHovered.value = true
      }, showDelay)
    } else {
      isHovered.value = true
    }
  }

  function onMouseLeave() {
    clearTimers()
    if (debounce) {
      hideTimer = setTimeout(() => {
        isHovered.value = false
      }, hideDelay)
    } else {
      isHovered.value = false
    }
  }

  function toggle() {
    if (allowToggle) {
      isExpanded.value = !isExpanded.value
      if (isExpanded.value) {
        isHovered.value = false
      }
    }
  }

  function show() {
    clearTimers()
    isHovered.value = true
  }

  function hide() {
    clearTimers()
    isHovered.value = false
    isExpanded.value = false
  }

  return {
    isHovered,
    isExpanded,
    isVisible,
    onMouseEnter,
    onMouseLeave,
    toggle,
    show,
    hide,
  }
}
