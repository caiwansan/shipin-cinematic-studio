<template>
  <div class="resource-center">
    <h2>AI 资源中心</h2>
    <p class="subtitle">管理平台 AI 资源：LLM、Embedding、Image、Video、Tool、MCP 等</p>

    <div class="resource-grid">
      <div v-for="cat in resourceCategories" :key="cat.type" class="resource-card">
        <div class="card-header">
          <span class="card-icon">{{ cat.icon }}</span>
          <h3>{{ cat.label }}</h3>
          <span :class="['status-badge', cat.health]">{{ cat.health === 'healthy' ? '正常' : cat.health === 'degraded' ? '降级' : '离线' }}</span>
        </div>
        <div class="card-body">
          <div class="stat-row"><label>已注册资源</label><span>{{ cat.count }}</span></div>
          <div class="stat-row"><label>活跃凭据</label><span>{{ cat.credentialCount }}</span></div>
          <div class="stat-row"><label>今日调用</label><span>{{ cat.dailyCalls }}</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>凭据管理</h3>
      <div class="credential-list">
        <div class="credential-item header">
          <span>名称</span><span>类型</span><span>端点</span><span>状态</span><span>操作</span>
        </div>
        <div class="credential-item" v-for="cred in credentials" :key="cred.id">
          <span>{{ cred.name }}</span>
          <span>{{ cred.type }}</span>
          <span>{{ cred.endpoint || '-' }}</span>
          <span :class="cred.status === 'active' ? 'text-green' : 'text-red'">{{ cred.status }}</span>
          <span><button @click="editCredential(cred)">编辑</button></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const resourceCategories = [
  { type: 'LLM', label: '大语言模型', icon: '🧠', health: 'healthy', count: 5, credentialCount: 3, dailyCalls: 1240 },
  { type: 'Embedding', label: '向量嵌入', icon: '🔢', health: 'healthy', count: 3, credentialCount: 2, dailyCalls: 560 },
  { type: 'Image', label: '图像模型', icon: '🎨', health: 'degraded', count: 2, credentialCount: 1, dailyCalls: 89 },
  { type: 'Tool', label: '工具调用', icon: '🔧', health: 'healthy', count: 4, credentialCount: 0, dailyCalls: 230 },
  { type: 'MCP', label: 'MCP 服务', icon: '🔌', health: 'healthy', count: 1, credentialCount: 1, dailyCalls: 45 },
  { type: 'Video', label: '视频模型', icon: '🎬', health: 'offline', count: 1, credentialCount: 0, dailyCalls: 0 },
]

const credentials = [
  { id: '1', name: 'OpenAI Main', type: 'LLM', endpoint: 'https://api.openai.com', status: 'active' },
  { id: '2', name: 'DeepSeek Dev', type: 'LLM', endpoint: 'https://api.deepseek.com', status: 'active' },
  { id: '3', name: '火山引擎', type: 'Image', endpoint: 'https://visual.volcengine.com', status: 'active' },
]

const editCredential = (cred: any) => {
  console.log('edit', cred.id)
}
</script>

<style scoped>
.resource-center { padding: 24px; }
.resource-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin: 20px 0; }
.resource-card { border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; background: #fff; }
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.card-icon { font-size: 24px; }
.status-badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; }
.status-badge.healthy { background: #e6f7e6; color: #389e0d; }
.status-badge.degraded { background: #fff7e6; color: #d48806; }
.status-badge.offline { background: #f0f0f0; color: #999; }
.stat-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
.credential-list { border: 1px solid #e0e0e0; border-radius: 8px; }
.credential-item { display: grid; grid-template-columns: 2fr 1fr 2fr 1fr 60px; padding: 10px 16px; border-bottom: 1px solid #f0f0f0; align-items: center; }
.credential-item.header { background: #fafafa; font-weight: 600; }
.text-green { color: #389e0d; }
.text-red { color: #cf1322; }
.subtitle { color: #666; margin-top: -8px; margin-bottom: 20px; }
.section { margin-top: 32px; }
button { padding: 4px 12px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; cursor: pointer; }
</style>
