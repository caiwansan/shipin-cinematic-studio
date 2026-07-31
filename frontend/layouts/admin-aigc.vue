<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <div class="h-screen flex flex-col">
      <!-- Top bar -->
      <header class="h-12 bg-[#0D1328] border-b border-[#1A2240] flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-3">
          <span class="text-base">🎬</span>
          <NuxtLink to="/admin/aigc/overview" class="text-sm font-semibold text-white/80 no-underline hover:text-white">Director OS Admin</NuxtLink>
          <span class="flex items-center gap-1.5"><img src="/logo.png" style="height:16px;width:auto;display:inline-block;vertical-align:middle" alt=""/> 昆仑镜 <span class="text-[10px] text-gray-600">v1.2</span></span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[11px] text-gray-500">系统正常</span>
          <button @click="logout" class="text-[11px] text-gray-500 hover:text-red-400 transition cursor-pointer bg-transparent border-none">退出</button>
        </div>
      </header>

      <!-- Body: left sidebar + right content -->
      <div class="flex flex-1 min-h-0">
        <!-- Sidebar -->
        <aside class="w-52 bg-[#0A0F1E] border-r border-[#1A2240] flex flex-col shrink-0">
          <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            <template v-for="sec in nav" :key="sec.id">
              <!-- 单链接（控制台） -->
              <NuxtLink
                v-if="sec.kind === 'link'"
                :to="sec.to!"
                class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition cursor-pointer no-underline"
                :class="isActive(sec.to!) ? 'bg-blue-500/15 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'"
              >
                <span>{{ sec.icon }}</span>
                <span>{{ sec.label }}</span>
              </NuxtLink>

              <!-- 分组（可展开） -->
              <div v-else-if="sec.kind === 'group'" class="pt-1">
                <button
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition cursor-pointer text-gray-500 hover:text-gray-300 hover:bg-white/5 bg-transparent border-none text-left"
                  @click="toggle(sec.id)"
                >
                  <span>{{ sec.icon }}</span>
                  <span class="flex-1">{{ sec.label }}</span>
                  <span class="text-[10px] text-gray-600">{{ expanded[sec.id] ? '▾' : '▸' }}</span>
                </button>
                <div v-if="expanded[sec.id]" class="mt-0.5 ml-3 space-y-0.5 border-l border-[#1A2240] pl-2">
                  <NuxtLink
                    v-for="c in sec.children" :key="c.id"
                    :to="c.to"
                    class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer no-underline"
                    :class="isActive(c.to) ? 'bg-blue-500/15 text-blue-400' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'"
                  >
                    <span>{{ c.label }}</span>
                  </NuxtLink>
                </div>
              </div>

              <!-- Workspace 工作台管理（分组 → Workspace → 子页，三层嵌套） -->
              <div v-else-if="sec.kind === 'workspace-group'" class="pt-1">
                <button
                  class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition cursor-pointer text-gray-500 hover:text-gray-300 hover:bg-white/5 bg-transparent border-none text-left"
                  @click="toggle(sec.id)"
                >
                  <span>{{ sec.icon }}</span>
                  <span class="flex-1">{{ sec.label }}</span>
                  <span class="text-[10px] text-gray-600">{{ expanded[sec.id] ? '▾' : '▸' }}</span>
                </button>
                <div v-if="expanded[sec.id]" class="mt-0.5 ml-3 space-y-0.5 border-l border-[#1A2240] pl-2">
                  <div v-for="w in sec.workspaces" :key="'wsg-' + w.code" class="pt-0.5">
                    <!-- Workspace 占位（无子页，直接跳转入口） -->
                    <NuxtLink
                      v-if="w.children.length === 0"
                      :to="w.entry"
                      class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer no-underline"
                      :class="isActive(w.entry) ? 'bg-blue-500/15 text-blue-400' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'"
                    >
                      <span>{{ w.icon }}</span>
                      <span>{{ w.name }}</span>
                      <span class="text-[9px] text-gray-700">接入中</span>
                    </NuxtLink>
                    <!-- Workspace 有子页：可展开 -->
                    <div v-else>
                      <button
                        class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer text-gray-600 hover:text-gray-300 hover:bg-white/5 bg-transparent border-none text-left"
                        @click="toggleWs('wsg-' + w.code)"
                      >
                        <span>{{ w.icon }}</span>
                        <span class="flex-1">{{ w.name }}</span>
                        <span class="text-[10px] text-gray-700">{{ wsExpanded['wsg-' + w.code] ? '▾' : '▸' }}</span>
                      </button>
                      <div v-if="wsExpanded['wsg-' + w.code]" class="mt-0.5 ml-3 space-y-0.5 border-l border-[#1A2240] pl-2">
                        <NuxtLink
                          v-for="c in w.children" :key="c.id"
                          :to="c.to"
                          class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer no-underline"
                          :class="isActive(c.to) ? 'bg-blue-500/15 text-blue-400' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'"
                        >
                          <span>{{ c.label }}</span>
                        </NuxtLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 旧 Workspace 一级入口（已废弃，保留渲染兼容） -->
              <div v-else class="pt-1">
                <div class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs"
                  :class="isWsActive(sec) ? 'bg-blue-500/15 text-blue-400' : 'text-gray-500'">
                  <span>{{ sec.icon }}</span>
                  <span class="flex-1">{{ sec.label }}</span>
                  <span class="text-[10px] text-gray-600">{{ wsExpanded[sec.id] ? '▾' : '▸' }}</span>
                  <button
                    class="text-[10px] text-gray-600 hover:text-gray-300 transition cursor-pointer bg-transparent border-none"
                    @click.stop="toggleWs(sec.id)"
                    :title="wsExpanded[sec.id] ? '折叠' : '展开'"
                  >{{ wsExpanded[sec.id] ? '−' : '+' }}</button>
                </div>
                <div v-if="wsExpanded[sec.id]" class="mt-0.5 ml-3 space-y-0.5 border-l border-[#1A2240] pl-2">
                  <NuxtLink
                    v-for="c in sec.children" :key="c.id"
                    :to="c.to"
                    class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer no-underline"
                    :class="isActive(c.to) ? 'bg-blue-500/15 text-blue-400' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'"
                  >
                    <span>{{ c.label }}</span>
                  </NuxtLink>
                </div>
              </div>
            </template>
          </nav>
        </aside>

        <!-- Content area -->
        <main class="flex-1 overflow-auto p-6">
          <NuxtPage />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { onMounted, reactive } from 'vue'
