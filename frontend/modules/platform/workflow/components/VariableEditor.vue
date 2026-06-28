<template>
  <div class="variable-editor">
    <div class="editor-header">
      <h3>变量编辑器</h3>
      <div class="editor-actions">
        <button class="btn btn-primary" @click="saveVariables" :disabled="!hasChanges">保存</button>
        <button class="btn btn-secondary" @click="addVariable">+ 添加变量</button>
      </div>
    </div>

    <!-- Scope selector -->
    <div class="scope-selector">
      <button
        v-for="scope in scopes"
        :key="scope.value"
        :class="['scope-btn', { active: selectedScope === scope.value }]"
        @click="selectedScope = scope.value"
      >
        {{ scope.label }}
      </button>
    </div>

    <!-- Variable list -->
    <div class="variable-list" v-if="filteredVariables.length > 0">
      <div v-for="(v, index) in filteredVariables" :key="index" class="variable-row">
        <input
          v-model="v.name"
          class="var-name"
          placeholder="变量名"
          @input="markChanged"
        />
        <input
          v-model="v.value"
          class="var-value"
          placeholder="值"
          @input="markChanged"
        />
        <button class="btn-icon" @click="removeVariable(index)" title="删除">✕</button>
      </div>
    </div>

    <div v-else class="empty-variables">
      <p>{{ selectedScope }} 作用域没有变量</p>
    </div>

    <!-- Template reference help -->
    <div class="template-help">
      <h4>模板引用</h4>
      <p>在工作流节点配置中使用 <code>{{ '${variableName}' }}</code> 引用变量</p>
      <div class="example-refs">
        <div v-for="ref in variableRefs" :key="ref" class="ref-chip">
          <code>{{ ref }}</code>
        </div>
      </div>
      <p class="example">{{ '${scene.title}' }}</p>
      <p class="example">{{ '${video.url}' }}</p>
      <p class="example">{{ '${cost.total}' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  variables: Record<string, Record<string, string>>
}>()

const emit = defineEmits<{
  save: [variables: Record<string, Record<string, string>>]
}>()

const scopes = [
  { value: 'global', label: '全局' },
  { value: 'workflow', label: '工作流' },
  { value: 'node', label: '节点' },
  { value: 'output', label: '输出' },
  { value: 'environment', label: '环境' },
]

const selectedScope = ref('workflow')
const hasChanges = ref(false)
const localVariables = ref<Record<string, Record<string, string>>>({})

// Initialize local copy
function initLocalVars() {
  localVariables.value = JSON.parse(JSON.stringify(props.variables || {}))
}
initLocalVars()

watch(() => props.variables, () => {
  initLocalVars()
})

const filteredVariables = computed({
  get: () => {
    const scopeVars = localVariables.value[selectedScope.value]
    if (!scopeVars) return []
    return Object.entries(scopeVars).map(([name, value]) => ({ name, value }))
  },
  set: (items) => {
    const scopeVars: Record<string, string> = {}
    for (const item of items) {
      if (item.name) scopeVars[item.name] = item.value
    }
    localVariables.value[selectedScope.value] = scopeVars
  },
})

const variableRefs = computed(() => {
  const refs: string[] = []
  for (const [scope, vars] of Object.entries(localVariables.value)) {
    for (const name of Object.keys(vars)) {
      refs.push(`\${${name}}`)
    }
  }
  return refs.slice(0, 10)
})

function addVariable() {
  if (!localVariables.value[selectedScope.value]) {
    localVariables.value[selectedScope.value] = {}
  }
  const key = `var_${Date.now()}`
  localVariables.value[selectedScope.value][key] = ''
  hasChanges.value = true
}

function removeVariable(index: number) {
  const vars = localVariables.value[selectedScope.value]
  if (!vars) return
  const entries = Object.entries(vars)
  if (index < entries.length) {
    delete vars[entries[index][0]]
  }
  hasChanges.value = true
}

function markChanged() {
  hasChanges.value = true
}

function saveVariables() {
  emit('save', localVariables.value)
  hasChanges.value = false
}
</script>

<style scoped>
.variable-editor {
  padding: 12px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.editor-header h3 {
  margin: 0;
  font-size: 16px;
  color: #e0e0e0;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.scope-selector {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.scope-btn {
  padding: 4px 10px;
  border: 1px solid #444;
  border-radius: 4px;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.scope-btn.active {
  background: #2196F3;
  color: white;
  border-color: #2196F3;
}

.scope-btn:hover {
  background: rgba(33,150,243,0.2);
}

.variable-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.variable-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.var-name {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 13px;
  font-family: monospace;
}

.var-value {
  flex: 2;
  padding: 6px 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 13px;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: #333;
  color: #e0e0e0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #F44336;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary { background: #4CAF50; color: white; }
.btn-secondary { background: #333; color: #e0e0e0; border: 1px solid #555; }

.empty-variables {
  text-align: center;
  padding: 20px;
  color: #555;
}

.template-help {
  border-top: 1px solid #333;
  padding-top: 12px;
  margin-top: 12px;
}

.template-help h4 {
  font-size: 14px;
  margin: 0 0 8px;
  color: #e0e0e0;
}

.template-help p {
  font-size: 12px;
  color: #888;
  margin: 4px 0;
}

.template-help code {
  background: #16213e;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #4FC3F7;
}

.example-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0;
}

.ref-chip {
  background: #16213e;
  padding: 2px 8px;
  border-radius: 3px;
}

.example {
  font-family: monospace;
  color: #666;
}
</style>
