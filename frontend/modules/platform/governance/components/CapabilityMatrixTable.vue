<template>
  <div class="capability-matrix">
    <h3>🔑 Capability × Plan Matrix</h3>
    <table class="cm-table" v-if="plans.length">
      <thead>
        <tr>
          <th>Capability</th>
          <th v-for="plan in plans" :key="plan.id">{{ plan.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cap in allCapabilities" :key="cap">
          <td><code>{{ cap }}</code></td>
          <td v-for="plan in plans" :key="plan.id">
            <span class="cm-check" v-if="hasCapability(plan, cap)">✅</span>
            <span class="cm-cross" v-else>❌</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="cm-empty">No plans loaded.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SubscriptionPlanDTO } from '../types/index.js'

const props = defineProps<{
  plans: SubscriptionPlanDTO[]
}>()

const allCapabilities = computed(() => {
  const set = new Set<string>()
  for (const plan of props.plans) {
    const caps = plan.capabilities
    if (caps && typeof caps === 'object') {
      Object.keys(caps).forEach(c => set.add(c))
    }
  }
  return Array.from(set).sort()
})

function hasCapability(plan: SubscriptionPlanDTO, capability: string): boolean {
  return plan.capabilities && typeof plan.capabilities === 'object' && capability in plan.capabilities
}
</script>

<style scoped>
.capability-matrix { padding: 16px; overflow-x: auto; }
.cm-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
.cm-table th, .cm-table td { padding: 8px 12px; border: 1px solid #e0e0e0; text-align: left; }
.cm-table th { background: #f5f5f5; font-weight: 600; white-space: nowrap; }
.cm-table code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.85em; }
.cm-check { font-size: 1.1em; }
.cm-cross { font-size: 1.1em; }
.cm-empty { color: #888; padding: 20px; text-align: center; }
</style>
