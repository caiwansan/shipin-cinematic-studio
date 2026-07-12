<template>
  <div class="ui-skeleton">
    <!-- Workflow skeleton -->
    <div v-if="variant === 'workflow'" class="ui-skeleton__workflow">
      <div v-for="i in 7" :key="i" class="ui-skeleton__workflow-row">
        <div class="ui-skeleton__dot"></div>
        <div class="ui-skeleton__bars">
          <div class="ui-skeleton__bar ui-skeleton__bar--title" :style="{ width: `${60 + Math.random() * 30}%` }"></div>
          <div class="ui-skeleton__bar ui-skeleton__bar--detail" style="width: 40%"></div>
        </div>
      </div>
    </div>

    <!-- Dashboard hero skeleton -->
    <div v-else-if="variant === 'hero'" class="ui-skeleton__hero">
      <div class="ui-skeleton__hero-block">
        <div class="ui-skeleton__bar" style="width: 180px; height: 22px; margin-bottom: 8px;"></div>
        <div class="ui-skeleton__bar" style="width: 120px; height: 14px;"></div>
      </div>
      <div class="ui-skeleton__hero-metrics">
        <div v-for="i in 3" :key="i" class="ui-skeleton__hero-metric">
          <div class="ui-skeleton__bar" style="width: 48px; height: 32px; margin: 0 auto 6px;"></div>
          <div class="ui-skeleton__bar" style="width: 56px; height: 12px; margin: 0 auto;"></div>
        </div>
      </div>
    </div>

    <!-- Card list skeleton -->
    <div v-else-if="variant === 'cards'" class="ui-skeleton__cards">
      <div v-for="i in (count || 3)" :key="i" class="ui-skeleton__card">
        <div class="ui-skeleton__card-row">
          <div class="ui-skeleton__bar" style="width: 80px; height: 14px;"></div>
          <div class="ui-skeleton__badge"></div>
        </div>
        <div class="ui-skeleton__bar" style="width: 60%; height: 12px; margin-top: 8px;"></div>
      </div>
    </div>

    <!-- Activity feed skeleton -->
    <div v-else-if="variant === 'activity'" class="ui-skeleton__activity">
      <div v-for="i in (count || 4)" :key="i" class="ui-skeleton__activity-item">
        <div class="ui-skeleton__circle"></div>
        <div class="ui-skeleton__bars">
          <div class="ui-skeleton__bar" style="width: 55%; height: 14px;"></div>
          <div class="ui-skeleton__bar" style="width: 35%; height: 12px; margin-top: 4px;"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant: 'workflow' | 'hero' | 'cards' | 'activity' | 'text'
  count?: number
}>(), {
  count: 3,
})
</script>

<style scoped>
.ui-skeleton {
  width: 100%;
}

/* Animate all bars */
.ui-skeleton__bar,
.ui-skeleton__dot,
.ui-skeleton__badge,
.ui-skeleton__circle {
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Workflow */
.ui-skeleton__workflow { display: flex; flex-direction: column; gap: 0; }
.ui-skeleton__workflow-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
}
.ui-skeleton__dot {
  width: 14px; height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}
.ui-skeleton__bars { flex: 1; min-width: 0; }
.ui-skeleton__bar--title { height: 16px; margin-bottom: 6px; }
.ui-skeleton__bar--detail { height: 12px; }

/* Hero */
.ui-skeleton__hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 32px;
  background: #e2e8f0;
  border-radius: 16px;
  height: 96px;
}
.ui-skeleton__hero-metrics { display: flex; gap: 20px; }
.ui-skeleton__hero-metric { text-align: center; }

/* Cards */
.ui-skeleton__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
.ui-skeleton__card {
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}
.ui-skeleton__card-row { display: flex; justify-content: space-between; }
.ui-skeleton__badge {
  width: 48px; height: 20px;
  border-radius: 6px;
}

/* Activity */
.ui-skeleton__activity { background: #fff; border-radius: 12px; overflow: hidden; }
.ui-skeleton__activity-item {
  display: flex;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid #f1f5f9;
}
.ui-skeleton__activity-item:last-child { border-bottom: none; }
.ui-skeleton__circle {
  width: 28px; height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
