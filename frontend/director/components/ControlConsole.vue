<template>
  <div class="control-console">
    <div class="console-row">
      <button class="ctrl-btn primary" @click="$emit('run')" :disabled="running">
        <span v-if="running">⏳</span>
        <span v-else>▶</span>
        运行故事
      </button>

      <button class="ctrl-btn" @click="$emit('tick')" :disabled="!running">
        ⏭ 单步
      </button>

      <div class="ctrl-group">
        <button class="ctrl-btn small" @click="startAuto" :disabled="!running || autoActive">
          ▶ 自动
        </button>
        <button class="ctrl-btn small" @click="$emit('stop-auto')" :disabled="!autoActive">
          ⏹ 停止
        </button>
      </div>

      <div class="ctrl-spacer"></div>

      <button class="ctrl-btn" @click="$emit('export')" :disabled="!running">
        📤 导出
      </button>

      <button class="ctrl-btn primary" @click="$emit('start-production')" :disabled="!running">
        🎬 开始制作
      </button>

      <button class="ctrl-btn danger" @click="$emit('reset')">
        ⏮ 重置
      </button>

      <button class="ctrl-btn danger" @click="$emit('stop')">
        ⏹ 停止
      </button>
    </div>

    <!-- Tick 间隔滑块 -->
    <div class="console-row sub-row">
      <label class="speed-label">Tick 间隔</label>
      <input
        type="range"
        min="200"
        max="3000"
        step="100"
        :value="tickInterval"
        @input="$emit('update:tickInterval', Number(($event.target as HTMLInputElement).value))"
        class="speed-slider"
      />
      <span class="speed-value">{{ (tickInterval / 1000).toFixed(1) }}s</span>
      <span class="status-indicator" :class="{ connected: connected }">SSE</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  running: boolean
  autoActive: boolean
  connected: boolean
  tickInterval: number
}>()
defineEmits<{
  run: []
  tick: []
  startAuto: []
  'stop-auto': []
  export: []
  reset: []
  stop: []
  'start-production': []
  'update:tickInterval': [v: number]
}>()

function startAuto() {
  // 父层处理 startAuto
}
</script>

<style scoped>
.control-console {
  background: #0f0f18; border: 1px solid #1e1e2e; border-radius: 10px;
  padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;
}
.console-row {
  display: flex; align-items: center; gap: 8px;
}
.ctrl-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 14px; border-radius: 8px; border: 1px solid #2a2a3e;
  background: #181825; color: #c0c0d0; font-size: 0.82rem;
  cursor: pointer; transition: all 0.2s;
}
.ctrl-btn:hover { border-color: #3a3a5e; background: #1e1e30; }
.ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ctrl-btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.ctrl-btn.primary:disabled { background: #1e3a5f; border-color: #1e3a5f; }
.ctrl-btn.danger { border-color: #7f1d1d; color: #fca5a5; }
.ctrl-btn.small { padding: 5px 10px; font-size: 0.75rem; }
.ctrl-group { display: flex; gap: 4px; }
.ctrl-spacer { flex: 1; }
.sub-row { justify-content: flex-end; gap: 8px; }
.speed-label { font-size: 0.75rem; color: #666; }
.speed-slider { width: 80px; accent-color: #60a5fa; }
.speed-value { font-size: 0.75rem; color: #888; min-width: 32px; }
.status-indicator {
  padding: 2px 8px; border-radius: 4px; font-size: 0.65rem;
  background: #2a2a3e; color: #666; text-transform: uppercase;
}
.status-indicator.connected { background: #064e3b; color: #4ade80; }
</style>
