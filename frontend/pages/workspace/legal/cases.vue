<template>
  <LegalWorkspaceLayout>
    <div class="legal-cases-page">
      <div class="legal-cases-page__header">
        <div>
          <h1 class="legal-cases-page__title">我的案件</h1>
          <p class="legal-cases-page__desc">管理所有法律案件</p>
        </div>
        <button class="legal-cases-page__create-btn" @click="showCreate = true">+ 新建案件</button>
      </div>

      <div v-if="loading" class="legal-cases-page__loading">加载中...</div>
      <div v-else-if="error" class="legal-cases-page__error">
        <p>{{ error }}</p>
        <button class="legal-cases-page__retry" @click="loadCases">重试</button>
      </div>

      <template v-else>
        <!-- Case Cards -->
        <div class="legal-cases-page__grid">
          <div
            v-for="c in cases"
            :key="c.id"
            class="legal-cases-page__card"
            @click="router.push(`/workspace/legal/case/${c.id}`)"
          >
            <div class="legal-cases-page__card-header">
              <h3 class="legal-cases-page__card-title">{{ c.caseName }}</h3>
              <span :class="['legal-cases-page__card-status', `legal-cases-page__card-status--${c.status}`]">
                {{ statusLabel(c.status) }}
              </span>
            </div>
            <div class="legal-cases-page__card-body">
              <div class="legal-cases-page__card-desc">{{ c.description || '暂无描述' }}</div>
              <div class="legal-cases-page__card-meta">
                <span>当事人：{{ c.party || '-' }}</span>
                <span>{{ c.category || '未分类' }}</span>
              </div>
              <div class="legal-cases-page__card-progress">
                <div class="legal-cases-page__progress-bar">
                  <div class="legal-cases-page__progress-fill" :style="{ width: (c.analysisProgress || 0) + '%' }" />
                </div>
                <span class="legal-cases-page__progress-label">{{ c.analysisProgress || 0 }}%</span>
              </div>
            </div>
            <div class="legal-cases-page__card-footer">
              <span class="legal-cases-page__card-date">{{ formatDate(c.updatedAt) }}</span>
              <span class="legal-cases-page__card-action">进入工作区 →</span>
            </div>
          </div>
        </div>

        <div v-if="cases.length === 0" class="legal-cases-page__empty">
          <p>暂无案件，点击右上角新建</p>
        </div>
      </template>

      <!-- Create Case Dialog -->
      <div v-if="showCreate" class="legal-cases-page__overlay" @click.self="showCreate = false">
        <div class="legal-cases-page__dialog">
          <h2>新建案件</h2>
          <div class="legal-cases-page__form">
            <label>案件名称 *</label>
            <input v-model="newCaseName" placeholder="如：劳动仲裁纠纷" class="legal-cases-page__input" />
            <label>当事人</label>
            <input v-model="newParty" placeholder="对方当事人名称" class="legal-cases-page__input" />
            <label>案件描述</label>
            <textarea v-model="newDesc" placeholder="简要描述案件情况" class="legal-cases-page__textarea" rows="3" />
            <label>分类</label>
            <select v-model="newCategory" class="legal-cases-page__input">
              <option value="">请选择</option>
              <option value="labor">劳动纠纷</option>
              <option value="contract">合同纠纷</option>
              <option value="debt">债务纠纷</option>
              <option value="family">婚姻家庭</option>
              <option value="property">财产纠纷</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="legal-cases-page__dialog-actions">
            <button class="legal-cases-page__dialog-cancel" @click="showCreate = false">取消</button>
            <button class="legal-cases-page__dialog-confirm" @click="createCase" :disabled="!newCaseName.trim()">创建</button>
          </div>
        </div>
      </div>
    </div>
  </LegalWorkspaceLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import LegalWorkspaceLayout from 'workspaces/legal/layouts/LegalWorkspaceLayout.vue'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(true)
const error = ref<string | null>(null)
const cases = ref<any[]>([])
const showCreate = ref(false)
const newCaseName = ref('')
const newParty = ref('')
const newDesc = ref('')
const newCategory = ref('')

function statusLabel(s: string) {
  const m: Record<string, string> = { draft: '草稿', active: '进行中', pending: '待处理', closed: '已结案', archived: '已归档' }
  return m[s] || s
}
function formatDate(d: string) { return d ? new Date(d).toLocaleDateString('zh-CN') : '-' }

async function loadCases() {
  loading.value = true
  error.value = null
  try {
    const token = auth.getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/legal/cases', { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.success) cases.value = json.data || []
    else throw new Error(json.error || '加载失败')
  } catch (err: any) {
    error.value = err?.message || '加载失败'
  } finally { loading.value = false }
}

async function createCase() {
  if (!newCaseName.value.trim()) return
  try {
    const token = auth.getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/legal/cases', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        caseName: newCaseName.value,
        party: newParty.value || undefined,
        description: newDesc.value || undefined,
        category: newCategory.value || undefined,
      }),
    })
    const json = await res.json()
    if (json.success) {
      showCreate.value = false
      newCaseName.value = ''
      newParty.value = ''
      newDesc.value = ''
      newCategory.value = ''
      // Navigate to the new case workspace
      router.push(`/workspace/legal/case/${json.data.id}`)
    }
  } catch {}
}

