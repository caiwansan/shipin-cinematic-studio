<template>
  <div class="r11-stability-dashboard">
    <div class="dashboard-header">
      <h2>Stability Control Layer</h2>
      <span class="phase-tag">Phase 4</span>
    </div>

    <!-- Drift Policy Cards -->
    <div class="section">
      <div class="section-title">Drift Policies</div>
      <div class="card-grid">
        <div v-for="policy in driftPolicies" :key="policy.domain" class="policy-card">
          <div class="card-header">
            <span class="domain-name">{{ policy.domain }}</span>
            <span :class="['status-badge', policy.enabled ? 'enabled' : 'disabled']">
              {{ policy.enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          <div class="card-body">
            <div class="threshold-row">
              <span>Warn: <strong>{{ (policy.warnThreshold * 100).toFixed(0) }}%</strong></span>
              <span>Block: <strong>{{ (policy.blockThreshold * 100).toFixed(0) }}%</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SLA Table -->
    <div class="section">
      <div class="section-title">Stability SLAs</div>
      <table class="sla-table">
        <thead>
          <tr>
            <th>Domain</th>
            <th>Baseline</th>
            <th>Drift Budget</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sla in slas" :key="sla.domain">
            <td>{{ sla.domain }}</td>
            <td>{{ (sla.baselineFidelity * 100).toFixed(0) }}%</td>
            <td>±{{ (sla.driftBudget * 100).toFixed(0) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Adapter Governance -->
    <div class="section">
      <div class="section-title">Adapter Versions</div>
      <div class="adapter-list">
        <div v-for="adapter in adapters" :key="adapter.domain" class="adapter-row">
          <span class="domain-name">{{ adapter.domain }}</span>
          <span class="version-tag">@{{ adapter.version }}</span>
          <span :class="['lock-badge', adapter.locked ? 'locked' : 'unlocked']">
            {{ adapter.locked ? '🔒 Locked' : '🔓 Unlocked' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Evaluation -->
    <div class="section">
      <div class="section-title">Evaluate Stability</div>
      <div class="eval-controls">
        <select v-model="evalDomain" class="eval-select">
          <option v-for="sla in slas" :key="sla.domain" :value="sla.domain">{{ sla.domain }}</option>
        </select>
        <button class="eval-btn" @click="runEvaluation">Evaluate</button>
      </div>
      <div class="eval-result" v-if="evalResult">
        <div class="result-row">
          <span>Drift:</span>
          <span :class="statusClass(evalResult.drift.status)">{{ evalResult.drift.status }}</span>
        </div>
        <div class="result-row">
          <span>SLA:</span>
          <span :class="evalResult.sla.ok ? 'state-ok' : 'state-fail'">
            {{ evalResult.sla.ok ? 'OK' : 'Violated' }}
            (deviation: {{ (evalResult.sla.deviation * 100).toFixed(2) }}%)
          </span>
        </div>
        <div class="result-row">
          <span>Adapter:</span>
          <span>{{ evalResult.adapterLocked ? '🔒 Locked' : '🔓 Unlocked' }}</span>
        </div>
        <div class="result-overall" :class="evalResult.evaluationPassed ? 'state-ok' : 'state-fail'">
          {{ evalResult.evaluationPassed ? '✅ All checks passed' : '❌ Stability constraints violated' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'

interface DriftPolicy { domain: string; warnThreshold: number; blockThreshold: number; enabled: boolean }
interface SLA { domain: string; baselineFidelity: number; driftBudget: number }
interface Adapter { domain: string; version: string; locked: boolean }

interface PoliciesResponse {
  driftPolicies: DriftPolicy[]
  slas: SLA[]
  adapters: Adapter[]
}

interface StabilityEvaluation {
  domain: string
  drift: { status: string; reason?: string }
  sla: { ok: boolean; deviation: number }
  adapterLocked: boolean
  evaluationPassed: boolean
}

export default defineComponent({
  name: 'StabilityDashboard',
  setup() {
    const driftPolicies = ref<DriftPolicy[]>([])
    const slas = ref<SLA[]>([])
    const adapters = ref<Adapter[]>([])
    const evalDomain = ref('')
    const evalResult = ref<StabilityEvaluation | null>(null)

    async function loadPolicies() {
      const res = await fetch('/api/r11/stability/policies')
      if (res.ok) {
        const data: PoliciesResponse = await res.json()
        driftPolicies.value = data.driftPolicies
        slas.value = data.slas
        adapters.value = data.adapters
        if (slas.value.length > 0) evalDomain.value = slas.value[0].domain
      }
    }

    async function runEvaluation() {
      const res = await fetch('/api/r11/stability/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: evalDomain.value,
          fidelity: 0.99,  // for demonstration
          history: [1.0, 1.0, 0.99, 0.99],
        }),
      })
      if (res.ok) {
        evalResult.value = await res.json()
      }
    }

    function statusClass(status: string): string {
      if (status === 'OK') return 'state-ok'
      if (status === 'WARN') return 'state-warn'
      if (status === 'BLOCK') return 'state-fail'
      return ''
    }

    onMounted(loadPolicies)

    return {
      driftPolicies, slas, adapters,
      evalDomain, evalResult,
      runEvaluation, statusClass,
    }
  },
})
</script>

<style scoped>
.r11-stability-dashboard {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  color: #e0e0e0;
  font-family: monospace;
}
.dashboard-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.dashboard-header h2 {
  margin: 0;
  font-size: 18px;
}
.phase-tag {
  background: #1565c0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.section {
  margin-bottom: 20px;
}
.section-title {
  color: #90caf9;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
}
.policy-card {
  background: #16213e;
  border-radius: 6px;
  padding: 10px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.domain-name {
  color: #4fc3f7;
  font-size: 13px;
  font-weight: bold;
}
.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
}
.status-badge.enabled { background: #1b5e20; color: #4caf50; }
.status-badge.disabled { background: #424242; color: #9e9e9e; }
.threshold-row {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #b0bec5;
}
.sla-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.sla-table th, .sla-table td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid #333;
}
.sla-table th {
  color: #78909c;
  font-weight: normal;
}
.adapter-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.adapter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #16213e;
  border-radius: 4px;
  font-size: 12px;
}
.version-tag {
  background: #0d2137;
  color: #90caf9;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
}
.lock-badge { margin-left: auto; font-size: 11px; }
.lock-badge.locked { color: #ff9800; }
.lock-badge.unlocked { color: #4caf50; }
.eval-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.eval-select {
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
}
.eval-btn {
  background: #1565c0;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  font-family: monospace;
}
.eval-result {
  background: #16213e;
  border-radius: 6px;
  padding: 10px;
}
.result-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
}
.state-ok { color: #4caf50; }
.state-warn { color: #ff9800; }
.state-fail { color: #f44336; }
.result-overall {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #333;
  font-weight: bold;
  font-size: 13px;
  text-align: center;
}
</style>
