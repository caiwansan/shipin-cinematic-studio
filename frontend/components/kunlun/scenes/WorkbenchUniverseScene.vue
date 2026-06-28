<template>
  <section ref="sceneRef" class="workbench-scene">
    <div class="workbench-container">
      <!-- 标题 -->
      <div ref="titleRef" class="workbench-title">
        <h2>{{ data.title }}</h2>
        <p v-if="data.subtitle" class="workbench-subtitle">
          {{ data.subtitle }}
        </p>
      </div>

      <!-- Bento Grid -->
      <div
        ref="gridRef"
        class="workbench-grid"
        :class="`layout-${data.layout}`"
      >
        <RealmCard
          v-for="realm in data.realms"
          :key="realm.id"
          :realm="realm"
          class="workbench-cell"
          :class="`cell-${realm.id}`"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
console.log('[WorkbenchUniverseScene] setup')
/**
 * WorkbenchUniverseScene — Bento Grid 展示创世五境
 *
 * 层级：L4 scenes
 * 用途：标题 + RealmCard 网格。layout 控制排列方式。
 * 组合：RealmCard
 */

import { useMotion } from '~/composables/kunlun/useMotion'
import type { WorkbenchUniverseSceneData } from '~/types/kunlun/scene'
import { DEFAULT_HOMEPAGE_DATA } from '~/types/kunlun/scene'
import RealmCard from '~/components/kunlun/cards/RealmCard.vue'

const props = withDefaults(defineProps<{
  data?: WorkbenchUniverseSceneData
}>(), {
  data: () => DEFAULT_HOMEPAGE_DATA.workbench,
})

const sceneRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

onMounted(() => {
    console.log('[WorkbenchUniverseScene] mounted')
  const { useScrollTrigger } = useMotion()

  useScrollTrigger(titleRef.value, {
    opacity: { from: 0, to: 1 },
    y: { from: 30, to: 0 },
    duration: 0.8,
  })

  useScrollTrigger(gridRef.value, {
    opacity: { from: 0, to: 1 },
    duration: 0.8,
    delay: 0.2,
  })
})
</script>

<style scoped>
.workbench-scene {
  position: relative;
  padding: 100px 24px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(14, 29, 49, 0.3) 0%,
    transparent 100%
  );
}

.workbench-container {
  max-width: 1100px;
  margin: 0 auto;
}

.workbench-title {
  text-align: center;
  margin-bottom: 56px;
}

.workbench-title h2 {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 600;
  color: #F8F6F1;
  margin: 0 0 12px;
}

.workbench-subtitle {
  font-size: 1.05rem;
  color: rgba(248, 246, 241, 0.5);
  margin: 0;
}

/* Bento Grid */
.workbench-grid {
  display: grid;
  gap: 20px;
}

.layout-bento {
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto;
}

/* Cell 布局 */
.cell-drama {
  grid-column: span 2;
  grid-row: span 2;
}
.cell-novel {
  grid-column: span 2;
}
.cell-ppt {
  grid-column: span 1;
  grid-row: span 2;
}
.cell-music {
  grid-column: span 1;
}
.cell-ad {
  grid-column: span 2;
}

@media (max-width: 900px) {
  .layout-bento {
    grid-template-columns: repeat(2, 1fr);
  }
  .cell-drama {
    grid-column: span 2;
  }
  .cell-ppt {
    grid-column: span 2;
    grid-row: auto;
  }
}

@media (max-width: 540px) {
  .layout-bento {
    grid-template-columns: 1fr;
  }
  .cell-drama,
  .cell-novel,
  .cell-ppt,
  .cell-music,
  .cell-ad {
    grid-column: span 1;
  }
}
</style>
