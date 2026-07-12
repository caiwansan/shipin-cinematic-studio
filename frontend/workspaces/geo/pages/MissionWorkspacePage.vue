<!--
MissionWorkspacePage.vue — GEO Workspace Mission Page

This is the home page of the GEO Workspace.
Shows loading skeleton, mission cards with summary badge, or empty state.
All data comes from the real API via useMissionStore.
-->
<template>
  <div class="mwsp">
    <!-- Loading Skeleton -->
    <div v-if="store.loading" class="mwsp-skeleton">
      <div class="skeleton-badge" />
      <div class="skeleton-cards">
        <div v-for="n in 3" :key="n" class="skeleton-card" />
      </div>
    </div>

    <!-- Loaded with missions -->
    <template v-else-if="store.hasMissions">
      <div class="mwsp__header">
        <MissionSummaryBadge :summary="store.summary" />
      </div>
      <MissionCardList
        :missions="store.missions"
        @action="handleAction"
      />
    </template>

    <!-- Empty state -->
    <MissionEmptyState v-else />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMissionStore } from '../stores/useMissionStore'
import type { Mission } from '../types/mission'
import MissionSummaryBadge from '../components/mission/MissionSummaryBadge.vue'
import MissionCardList from '../components/mission/MissionCardList.vue'
import MissionEmptyState from '../components/mission/MissionEmptyState.vue'

const router = useRouter()
const store = useMissionStore()

// Route map: action label → GEO workspace path
const ACTION_ROUTES: Record<string, string> = {
  '编辑品牌资料': '/workspace/geo/dashboard',
  '开始扫描': '/workspace/geo/discovery',
  '前往知识库': '/workspace/geo/knowledge',
  '查看优化建议': '/workspace/geo/recommendations',
  '前往验证': '/workspace/geo/verification',
  '稍后处理': '', // no-op
}

function handleAction(mission: Mission) {
  const action = mission.actions[0]
  if (!action) return

  if (action.label === '稍后处理') return

  const route = ACTION_ROUTES[action.label]
  if (route) {
    router.push(route)
  } else {
    // Fallback: try to navigate based on action type
    console.warn('[MissionWorkspacePage] unknown action label:', action.label)
  }
}

onMounted(() => {
  store.load()
})
</script>

<style scoped>
.mwsp {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 0 32px;
}

.mwsp__header {
  margin-bottom: 24px;
}

/* ===== Skeleton ===== */
.mwsp-skeleton {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.skeleton-badge {
  width: 320px;
  height: 44px;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: 100px;
}

.skeleton-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.skeleton-card {
  height: 240px;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: 8px;
}

@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
