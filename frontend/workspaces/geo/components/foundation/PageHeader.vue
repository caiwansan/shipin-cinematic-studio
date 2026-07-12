<template>
  <header class="foundation-page-header" data-testid="page-header">
    <Breadcrumb
      v-if="breadcrumbs && breadcrumbs.length > 0"
      :items="breadcrumbs"
    />
    <h1 class="foundation-page-header__title">{{ title }}</h1>
    <p v-if="description" class="foundation-page-header__description">
      {{ description }}
    </p>
  </header>
</template>

<script setup lang="ts">
import Breadcrumb from './Breadcrumb.vue'
import type { Breadcrumb as BreadcrumbItem } from '~/workspaces/geo/types/foundation'

interface PageHeaderProps {
  /** 页面唯一 <h1> */
  title: string
  /** 可选描述 */
  description?: string
  /** 可选面包屑 */
  breadcrumbs?: BreadcrumbItem[]
}

defineProps<PageHeaderProps>()
</script>

<style scoped>
.foundation-page-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 0 16px;
}

.foundation-page-header__title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  line-height: 1.3;
}

.foundation-page-header__description {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}
</style>
