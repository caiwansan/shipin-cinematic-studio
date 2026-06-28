<template>
  <div class="credential-manager">
    <h3>凭据管理</h3>
    <div class="credential-form">
      <select v-model="form.type">
        <option value="">选择类型</option>
        <option value="LLM">LLM</option>
        <option value="Embedding">Embedding</option>
        <option value="Image">Image</option>
        <option value="Video">Video</option>
        <option value="Speech">Speech</option>
        <option value="MCP">MCP</option>
      </select>
      <input v-model="form.name" placeholder="凭据名称" />
      <input v-model="form.apiKey" type="password" placeholder="API Key（加密存储）" />
      <input v-model="form.endpoint" placeholder="端点 URL（可选）" />
      <button @click="saveCredential">保存</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

const form = reactive({
  type: '',
  name: '',
  apiKey: '',
  endpoint: '',
})

const saveCredential = () => {
  console.log('save', form)
}
</script>

<style scoped>
.credential-manager { padding: 16px; }
.credential-form { display: flex; flex-direction: column; gap: 12px; max-width: 400px; }
input, select { padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 6px; }
button { padding: 8px 16px; background: #1677ff; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
</style>