onMounted(loadCases)
</script>

<style scoped>
.legal-cases-page { max-width: 1200px; margin: 0 auto; color: #F8F6F1; }
.legal-cases-page__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
.legal-cases-page__title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
.legal-cases-page__desc { font-size: 14px; color: rgba(248,246,241,0.5); margin: 0; }
.legal-cases-page__create-btn {
  background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.25);
  border-radius: 10px; padding: 10px 22px; color: #FBBF24; cursor: pointer; font-size: 14px; font-weight: 500;
}
.legal-cases-page__create-btn:hover { background: rgba(251,191,36,0.2); }

.legal-cases-page__loading, .legal-cases-page__error {
  text-align: center; padding: 60px; color: rgba(248,246,241,0.4);
}
.legal-cases-page__retry {
  margin-top: 12px; padding: 8px 20px; background: rgba(251,191,36,0.15);
  border: 1px solid rgba(251,191,36,0.3); border-radius: 8px; color: #FBBF24; cursor: pointer;
}

.legal-cases-page__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }

.legal-cases-page__card {
  background: rgba(248,246,241,0.02); border: 1px solid rgba(248,246,241,0.06);
  border-radius: 12px; cursor: pointer; transition: all 0.2s; overflow: hidden;
}
.legal-cases-page__card:hover { background: rgba(251,191,36,0.04); border-color: rgba(251,191,36,0.15); transform: translateY(-2px); }

.legal-cases-page__card-header {
  display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 0;
}
.legal-cases-page__card-title { font-size: 16px; font-weight: 600; margin: 0; flex: 1; }
.legal-cases-page__card-status {
  font-size: 11px; padding: 2px 8px; border-radius: 4px;
  background: rgba(248,246,241,0.05); color: rgba(248,246,241,0.4);
}
.legal-cases-page__card-status--active { background: rgba(34,197,94,0.15); color: #22c55e; }
.legal-cases-page__card-status--pending { background: rgba(251,191,36,0.15); color: #FBBF24; }
.legal-cases-page__card-status--closed { background: rgba(99,102,241,0.15); color: #818cf8; }

.legal-cases-page__card-body { padding: 12px 16px; }
.legal-cases-page__card-desc { font-size: 13px; color: rgba(248,246,241,0.5); margin-bottom: 8px; line-height: 1.4; }
.legal-cases-page__card-meta { font-size: 12px; color: rgba(248,246,241,0.35); display: flex; gap: 16px; margin-bottom: 12px; }

.legal-cases-page__card-progress { display: flex; align-items: center; gap: 8px; }
.legal-cases-page__progress-bar { flex: 1; height: 4px; background: rgba(248,246,241,0.06); border-radius: 2px; overflow: hidden; }
.legal-cases-page__progress-fill { height: 100%; background: #FBBF24; border-radius: 2px; transition: width 0.3s; }
.legal-cases-page__progress-label { font-size: 11px; color: #FBBF24; width: 32px; text-align: right; }

.legal-cases-page__card-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 16px; border-top: 1px solid rgba(248,246,241,0.04);
}
.legal-cases-page__card-date { font-size: 11px; color: rgba(248,246,241,0.25); }
.legal-cases-page__card-action { font-size: 12px; color: #FBBF24; }

.legal-cases-page__empty { text-align: center; padding: 60px; color: rgba(248,246,241,0.3); }

/* Dialog */
.legal-cases-page__overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;
}
.legal-cases-page__dialog {
  background: #1a1a24; border: 1px solid rgba(248,246,241,0.1); border-radius: 16px;
  padding: 28px; width: 440px; max-width: 90vw;
}
.legal-cases-page__dialog h2 { margin: 0 0 20px; font-size: 18px; }
.legal-cases-page__form label { display: block; font-size: 12px; color: rgba(248,246,241,0.4); margin-bottom: 4px; margin-top: 14px; }
.legal-cases-page__input, .legal-cases-page__textarea {
  width: 100%; padding: 10px; background: rgba(248,246,241,0.04); border: 1px solid rgba(248,246,241,0.1);
  border-radius: 8px; color: #F8F6F1; font-size: 14px; box-sizing: border-box;
}
.legal-cases-page__textarea { resize: vertical; }
.legal-cases-page__input:focus, .legal-cases-page__textarea:focus { outline: none; border-color: #FBBF24; }
select.legal-cases-page__input option { background: #1a1a24; color: #F8F6F1; }

.legal-cases-page__dialog-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
.legal-cases-page__dialog-cancel {
  padding: 10px 20px; background: rgba(248,246,241,0.04); border: 1px solid rgba(248,246,241,0.08);
  border-radius: 8px; color: rgba(248,246,241,0.5); cursor: pointer;
}
.legal-cases-page__dialog-confirm {
  padding: 10px 24px; background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.3);
  border-radius: 8px; color: #FBBF24; cursor: pointer;
}
.legal-cases-page__dialog-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
