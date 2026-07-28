/**
 * components/WorkspaceSwitcher.vue — 多工作空间切换器
 *
 * Sprint-08 Phase C: Multi-Workspace 能力
 * Sprint-Enterprise-Identity-Hardening-01 Phase 6:
 * - hasEnterprise=true → 创建招聘空间
 * - hasEnterprise=false → 创建企业（onboarding）
 */

<template>
  <div class="workspace-switcher">
    <!-- 当前工作空间显示 -->
    <div
      class="workspace-current"
      @click="toggleDropdown"
      :class="{ open: dropdownOpen }"
    >
      <div class="workspace-info">
        <span class="workspace-name">
          {{ currentWorkspace?.name || '选择工作空间' }}
        </span>
        <span class="workspace-enterprise" v-if="currentEnterprise">
          {{ currentEnterprise.name }}
        </span>
      </div>
      <span class="workspace-arrow">▼</span>
    </div>

    <!-- 下拉列表 -->
    <div v-if="dropdownOpen" class="workspace-dropdown">
      <div class="dropdown-header">
        <span>切换工作空间</span>
      </div>

      <div class="dropdown-list">
        <div
          v-for="ws in workspaces"
          :key="ws.id"
          class="dropdown-item"
          :class="{ active: ws.id === currentWorkspace?.id }"
          @click="handleSwitch(ws)"
        >
          <div class="item-info">
            <span class="item-name">{{ ws.name }}</span>
            <span class="item-enterprise">{{ ws.enterpriseName }}</span>
          </div>
          <span v-if="ws.id === currentWorkspace?.id" class="item-check">✓</span>
        </div>
      </div>

      <div v-if="workspaces.length === 0" class="dropdown-empty">
        暂无可用工作空间
      </div>

      <div class="dropdown-footer">
        <!-- Phase 6: 根据 hasEnterprise 显示不同按钮 -->
        <button class="footer-btn" @click="handleCreateWorkspace">
          {{ hasEnterprise ? '+ 创建招聘空间' : '+ 创建企业' }}
        </button>
      </div>
    </div>

    <!-- 切换中 Loading -->
    <div v-if="switching" class="switching-overlay">
      <div class="switching-spinner"></div>
      <span>切换中...</span>
    </div>

    <!-- 错误提示 -->
    <div v-if="switchError" class="switch-error">
      {{ switchError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useIdentityStore } from '~/stores/identity'

const identityStore = useIdentityStore()

const dropdownOpen = ref(false)
const workspaces = ref<any[]>([])
const switching = ref(false)
const switchError = ref('')

// Current workspace from Identity Store
const currentWorkspace = identityStore.currentWorkspace
const currentEnterprise = identityStore.currentEnterprise

// Phase 6: 判断用户是否已有企业
const hasEnterprise = computed(() => identityStore.hasEnterprise)

// Toggle dropdown
function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
  if (dropdownOpen.value) {
    loadWorkspaces()
  }
}

// Load workspace list
async function loadWorkspaces() {
  const list = await identityStore.fetchWorkspaces()
  workspaces.value = list
}

// Handle workspace switch
async function handleSwitch(ws: any) {
  if (ws.id === currentWorkspace.value?.id) {
    dropdownOpen.value = false
    return
  }

  switching.value = true
  switchError.value = ''

  try {
    const success = await identityStore.switchWorkspace(ws.id)

    if (success) {
      dropdownOpen.value = false
      // Reload page data without F5
      window.dispatchEvent(new CustomEvent('workspace-switched', {
        detail: { workspaceId: ws.id }
      }))
    } else {
      switchError.value = identityStore.error || '切换失败'
    }
  } catch (e: any) {
    switchError.value = e.message || '切换失败'
  } finally {
    switching.value = false
  }
}

// Phase 6: 根据 hasEnterprise 决定跳转目标
function handleCreateWorkspace() {
  dropdownOpen.value = false
  if (hasEnterprise.value) {
    // 已有企业 → 创建招聘空间
    window.location.href = '/workspace/enterprise/onboarding?mode=new-workspace'
  } else {
    // 无企业 → 创建企业（完整 onboarding）
    window.location.href = '/workspace/enterprise/onboarding'
  }
}

// Close dropdown when clicking outside
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.workspace-switcher')) {
    dropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.workspace-switcher {
  position: relative;
  display: inline-block;
  min-width: 200px;
}

.workspace-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.workspace-current:hover {
  border-color: #4a4a8a;
}

.workspace-current.open {
  border-color: #6a6aba;
}

.workspace-info {
  display: flex;
  flex-direction: column;
}

.workspace-name {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0ff;
}

.workspace-enterprise {
  font-size: 11px;
  color: #8888aa;
}

.workspace-arrow {
  font-size: 10px;
  color: #8888aa;
  transition: transform 0.2s;
}

.workspace-current.open .workspace-arrow {
  transform: rotate(180deg);
}

/* Dropdown */
.workspace-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  overflow: hidden;
}

.dropdown-header {
  padding: 10px 12px;
  font-size: 11px;
  color: #8888aa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #2a2a4a;
}

.dropdown-list {
  max-height: 240px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #2a2a4a;
}

.dropdown-item.active {
  background: #2a2a5a;
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-name {
  font-size: 13px;
  color: #e0e0ff;
}

.item-enterprise {
  font-size: 11px;
  color: #8888aa;
}

.item-check {
  color: #6a6aba;
  font-size: 14px;
}

.dropdown-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: #666688;
}

.dropdown-footer {
  border-top: 1px solid #2a2a4a;
  padding: 8px;
}

.footer-btn {
  width: 100%;
  padding: 8px;
  background: transparent;
  border: 1px dashed #4a4a8a;
  border-radius: 6px;
  color: #8888cc;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn:hover {
  border-color: #6a6aba;
  color: #aaaaff;
}

/* Switching overlay */
.switching-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  gap: 12px;
}

.switching-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #2a2a4a;
  border-top-color: #6a6aba;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.switching-overlay span {
  font-size: 13px;
  color: #aaaacc;
}

/* Error */
.switch-error {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  padding: 8px 12px;
  background: #3a1a1a;
  border: 1px solid #6a2a2a;
  border-radius: 6px;
  font-size: 12px;
  color: #ff6666;
  z-index: 1001;
}
</style>