import { buildAdminNav, type AdminNavSection } from '~/config/admin-workspace-registry'

const route = useRoute()
const router = useRouter()

// 🛡️ Token 过期检测：onMounted 时调用 /api/admin/me 验证 token 是否有效
// 注意：管理员登录使用 /api/admin/login 签发 admin JWT，必须用 /api/admin/me 验证
onMounted(async () => {
  if (!import.meta.client) return
  const token = window.localStorage?.getItem('auth_token')
  if (!token) {
    router.replace('/admin/aigc/login')
    return
  }
  try {
    const res = await fetch('/api/admin/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) {
      window.localStorage?.removeItem('auth_token')
      window.localStorage?.removeItem('auth_user')
      router.replace('/admin/aigc/login')
    }
  } catch {
    // Network error — silently ignore
  }
})

const nav: AdminNavSection[] = buildAdminNav()

// 展开状态：默认展开包含当前路由的分组
const expanded = reactive<Record<string, boolean>>({})
const wsExpanded = reactive<Record<string, boolean>>({})
for (const sec of nav) {
  if (sec.kind === 'group' && sec.children?.some(c => isActive(c.to))) expanded[sec.id] = true
  if (sec.kind === 'workspace-group') {
    // 若当前路由属于某 Workspace 子页，展开工作台组 + 该 Workspace
    const hit = sec.workspaces?.find(w => w.entry === route.path || w.children.some(c => c.to === route.path))
    if (hit) {
      expanded[sec.id] = true
      wsExpanded['wsg-' + hit.code] = true
    }
  }
  if (sec.kind === 'workspace' && (isActive(sec.to!) || sec.children?.some(c => isActive(c.to)))) wsExpanded[sec.id] = true
}

function toggle(id: string) { expanded[id] = !expanded[id] }
function toggleWs(id: string) { wsExpanded[id] = !wsExpanded[id] }

function isActive(path: string) {
  return route.path === path
}

function isWsActive(sec: AdminNavSection) {
  if (sec.kind !== 'workspace') return false
  return isActive(sec.to!) || sec.children?.some(c => isActive(c.to)) || false
}

function logout() {
  if (process.client) {
    // 使用 token-cache 统一清除（内存 + localStorage + cookie）
    import('~/utils/token-cache').then(m => { m.clearAuth(); window.location.href = '/admin/aigc/login' })
  }
}
</script>
