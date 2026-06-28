<template>
  <NuxtLayout name="workbench">
    <div class="max-w-6xl space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-gray-200">👥 用户管理</h2>
        <button class="px-4 py-2 bg-cyan-800 hover:bg-cyan-700 text-white rounded-lg text-sm">+ 添加用户</button>
      </div>
      <table class="w-full text-sm bg-gray-900 rounded-lg border border-gray-800">
        <thead><tr class="text-left text-gray-500 border-b border-gray-800"><th class="p-3 font-medium">用户</th><th class="p-3 font-medium">角色</th><th class="p-3 font-medium">Workspace</th><th class="p-3 font-medium">状态</th></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-b border-gray-800/50 hover:bg-gray-800/30">
            <td class="p-3"><span class="text-gray-200">{{ u.name }}</span><span class="text-xs text-gray-600 ml-2">{{ u.email }}</span></td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-xs" :class="u.role === 'admin' ? 'bg-purple-900/50 text-purple-400' : 'bg-gray-800 text-gray-400'">{{ u.role }}</span></td>
            <td class="p-3 text-gray-400">{{ u.workspace }}</td>
            <td class="p-3"><span class="text-green-400">●</span> 活跃</td>
          </tr>
        </tbody>
      </table>
    </div>
  </NuxtLayout>
</template>
<script setup lang="ts">
const users = [
  { id: 1, name: 'admin', email: 'admin@pangu.io', role: 'admin', workspace: 'system' },
  { id: 2, name: 'dev-01', email: 'dev1@pangu.io', role: 'developer', workspace: 'dev' },
  { id: 3, name: 'ops-01', email: 'ops1@pangu.io', role: 'operator', workspace: 'production' },
]
</script>
