<template>
  <div class="geo-rec">
    <!-- Page Header -->
    <div class="geo-rec__header">
      <div>
        <h1 class="geo-rec__title">智能推荐</h1>
        <p class="geo-rec__desc">基于品牌健康分析，为您推荐优化行动</p>
      </div>
      <div class="geo-rec__score">
        <div class="geo-rec__score-value">{{ currentScore }}</div>
        <div class="geo-rec__score-label">当前分数</div>
      </div>
    </div>

    <!-- Main Grid: 两栏 -->
    <div class="geo-rec__grid">
      <!-- 左栏：优先行动 -->
      <div class="geo-rec__card">
        <div class="geo-rec__card-hd">
          <span class="geo-rec__card-title">优先行动</span>
          <span class="geo-rec__card-badge">{{ pendingRecs.length }}</span>
        </div>
        <div class="geo-rec__card-bd">
          <div v-for="(rec, i) in pendingRecs" :key="rec.id" class="geo-rec__item">
            <div class="geo-rec__item-index">{{ i + 1 }}</div>
            <div class="geo-rec__item-body">
              <div class="geo-rec__item-title">{{ rec.title }}</div>
              <div class="geo-rec__item-detail">{{ rec.detail }}</div>
              <div class="geo-rec__item-tags">
                <span class="geo-rec__tag" :class="`tag--${rec.priority}`">
                  {{ rec.priority === 'high' ? '高优先级' : rec.priority === 'medium' ? '中优先级' : '低优先级' }}
                </span>
                <span class="geo-rec__tag tag--impact">+{{ rec.impact }} 分</span>
              </div>
            </div>
            <button class="geo-rec__item-btn" @click="executeRec(rec.id)">执行</button>
          </div>
          <div v-if="!pendingRecs.length" class="geo-rec__empty">暂无待处理推荐</div>
        </div>
      </div>

      <!-- 右栏：推荐历史和说明 -->
      <div class="geo-rec__right">
        <div class="geo-rec__card">
          <div class="geo-rec__card-hd">
            <span class="geo-rec__card-title">推荐历史</span>
          </div>
          <div class="geo-rec__card-bd">
            <div v-for="h in history" :key="h.id" class="geo-rec__history-item">
              <span class="geo-rec__history-check">✓</span>
              <span class="geo-rec__history-title">{{ h.title }}</span>
              <span class="geo-rec__history-impact">+{{ h.impact }}</span>
            </div>
            <div v-if="!history.length" class="geo-rec__empty">暂无历史记录</div>
          </div>
        </div>

        <div class="geo-rec__card geo-rec__card--info">
          <div class="geo-rec__card-hd">
            <span class="geo-rec__card-title">为什么做这些</span>
          </div>
          <div class="geo-rec__card-bd">
            <p class="geo-rec__info-text">推荐行动基于 AI 可见度评估，优先处理高影响力项目可快速提升品牌在 AI 搜索结果中的曝光率。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchRecommendations } from '../services/recommendationsService'

interface RecItem {
  id: string
  title: string
  detail: string
  priority: 'high' | 'medium' | 'low'
  impact: number
  status: string
}

interface HistoryItem {
  id: string
  title: string
  impact: number
  executedAt: string
}

const currentScore = ref(72)
const pendingRecs = ref<RecItem[]>([])
const history = ref<HistoryItem[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const data = await fetchRecommendations('default')
    pendingRecs.value = data.recommendations.map(r => ({
      id: r.id,
      title: r.title,
      detail: r.description,
      priority: r.priority as any,
      impact: r.impact.value,
      status: r.status,
    }))
    history.value = data.history.map(h => ({
      id: h.id,
      title: h.title,
      impact: h.impact,
      executedAt: (h as any).executedAt || '',
    }))
  } catch {
    // 如果 API 失败，使用静态占位数据
    pendingRecs.value = [
      { id: '1', title: '优化品牌知识图谱', detail: '补充品牌核心信息，提高 AI 识别准确度', priority: 'high', impact: 15, status: 'pending' },
      { id: '2', title: '增加权威引用来源', detail: '在权威平台发布品牌相关内容', priority: 'high', impact: 12, status: 'pending' },
      { id: '3', title: '优化社交媒体矩阵', detail: '统一各平台品牌描述和关键词策略', priority: 'medium', impact: 8, status: 'pending' },
    ]
    history.value = [
      { id: 'h1', title: '更新官网 About 页面', impact: 5, executedAt: '3天前' },
      { id: 'h2', title: '提交知识面板申诉', impact: 3, executedAt: '1周前' },
    ]
  } finally {
    loading.value = false
  }
}

function executeRec(id: string) {
  // Placeholder
  pendingRecs.value = pendingRecs.value.filter(r => r.id !== id)
}

onMounted(() => load())
</script>

<style scoped>
.geo-rec { width: 100%; }

.geo-rec__header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px;
}
.geo-rec__title { font-size: 24px; font-weight: 700; margin: 0; }
.geo-rec__desc { font-size: 14px; color: #64748b; margin: 4px 0 0; }

.geo-rec__score {
  text-align: center; padding: 12px 24px;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  border-radius: 12px; color: #fff;
}
.geo-rec__score-value { font-size: 32px; font-weight: 800; color: #38bdf8; }
.geo-rec__score-label { font-size: 12px; color: #94a3b8; margin-top: 2px; }

.geo-rec__grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; }
@media (max-width: 900px) { .geo-rec__grid { grid-template-columns: 1fr; } }

.geo-rec__card {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
}
.geo-rec__card--info { margin-top: 16px; }
.geo-rec__card-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid #f1f5f9;
}
.geo-rec__card-title { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.geo-rec__card-badge { background: #3b82f6; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
.geo-rec__card-bd { padding: 8px 0; }

.geo-rec__item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #fafafa; }
.geo-rec__item:last-child { border-bottom: none; }
.geo-rec__item-index {
  width: 28px; height: 28px; border-radius: 8px;
  background: #f1f5f9; color: #64748b;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; flex-shrink: 0;
}
.geo-rec__item-body { flex: 1; min-width: 0; }
.geo-rec__item-title { font-size: 14px; font-weight: 600; }
.geo-rec__item-detail { font-size: 13px; color: #94a3b8; margin-top: 2px; }
.geo-rec__item-tags { display: flex; gap: 6px; margin-top: 6px; }
.geo-rec__tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.tag--high { background: #fee2e2; color: #dc2626; }
.tag--medium { background: #ffedd5; color: #d97706; }
.tag--low { background: #f1f5f9; color: #64748b; }
.tag--impact { background: #dbeafe; color: #2563eb; }
.geo-rec__item-btn {
  padding: 6px 14px; background: #3b82f6; color: #fff; border: none; border-radius: 6px;
  font-size: 13px; cursor: pointer; flex-shrink: 0; transition: background 0.15s;
}
.geo-rec__item-btn:hover { background: #2563eb; }

.geo-rec__empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 14px; }

.geo-rec__right { display: flex; flex-direction: column; gap: 16px; }

.geo-rec__history-item { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid #fafafa; }
.geo-rec__history-check { color: #22c55e; font-weight: 700; width: 20px; text-align: center; }
.geo-rec__history-title { flex: 1; font-size: 14px; }
.geo-rec__history-impact { font-size: 13px; font-weight: 600; color: #22c55e; }

.geo-rec__info-text { font-size: 14px; color: #64748b; line-height: 1.6; padding: 4px 16px 8px; margin: 0; }
</style>
