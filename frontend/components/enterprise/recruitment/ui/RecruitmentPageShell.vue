<template>
  <div class="rec-page">
    <!-- Page Header -->
    <div class="rec-page-header">
      <div class="rec-page-header-left">
        <h1 class="rec-page-title"><slot name="title" /></h1>
        <p v-if="$slots.subtitle" class="rec-page-subtitle"><slot name="subtitle" /></p>
      </div>
      <div v-if="$slots.actions" class="rec-page-header-right">
        <slot name="actions" />
      </div>
    </div>

    <!-- Stats Bar -->
    <div v-if="$slots.stats" class="rec-page-stats">
      <slot name="stats" />
    </div>

    <!-- Filter Bar -->
    <div v-if="$slots.filters" class="rec-page-filters">
      <slot name="filters" />
    </div>

    <!-- Content -->
    <div class="rec-page-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.rec-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
}

.rec-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.rec-page-header-left {
  flex: 1;
  min-width: 0;
}

.rec-page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
  margin: 0;
  line-height: 1.3;
}

.rec-page-subtitle {
  color: var(--color-text-secondary, #94A3B8);
  font-size: 13px;
  margin-top: 4px;
  margin-bottom: 0;
}

.rec-page-header-right {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.rec-page-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.rec-page-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.rec-page-content {
  flex: 1;
}

@media (max-width: 768px) {
  .rec-page {
    padding: 16px;
  }

  .rec-page-header {
    flex-direction: column;
  }

  .rec-page-stats {
    flex-wrap: wrap;
    gap: 8px;
  }

  .rec-page-filters {
    flex-wrap: wrap;
  }
}
</style>
