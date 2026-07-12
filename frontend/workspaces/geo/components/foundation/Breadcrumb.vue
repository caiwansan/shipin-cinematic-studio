<template>
  <nav v-if="items && items.length > 0" class="foundation-breadcrumb" aria-label="Breadcrumb">
    <ol class="foundation-breadcrumb__list">
      <template v-for="(item, index) in visibleItems" :key="index">
        <li class="foundation-breadcrumb__item">
          <!-- 有 path 且非最后一项 → 可点击链接 -->
          <NuxtLink
            v-if="item.path && index < visibleItems.length - 1"
            :to="item.path"
            :class="['foundation-breadcrumb__link', { 'foundation-breadcrumb__link--disabled': item.disabled }]"
            :aria-disabled="item.disabled"
          >
            {{ item.label }}
          </NuxtLink>
          <!-- 最后一项或无 path → 当前位置（粗体） -->
          <span
            v-else
            class="foundation-breadcrumb__current"
            aria-current="page"
          >
            {{ item.label }}
          </span>
        </li>
        <!-- 分隔符：非最后一项 -->
        <li
          v-if="index < visibleItems.length - 1"
          class="foundation-breadcrumb__separator"
          aria-hidden="true"
        >
          {{ separator }}
        </li>
      </template>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Breadcrumb } from '~/workspaces/geo/types/foundation'

const props = withDefaults(defineProps<{
  items: Breadcrumb[]
  separator?: string
}>(), {
  separator: '/',
})

/**
 * 移动端折叠逻辑：
 * - 如果只有 3 项或更少，全部显示
 * - 如果超过 3 项，只显示：前两项 + 省略号 + 最后一项
 */
const visibleItems = computed(() => {
  const all = props.items
  if (all.length <= 3) return all

  const first = all[0]
  const second = all[1]
  const last = all[all.length - 1]

  const collapseMarker: Breadcrumb = {
    label: '...',
    disabled: true,
  }

  return [first, second, collapseMarker, last]
})
</script>

<style scoped>
.foundation-breadcrumb {
  display: flex;
  align-items: center;
  font-size: 14px;
  line-height: 1.4;
  color: #64748b;
}

.foundation-breadcrumb__list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 0;
}

.foundation-breadcrumb__item {
  display: flex;
  align-items: center;
}

.foundation-breadcrumb__link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s;
}

.foundation-breadcrumb__link:hover {
  color: #2563eb;
  text-decoration: underline;
}

.foundation-breadcrumb__link--disabled {
  color: #94a3b8;
  pointer-events: none;
  text-decoration: none;
}

.foundation-breadcrumb__current {
  font-weight: 700;
  color: #1e293b;
}

.foundation-breadcrumb__separator {
  margin: 0 8px;
  color: #94a3b8;
  user-select: none;
}
</style>
