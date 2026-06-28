<template>
  <div class="capability-matrix">
    <h3>能力 × 资源矩阵</h3>
    <table class="matrix-table">
      <thead>
        <tr>
          <th>能力</th>
          <th v-for="r in resources" :key="r">{{ r }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in matrix" :key="row.capability">
          <td>{{ row.capability }}</td>
          <td v-for="r in resources" :key="r">
            <span :class="row[r] === '✅' ? 'supported' : row[r] === '⚠️' ? 'partial' : 'unsupported'">{{ row[r] }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
const resources = ['OpenAI', 'DeepSeek', 'Gemini', 'Claude', 'Qwen', 'Ollama']

const matrix = [
  { capability: 'GenerateFAQ', OpenAI: '✅', DeepSeek: '✅', Gemini: '✅', Claude: '✅', Qwen: '✅', Ollama: '✅' },
  { capability: 'ExtractEntity', OpenAI: '✅', DeepSeek: '✅', Gemini: '✅', Claude: '✅', Qwen: '✅', Ollama: '✅' },
  { capability: 'Vision', OpenAI: '✅', DeepSeek: '❌', Gemini: '✅', Claude: '✅', Qwen: '⚠️', Ollama: '⚠️' },
  { capability: 'GenerateImage', OpenAI: '✅', DeepSeek: '❌', Gemini: '❌', Claude: '❌', Qwen: '✅', Ollama: '❌' },
  { capability: 'GenerateVideo', OpenAI: '❌', DeepSeek: '❌', Gemini: '❌', Claude: '❌', Qwen: '❌', Ollama: '❌' },
]
</script>

<style scoped>
.matrix-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.matrix-table th, .matrix-table td { padding: 10px 16px; border: 1px solid #f0f0f0; text-align: center; }
.matrix-table th { background: #fafafa; font-weight: 600; }
.matrix-table td:first-child { text-align: left; font-weight: 500; }
.supported { color: #389e0d; font-weight: 600; }
.partial { color: #d48806; font-weight: 600; }
.unsupported { color: #999; }
</style>
