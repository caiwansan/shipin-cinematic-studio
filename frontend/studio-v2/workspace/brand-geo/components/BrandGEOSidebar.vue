<template>
  <aside class="geo-sidebar">
    <a href="/" class="geo-brand-logo" title="返回首页">
      <span class="geo-brand-icon">🌐</span>
      <span class="geo-brand-name">品牌GEO</span>
    </a>

    <nav class="geo-sidebar-nav">
      <!-- Consumer navigation (always visible) -->
      <div
        v-for="item in consumerMenuItems"
        :key="item.id"
        class="geo-sidebar-item"
        :class="{ active: item.id === activePanelId }"
        @click="navigate(item.id)"
      >
        <span class="geo-sidebar-icon">{{ item.icon }}</span>
        <span class="geo-sidebar-label">{{ item.label }}</span>
      </div>

      <!-- Advanced section (collapsible) -->
      <template v-if="showAdvanced">
        <div class="geo-nav-section-divider"></div>
        <div class="geo-nav-section-label">高级功能</div>
        <div
          v-for="item in advancedMenuItems"
          :key="item.id"
          class="geo-sidebar-item geo-sidebar-item--advanced"
          :class="{ active: item.id === activePanelId }"
          @click="navigate(item.id)"
        >
          <span class="geo-sidebar-icon">{{ item.icon }}</span>
          <span class="geo-sidebar-label">{{ item.label }}</span>
        </div>
      </template>
    </nav>

    <div class="geo-sidebar-footer">
      <!-- Beginner/Expert toggle -->
      <div class="geo-sidebar-mode-toggle" @click="toggleMode">
        <span class="geo-mode-icon">{{ isExpert ? '🔬' : '🌟' }}</span>
        <span class="geo-mode-label">{{ isExpert ? '专家模式' : '简易模式' }}</span>
        <span class="geo-mode-arrow">{{ isExpert ? '◁' : '▷' }}</span>
      </div>

      <div class="geo-sidebar-footer-card" @click="goHome">
        <span class="geo-footer-icon">🏠</span>
        <span class="geo-footer-label">返回首页</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { GEO_CONSUMER_MENU, GEO_ADVANCED_MENU } from '~/studio-v2/workspace/brand-geo/config/sidebar'
import type { SidebarMenuItem } from '~/studio-v2/types/geo'

const props = defineProps<{
  activePanelId: GeoPanelId
}>()

const emit = defineEmits<{
  navigate: [panelId: GeoPanelId]
}>()

const MODE_KEY = 'geo-mode'

const isExpert = ref(false)

onMounted(() => {
  try {
    const stored = localStorage.getItem(MODE_KEY)
    isExpert.value = stored === 'expert'
  } catch { /* ignore */ }
})

const consumerMenuItems: SidebarMenuItem[] = GEO_CONSUMER_MENU
const advancedMenuItems: SidebarMenuItem[] = GEO_ADVANCED_MENU

const showAdvanced = computed(() => isExpert.value)

function toggleMode() {
  isExpert.value = !isExpert.value
  try {
    localStorage.setItem(MODE_KEY, isExpert.value ? 'expert' : 'beginner')
  } catch { /* ignore */ }
}

function navigate(panelId: string) {
  emit('navigate', panelId as GeoPanelId)
}

function goHome() {
  window.location.href = '/'
}
</script>

<style scoped>
.geo-sidebar {
  width: 220px;
  min-width: 220px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: #0a0a12;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.geo-brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 16px 14px;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.geo-brand-logo:hover { opacity: 0.85; }
.geo-brand-icon { font-size: 24px; }
.geo-brand-name {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 1px;
}

.geo-sidebar-nav {
  flex: 1;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.geo-nav-section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  padding: 12px 12px 4px;
  letter-spacing: 1px;
}

.geo-nav-section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 8px 12px;
}

.geo-sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  font-size: 13px;
  color: #9ca3af;
}
.geo-sidebar-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #d1d5db;
}
.geo-sidebar-item.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
}
.geo-sidebar-item--advanced {
  font-size: 12px;
  color: #6b7280;
}
.geo-sidebar-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}
.geo-sidebar-label {
  flex: 1;
  font-weight: 500;
}

/* ── Mode Toggle ── */
.geo-sidebar-mode-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 4px;
}
.geo-sidebar-mode-toggle:hover {
  background: rgba(99,102,241,0.08);
  border-color: rgba(99,102,241,0.2);
}
.geo-mode-icon { font-size: 14px; }
.geo-mode-label { flex: 1; font-size: 12px; font-weight: 600; color: #9ca3af; }
.geo-mode-arrow { font-size: 12px; color: #6b7280; }

/* ── Footer ── */
.geo-sidebar-footer {
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geo-sidebar-footer-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  color: #6b7280;
  font-size: 12px;
}
.geo-sidebar-footer-card:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #9ca3af;
}
.geo-footer-icon { font-size: 14px; }
.geo-footer-label { font-weight: 500; }
</style>
