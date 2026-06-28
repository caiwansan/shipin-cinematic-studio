<template>
  <div class="style-admin">
    <div class="page-header">
      <h2>🎨 视觉风格管理</h2>
      <p class="page-desc">所有风格配置从数据库读取，前端/后端禁止硬编码。修改后即时生效。</p>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="loading">⏳ 加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <!-- 风格列表 -->
      <div class="style-grid">
        <div class="style-card" v-for="profile in profiles" :key="profile.name">
          <div class="card-header">
            <span class="card-icon">{{ profile.icon }}</span>
            <div class="card-title-group">
              <span class="card-name">{{ profile.displayName }}</span>
              <code class="card-code">{{ profile.name }}</code>
            </div>
            <span v-if="profile.isDefault" class="badge-default">默认</span>
          </div>

          <p class="card-desc">{{ profile.description }}</p>

          <!-- 正面修饰词 -->
          <div class="field-row">
            <label>🎨 正面修饰词</label>
            <textarea v-model="edits[profile.name].styleTokens" rows="2"></textarea>
          </div>

          <!-- 负面修饰词 -->
          <div class="field-row">
            <label>🚫 负面修饰词</label>
            <textarea v-model="edits[profile.name].negativeTokens" rows="2"></textarea>
          </div>

          <!-- 模型路由 -->
          <div class="field-row">
            <label>📡 视频模型</label>
            <div class="model-row">
              <input v-model="edits[profile.name].videoProvider" placeholder="provider" class="model-input" />
              <input v-model="edits[profile.name].videoModel" placeholder="model" class="model-input" />
            </div>
          </div>
          <div class="field-row">
            <label>🖼️ 图片模型</label>
            <div class="model-row">
              <input v-model="edits[profile.name].imageProvider" placeholder="provider" class="model-input" />
              <input v-model="edits[profile.name].imageModel" placeholder="model" class="model-input" />
            </div>
          </div>

          <!-- Prompt 覆盖 -->
          <details class="prompt-details">
            <summary>📝 Prompt 模板覆盖</summary>
            <div class="field-row">
              <label>角色设计</label>
              <textarea v-model="edits[profile.name].characterPrompt" rows="3" class="mono"></textarea>
            </div>
            <div class="field-row">
              <label>场景</label>
              <textarea v-model="edits[profile.name].scenePrompt" rows="3" class="mono"></textarea>
            </div>
            <div class="field-row">
              <label>视频</label>
              <textarea v-model="edits[profile.name].videoPrompt" rows="3" class="mono"></textarea>
            </div>
          </details>

          <!-- 操作 -->
          <div class="card-actions">
            <label class="default-toggle">
              <input type="checkbox" v-model="edits[profile.name].isDefault" />
              设为默认
            </label>
            <button class="btn-save" @click="saveProfile(profile.name)" :disabled="saving === profile.name">
              {{ saving === profile.name ? '⏳' : '💾 保存' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

interface StyleProfile {
  name: string
  displayName: string
  icon: string
  description: string
  styleTokens: string
  negativeTokens: string
  promptOverrides: Record<string, string>
  modelRoutes: { image?: any; video?: any; llm?: any }
  isDefault: boolean
}

const loading = ref(true)
const error = ref('')
const profiles = ref<StyleProfile[]>([])
const saving = ref<string | null>(null)

// 编辑状态
const edits = reactive<Record<string, any>>({})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/v1/style-profiles')
    const json = await res.json()
    if (json.success) {
      profiles.value = json.data
      // 初始化编辑状态
      for (const p of json.data) {
        edits[p.name] = {
          styleTokens: p.styleTokens,
          negativeTokens: p.negativeTokens,
          videoProvider: p.modelRoutes?.video?.provider || '',
          videoModel: p.modelRoutes?.video?.model || '',
          imageProvider: p.modelRoutes?.image?.provider || '',
          imageModel: p.modelRoutes?.image?.model || '',
          characterPrompt: p.promptOverrides?.character || '',
          scenePrompt: p.promptOverrides?.scene || '',
          videoPrompt: p.promptOverrides?.video || '',
          isDefault: p.isDefault,
        }
      }
    } else {
      error.value = '加载失败'
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function saveProfile(name: string) {
  saving.value = name
  try {
    const e = edits[name]
    const data: any = {
      styleTokens: e.styleTokens,
      negativeTokens: e.negativeTokens,
      modelRoutes: {
        video: e.videoProvider ? { provider: e.videoProvider, model: e.videoModel } : undefined,
        image: e.imageProvider ? { provider: e.imageProvider, model: e.imageModel } : undefined,
      },
      promptOverrides: {
        character: e.characterPrompt || undefined,
        scene: e.scenePrompt || undefined,
        video: e.videoPrompt || undefined,
      },
      isDefault: e.isDefault,
    }
    // 清理空值
    for (const k of Object.keys(data)) {
      if (data[k] === undefined || data[k] === null || data[k] === '') {
        if (k === 'isDefault') continue
        delete data[k]
      }
    }
    if (data.promptOverrides && Object.keys(data.promptOverrides).length === 0) {
      delete data.promptOverrides
    }

    const res = await fetch(`/api/v1/style-profiles/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (json.success) {
      alert('✅ 保存成功')
      load()
    } else {
      alert('❌ 保存失败: ' + json.error)
    }
  } catch (e: any) {
    alert('❌ 保存失败: ' + e.message)
  } finally {
    saving.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.style-admin { padding: 24px; max-width: 1200px; margin: 0 auto; }
.page-header { margin-bottom: 24px; }
.page-header h2 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
.page-desc { color: #9ca3af; font-size: 14px; }
.loading, .error { padding: 40px; text-align: center; font-size: 16px; color: #9ca3af; }
.error { color: #f87171; }
.style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); gap: 20px; }
.style-card {
  background: rgba(20,22,30,0.95); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 20px;
}
.card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.card-icon { font-size: 28px; }
.card-title-group { flex: 1; }
.card-name { font-size: 16px; font-weight: 600; display: block; }
.card-code { font-size: 12px; color: #6b7280; }
.badge-default {
  background: rgba(59,130,246,0.2); color: #93c5fd;
  padding: 2px 8px; border-radius: 4px; font-size: 11px;
}
.card-desc { font-size: 13px; color: #9ca3af; margin-bottom: 16px; }
.field-row { margin-bottom: 12px; }
.field-row label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
.field-row textarea {
  width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; color: #d1d5db; padding: 6px 8px; font-size: 13px;
  resize: vertical; min-height: 40px;
}
.field-row textarea.mono { font-family: 'Courier New', monospace; font-size: 12px; }
.model-row { display: flex; gap: 8px; }
.model-input {
  flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px; color: #d1d5db; padding: 4px 8px; font-size: 13px;
}
.prompt-details { margin: 12px 0; }
.prompt-details summary { font-size: 13px; color: #9ca3af; cursor: pointer; padding: 4px 0; }
.card-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
.default-toggle { font-size: 13px; color: #9ca3af; cursor: pointer; }
.default-toggle input { margin-right: 4px; }
.btn-save {
  background: linear-gradient(135deg, #2563eb, #3b82f6); border: none;
  color: #fff; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px;
}
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
