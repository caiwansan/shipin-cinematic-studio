<template>
  <LegalWorkspaceLayout>
    <div class="legal-page">
      <h1 class="legal-page__title">案例中心</h1>
      <p class="legal-page__desc">检索类案裁判文书</p>
      <div class="legal-page__loading" v-if="loading">加载中...</div>
      <div class="legal-page__table" v-else>
        <table>
          <thead>
            <tr>
              <th>案例名称</th>
              <th>案由</th>
              <th>法院</th>
              <th>年份</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in templates" :key="c.id">
              <td>{{ c.title || c.caseName }}</td>
              <td>{{ c.cause || c.category || '-' }}</td>
              <td>{{ c.court || '-' }}</td>
              <td>{{ c.year || '-' }}</td>
              <td><button class="action-btn" @click="viewDetail(c.id)">查看</button></td>
            </tr>
            <tr v-if="templates.length === 0"><td colspan="5" class="empty">暂无案例</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </LegalWorkspaceLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import LegalWorkspaceLayout from 'workspaces/legal/layouts/LegalWorkspaceLayout.vue'

definePageMeta({ layout: false })

const auth = useAuthStore()
const loading = ref(true)
const templates = ref<any[]>([])

function viewDetail(id: string) {}

onMounted(async () => {
  try {
    const token = auth.getToken()
    const headers: Record<string,string> = {}
    if(token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/legal/case-templates', { headers })
    const json = await res.json()
    if (json.success) templates.value = json.data || []
  } catch {}
  loading.value = false
})
</script>

<style scoped>
.legal-page { max-width: 1200px; margin: 0 auto; color: #F8F6F1; }
.legal-page__title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
.legal-page__desc { font-size: 14px; color: rgba(248,246,241,0.5); margin: 0 0 32px; }
.legal-page__loading { text-align: center; padding: 40px; color: rgba(248,246,241,0.4); }
.legal-page__table table { width: 100%; border-collapse: collapse; }
.legal-page__table th, .legal-page__table td { text-align: left; padding: 12px; border-bottom: 1px solid rgba(248,246,241,0.06); font-size: 14px; }
.legal-page__table th { color: rgba(248,246,241,0.4); font-weight: 500; }
.legal-page__table td { color: rgba(248,246,241,0.7); }
.empty { text-align: center; color: rgba(248,246,241,0.3); padding: 40px; }
.action-btn { background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.25); border-radius: 6px; color: #FBBF24; padding: 4px 12px; cursor: pointer; font-size: 13px; }
.action-btn:hover { background: rgba(251,191,36,0.2); }
</style>
