<template><NuxtLayout name="workbench"><div class="max-w-6xl space-y-4">
  <h2 class="text-lg font-medium text-gray-200">🤖 Agent 管理</h2>
  <table class="w-full text-sm bg-gray-900 rounded-lg border border-gray-800">
    <thead><tr class="text-left text-gray-500 border-b border-gray-800"><th class="p-3 font-medium">Agent</th><th class="p-3 font-medium">能力</th><th class="p-3 font-medium">状态</th><th class="p-3 font-medium">配额</th></tr></thead>
    <tbody>
      <tr v-for="a in agents" :key="a.id" class="border-b border-gray-800/50 hover:bg-gray-800/30">
        <td class="p-3 text-gray-200 font-mono text-xs">{{ a.id }}</td>
        <td class="p-3 text-gray-400 text-xs">{{ a.capabilities.join(', ') }}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded text-xs" :class="a.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'">{{ a.status }}</span></td>
        <td class="p-3 text-gray-400 text-xs">{{ a.quota }}</td>
      </tr>
    </tbody>
  </table>
</div></NuxtLayout></template>
<script setup lang="ts">
const agents = [
  { id: 'agent_writer_01', capabilities: ['text-gen', 'rewrite', 'summarize'], status: 'active', quota: '1000/day' },
  { id: 'agent_editor_02', capabilities: ['diff', 'merge', 'validate'], status: 'active', quota: '500/day' },
  { id: 'agent_repair_01', capabilities: ['detect', 'plan', 'repair'], status: 'idle', quota: '200/day' },
]
</script>
