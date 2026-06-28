<template>
  <!-- PPT 是独立 SPA，用普通 a 标签做全页跳转 -->
  <a
    v-if="isExternal"
    :href="resolvedRoute"
    class="realm-card"
    :style="cardStyle"
  >
    <div class="realm-icon">
      {{ realm.icon }}
    </div>

    <span
      v-if="realm.tag"
      class="realm-tag"
    >
      {{ realm.tag }}
    </span>

    <div class="realm-realm">
      {{ realm.realm }}
    </div>

    <h3 class="realm-title">
      {{ realm.title }}
    </h3>

    <p class="realm-subtitle">
      {{ realm.subtitle }}
    </p>

    <p class="realm-description">
      {{ realm.description }}
    </p>

    <div class="realm-manifesto">
      「{{ realm.manifesto }}」
    </div>

    <div class="realm-arrow">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 10H16M16 10L11 5M16 10L11 15"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </a>
  <!-- 内部路由用 NuxtLink -->
  <NuxtLink
    v-else
    :to="resolvedRoute"
    class="realm-card"
    :style="cardStyle"
  >
    <div class="realm-icon">
      {{ realm.icon }}
    </div>

    <span
      v-if="realm.tag"
      class="realm-tag"
    >
      {{ realm.tag }}
    </span>

    <div class="realm-realm">
      {{ realm.realm }}
    </div>

    <h3 class="realm-title">
      {{ realm.title }}
    </h3>

    <p class="realm-subtitle">
      {{ realm.subtitle }}
    </p>

    <p class="realm-description">
      {{ realm.description }}
    </p>

    <div class="realm-manifesto">
      「{{ realm.manifesto }}」
    </div>

    <div class="realm-arrow">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M4 10H16M16 10L11 5M16 10L11 15"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
/**
 * RealmCard — 五境工作台卡片
 *
 * 归属原语：Glass（通过 MirrorCard）
 * 层级：L3 cards
 * 用途：接收 RealmDefinition，渲染对应境界的名称/图标/路由。
 * 限制：无 Realm 实例不渲染。
 */

import type { RealmDefinition } from '~/utils/kunlun/realms'

const props = defineProps<{
  realm: RealmDefinition
  layout?: 'bento' | 'compact' | 'expanded'
}>()

const cardStyle = computed(() => ({
  '--realm-color': props.realm.color,
  '--realm-order': props.realm.order,
}))

/** 解析后的路由字符串 */
const resolvedRoute = computed(() => {
  if (typeof props.realm.route === 'function') return '#'
  return props.realm.route
})

/** 独立 SPA（/ppt/）需要用 a 标签做整页跳转，不能用 NuxtLink */
const isExternal = computed(() => {
  return resolvedRoute.value === '/ppt/'
})
</script>

<style scoped>
.realm-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 28px;
  border-radius: 16px;
  background: rgba(14, 29, 49, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(201, 168, 108, 0.08);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.realm-card:hover {
  transform: translateY(-6px);
  border-color: var(--realm-color);
  box-shadow:
    0 12px 48px color-mix(in srgb, var(--realm-color) 15%, transparent),
    0 0 0 1px color-mix(in srgb, var(--realm-color) 20%, transparent);
}

.realm-icon {
  font-size: 2rem;
  margin-bottom: 12px;
}

.realm-tag {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 2px 10px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--realm-color) 20%, transparent);
  color: var(--realm-color);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.realm-realm {
  font-size: 0.8rem;
  color: var(--realm-color);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.realm-title {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0 0 6px;
  background: linear-gradient(135deg, #F8F6F1 0%, color-mix(in srgb, var(--realm-color) 60%, #F8F6F1) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.realm-subtitle {
  font-size: 0.9rem;
  color: rgba(248, 246, 241, 0.7);
  margin: 0 0 8px;
}

.realm-description {
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.5);
  line-height: 1.6;
  margin: 0 0 16px;
  flex: 1;
}

.realm-manifesto {
  font-size: 0.85rem;
  color: rgba(201, 168, 108, 0.6);
  font-style: italic;
  margin-bottom: 12px;
}

.realm-arrow {
  align-self: flex-end;
  color: var(--realm-color);
  opacity: 0;
  transform: translateX(-8px);
  transition:
    opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.realm-card:hover .realm-arrow {
  opacity: 1;
  transform: translateX(0);
}
</style>
