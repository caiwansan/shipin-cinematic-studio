/**
 * GeoWorkspaceLayout.vue — Product Polish (Phase 8)
 *
 * Design System tokens: color, spacing, typography, radius, motion, elevation
 * Features: page transitions, responsive layout, keyboard navigation, focus management
 */
<template>
  <div class="geo-layout">
    <!-- Header -->
    <header class="geo-layout__header">
      <div class="geo-layout__header-left">
        <button
          class="geo-layout__mobile-toggle"
          :aria-label="navOpen ? 'Close navigation' : 'Open navigation'"
          @click="toggleNav"
          @keydown.escape="navOpen = false"
          tabindex="0"
        >
          <span v-if="navOpen">✕</span>
          <span v-else>☰</span>
        </button>
        <span class="geo-layout__brand">Brand Knowledge OS</span>
        <span class="geo-layout__workspace-selector">GEO Workspace</span>
      </div>
      <div class="geo-layout__header-right">
        <span class="geo-layout__user-info">Acme Robotics</span>
      </div>
    </header>

    <div class="geo-layout__body">
      <!-- Sidebar Navigation -->
      <nav
        :class="['geo-layout__nav', { 'geo-layout__nav--open': navOpen }]"
        role="navigation"
        aria-label="GEO Workspace Navigation"
      >
        <router-link
          v-for="tab in navTabs"
          :key="tab.path"
          :to="tab.path"
          :class="['geo-layout__nav-item', { 'geo-layout__nav-item--active': isActive(tab.path) }]"
          :aria-current="isActive(tab.path) ? 'page' : undefined"
          @click="navOpen = false"
          @keydown.enter="navOpen = false"
        >
          <span class="geo-layout__nav-icon" v-html="tab.icon" />
          <span class="geo-layout__nav-label">{{ tab.label }}</span>
        </router-link>
      </nav>

      <!-- Overlay for mobile nav -->
      <div
        v-if="navOpen"
        class="geo-layout__overlay"
        @click="navOpen = false"
        @keydown.escape="navOpen = false"
        tabindex="0"
      />

      <!-- Content Area with page transition -->
      <main class="geo-layout__content" role="main">
        <div class="geo-layout__transition">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const navOpen = ref(false)

const navTabs = [
  { label: 'Dashboard', path: '/workspace/geo/dashboard', icon: '&#128202;' },
  { label: 'Discovery Lab', path: '/workspace/geo/discovery', icon: '&#128300;' },
  { label: 'Assessment', path: '/workspace/geo/health', icon: '&#9829;' },
  { label: 'Recommendations', path: '/workspace/geo/recommendations', icon: '&#9733;' },
  { label: 'Verification', path: '/workspace/geo/verification', icon: '&#10003;' },
  { label: 'Publishing', path: '/workspace/geo/publishing', icon: '&#8644;' },
  { label: 'Growth', path: '/workspace/geo/growth', icon: '&#8599;' },
  { label: 'Knowledge', path: '/workspace/geo/knowledge', icon: '&#128214;' },
]

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}

function toggleNav() {
  navOpen.value = !navOpen.value
}
</script>

<style scoped>
.geo-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--color-surface, #ffffff);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  color: var(--color-text-primary, #111111);
}

/* ===== HEADER ===== */
.geo-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 var(--space-5, 24px);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  background-color: var(--color-surface, #ffffff);
  flex-shrink: 0;
  z-index: 30;
}

.geo-layout__header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4, 16px);
}

.geo-layout__mobile-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface, #ffffff);
  color: var(--color-text-secondary, #6b7280);
  font-size: 18px;
  cursor: pointer;
  transition: background-color var(--motion-fast-duration, 100ms) ease-out;
}

.geo-layout__mobile-toggle:hover {
  background-color: var(--color-surface-dim, #f9fafb);
}

.geo-layout__mobile-toggle:focus-visible {
  outline: 2px solid var(--color-info, #3b82f6);
  outline-offset: 2px;
}

.geo-layout__brand {
  font-size: var(--text-body-size, 16px);
  font-weight: 700;
  color: var(--color-text-primary, #111111);
  letter-spacing: -0.02em;
}

.geo-layout__workspace-selector {
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface-dim, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
}

.geo-layout__header-right {
  display: flex;
  align-items: center;
}

.geo-layout__user-info {
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

/* ===== BODY ===== */
.geo-layout__body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ===== SIDEBAR NAV ===== */
.geo-layout__nav {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
  padding: var(--space-4, 16px);
  border-right: 1px solid var(--color-border, #e5e7eb);
  background-color: var(--color-surface, #ffffff);
  overflow-y: auto;
  z-index: 20;
  transition: transform var(--motion-normal-duration, 200ms) ease-out;
}

.geo-layout__nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  text-decoration: none;
  color: var(--color-text-secondary, #6b7280);
  transition: all var(--motion-fast-duration, 100ms) ease-out;
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  outline: none;
}

.geo-layout__nav-item:hover {
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-text-primary, #111111);
}

.geo-layout__nav-item:focus-visible {
  outline: 2px solid var(--color-info, #3b82f6);
  outline-offset: -2px;
}

.geo-layout__nav-item:active {
  background-color: var(--color-border, #e5e7eb);
}

.geo-layout__nav-item--active {
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-info, #3b82f6);
  font-weight: 600;
}

.geo-layout__nav-item--active:hover {
  color: var(--color-info, #3b82f6);
}

.geo-layout__nav-item--active:focus-visible {
  outline-color: var(--color-info, #3b82f6);
}

.geo-layout__nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 16px;
  flex-shrink: 0;
}

.geo-layout__nav-label {
  line-height: 1;
}

/* ===== OVERLAY (mobile) ===== */
.geo-layout__overlay {
  display: none;
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 15;
}

/* ===== CONTENT ===== */
.geo-layout__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6, 32px) var(--space-5, 24px);
  background-color: var(--color-surface, #ffffff);
}

.geo-layout__transition {
  animation: geo-page-enter var(--motion-normal-duration, 200ms) ease-out;
}

@keyframes geo-page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .geo-layout__nav {
    width: 220px;
  }

  .geo-layout__content {
    padding: var(--space-5, 24px) var(--space-4, 16px);
  }
}

@media (max-width: 768px) {
  .geo-layout__mobile-toggle {
    display: flex;
  }

  .geo-layout__nav {
    position: fixed;
    top: 56px;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
    width: 280px;
    z-index: 20;
    box-shadow: var(--elevation-lg, 0 4px 24px rgba(0,0,0,0.12));
  }

  .geo-layout__nav--open {
    transform: translateX(0);
  }

  .geo-layout__overlay {
    display: block;
  }

  .geo-layout__content {
    padding: var(--space-4, 16px);
  }

  .geo-layout__brand {
    font-size: var(--text-body-sm-size, 14px);
  }
}

@media (max-width: 480px) {
  .geo-layout__workspace-selector {
    display: none;
  }

  .geo-layout__content {
    padding: var(--space-3, 12px);
  }
}
</style>
