<template>
  <div class="hdz-workspace">
    <!-- 顶部栏 -->
    <nav class="hdz-ws-topbar">
      <div class="hdz-ws-topbar-left">
        <router-link to="/" class="hdz-ws-back">← 返回首页</router-link>
        <span class="hdz-ws-sep">|</span>
        <span class="hdz-ws-project-title">小说工作台</span>
        <span class="hdz-ws-genre-tag">α 混沌珠</span>
      </div>
      <div class="hdz-ws-topbar-right">
        <span class="hdz-ws-stat">📝 {{ projects.length }} 项目</span>
        <span class="hdz-ws-stat">📊 {{ totalChapters }} 章</span>
      </div>
    </nav>

    <div class="hdz-ws-body">
      <!-- 左侧导航 -->
      <aside class="hdz-ws-sidebar">
        <div class="hdz-ws-sidebar-section">
          <div class="hdz-ws-sidebar-title">工作台</div>
          <button class="hdz-ws-sidebar-btn" :class="{ active: panel === 'projects' }" @click="panel = 'projects'">
            📚 我的项目
          </button>
        </div>
        <div class="hdz-ws-sidebar-section">
          <div class="hdz-ws-sidebar-title">快捷操作</div>
          <button class="hdz-ws-sidebar-btn" @click="showNew = true">
            ➕ 新建项目
          </button>
          <button class="hdz-ws-sidebar-btn" @click="refresh">
            🔄 刷新列表
          </button>
          <button class="hdz-ws-sidebar-btn" @click="$router.push('/hdz/m')">
            📱 手机版
          </button>
        </div>

        <!-- 左栏底部卡片 -->
        <div class="hdz-ws-sidebar-bottom">
          <div class="hdz-ws-card hdz-ws-card--member" @click="goMemberCenter">
            <div class="hdz-ws-card-icon" :class="{ 'hdz-vip-icon': isVip }">
              {{ isVip ? '👑' : '💎' }}
            </div>
            <div class="hdz-ws-card-info">
              <div class="hdz-ws-card-title">{{ memberTier !== 'free' ? displayMemberName : '免费用户' }}</div>
              <div class="hdz-ws-card-desc">{{ isVip ? `余额 ${memberCredits} 积分` : '了解会员权益' }}</div>
            </div>
            <div class="hdz-ws-card-arrow">→</div>
          </div>
          <div class="hdz-ws-card hdz-ws-card--model" @click="showModelSettings = true">
            <div class="hdz-ws-card-icon">🧩</div>
            <div class="hdz-ws-card-info">
              <div class="hdz-ws-card-title">大模型设置</div>
              <div class="hdz-ws-card-desc">配置 AI 引擎与 API Key</div>
            </div>
            <div class="hdz-ws-card-arrow">→</div>
          </div>
          <div class="hdz-ws-card hdz-ws-card--local" @click="showLocalModel = true">
            <div class="hdz-ws-card-icon">🖥️</div>
            <div class="hdz-ws-card-info">
              <div class="hdz-ws-card-title">本地模型</div>
              <div class="hdz-ws-card-desc">Ollama / 离线部署</div>
            </div>
            <div class="hdz-ws-card-arrow">→</div>
          </div>
        </div>
      </aside>

      <!-- 中栏主工作区 -->
      <main class="hdz-ws-main">

        <!-- 项目列表面板 -->
        <div v-if="panel === 'projects'" class="hdz-ws-panel">
          <div class="hdz-panel-header">
            <span>📚 我的小说项目</span>
            <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="showNew = true">+ 新建项目</button>
          </div>

          <div v-if="loading" class="hdz-panel-loading">加载中...</div>

          <div v-else-if="projects.length === 0" class="hdz-panel-empty">
            <div class="hdz-empty-icon">📖</div>
            <p class="hdz-empty-text">还没有小说项目</p>
            <p class="hdz-empty-hint">创建一个新项目，开始你的玄幻之旅</p>
            <button class="hdz-btn hdz-btn-primary" @click="showNew = true">+ 新建项目</button>
          </div>

          <div v-else class="hdz-project-grid">
            <div
              v-for="p in projects"
              :key="p.id"
              class="hdz-project-card"
              @click="goWorkspace(p.id)"
            >
              <div class="hdz-project-top">
                <span class="hdz-project-genre">{{ p.genre || '未分类' }}</span>
                <span class="hdz-project-status" :class="`hdz-status--${p.status}`">{{ statusLabel(p.status) }}</span>
              </div>
              <div class="hdz-project-title-row">
                <h3
                  v-if="editingTitle !== p.id"
                  class="hdz-project-title"
                  @click.stop="startEditTitle(p)"
                >{{ p.title }}</h3>
                <input
                  v-else
                  :ref="(el: any) => { if (el && el.focus) { titleInputRef = el; el.focus() } }"
                  v-model="editTitleValue"
                  class="hdz-project-title-input"
                  @click.stop
                  @keyup.enter="saveTitle(p)"
                  @keyup.escape="cancelEditTitle"
                  @blur="saveTitle(p)"
                />
                <button
                  v-if="editingTitle !== p.id"
                  class="hdz-project-rename-btn"
                  title="修改书名"
                  @click.stop="startEditTitle(p)"
                >✎</button>
                <button
                  class="hdz-project-delete-btn"
                  title="删除项目"
                  @click.stop="deleteProject(p)"
                >🗑️</button>
              </div>
              <div class="hdz-project-desc" v-if="p.styleDesc">{{ p.styleDesc }}</div>
              <div class="hdz-project-meta">
                <span>📝 {{ p._count?.chapters || 0 }} 章</span>
                <span>👤 {{ p._count?.characters || 0 }} 角色</span>
                <span v-if="p.wordTarget">🎯 {{ formatNum(p.wordTarget) }} 字</span>
              </div>
              <div class="hdz-project-time">{{ formatTime(p.updatedAt) }}</div>
            </div>
          </div>
        </div>
      </main>

      <!-- 右侧建议栏 -->
      <aside class="hdz-ws-aside">
        <div class="hdz-aside-section">
          <div class="hdz-aside-title">工作台指引</div>
          <div class="hdz-aside-suggestions">
            <div class="hdz-aside-suggestion"><span class="hdz-aside-sug-icon">📌</span><span class="hdz-aside-sug-text">{{ projects.length === 0 ? '点击"新建项目"开始创作' : '选择一个项目进入写作' }}</span></div>
            <div class="hdz-aside-suggestion"><span class="hdz-aside-sug-icon">💡</span><span class="hdz-aside-sug-text">每个项目可独立配置写作风格</span></div>
            <div class="hdz-aside-suggestion"><span class="hdz-aside-sug-icon">🔧</span><span class="hdz-aside-sug-text">先在"大模型设置"中填入 API Key</span></div>
          </div>
        </div>
        <div class="hdz-aside-section">
          <div class="hdz-aside-title">作品统计</div>
          <div class="hdz-aside-stats">
            <div class="hdz-stat-item"><span class="hdz-stat-label">项目数</span><span class="hdz-stat-value">{{ projects.length }}</span></div>
            <div class="hdz-stat-item"><span class="hdz-stat-label">总章节</span><span class="hdz-stat-value">{{ totalChapters }}</span></div>
            <div class="hdz-stat-item"><span class="hdz-stat-label">总角色</span><span class="hdz-stat-value">{{ totalCharacters }}</span></div>
            <div class="hdz-stat-item"><span class="hdz-stat-label">版本</span><span class="hdz-stat-value">α</span></div>
          </div>
        </div>
        <div class="hdz-aside-section">
          <div class="hdz-aside-title">下一步</div>
          <div class="hdz-aside-next-steps">
            <button class="hdz-aside-step-btn" @click="showNew = true">➕ 新建项目</button>
            <button class="hdz-aside-step-btn" @click="goModelConfig">🧩 配置模型</button>
            <button class="hdz-aside-step-btn" @click="router.push('/user/membership')">💎 升级会员</button>
          </div>
        </div>
      </aside>
    </div>

        <!-- 大模型设置弹窗 -->
    <DirectorModelSettingsModal :visible="showModelSettings" @close="showModelSettings = false" />
    <div v-if="showLocalModel" class="hdz-overlay" @click.self="showLocalModel = false">
      <div class="hdz-modal">
        <h2 class="hdz-modal-title">🖥️ 本地模型接入</h2>
        <div class="hdz-form">
          <div class="hdz-field">
            <label>Ollama 服务地址</label>
            <input v-model="localModelUrl" placeholder="http://localhost:11434" class="hdz-input" />
          </div>
          <div class="hdz-field">
            <label>模型名称</label>
            <input v-model="localModelName" placeholder="如 qwen2.5:7b" class="hdz-input" />
          </div>
          <p style="font-size:0.75rem;color:#888;line-height:1.6;">💡 先在服务器部署 Ollama，填入地址即可使用本地模型进行写作</p>
        </div>
        <div class="hdz-modal-actions">
          <button class="hdz-btn hdz-btn-ghost" @click="showLocalModel = false">取消</button>
          <button class="hdz-btn hdz-btn-primary" @click="showLocalModel = false">保存</button>
        </div>
      </div>
    </div>

    <!-- 新建项目对话框 -->
    <div v-if="showNew" class="hdz-overlay" @click.self="showNew = false">
      <div class="hdz-modal">
        <h2 class="hdz-modal-title">新建小说项目</h2>
        <div class="hdz-form">
          <div class="hdz-field">
            <label>小说标题 <span class="hdz-required">*</span></label>
            <input v-model="form.title" placeholder="输入小说标题" class="hdz-input" />
          </div>
          <div class="hdz-field">
            <label>小说类型</label>
            <select v-model="form.genre" class="hdz-input">
              <option value="">请选择</option>
              <option>玄幻</option><option>仙侠</option><option>都市</option><option>科幻</option>
              <option>历史</option><option>悬疑</option><option>言情</option><option>轻小说</option>
              <option>奇幻</option><option>武侠</option>
            </select>
          </div>
          <div class="hdz-field-row">
            <div class="hdz-field">
              <label>目标总字数</label>
              <input v-model.number="form.wordTarget" type="number" placeholder="如 100000" class="hdz-input" />
            </div>
            <div class="hdz-field">
              <label>单章字数</label>
              <input v-model.number="form.chapterWordTarget" type="number" placeholder="如 3000" class="hdz-input" />
            </div>
          </div>
          <div class="hdz-field">
            <label>风格描述</label>
            <textarea v-model="form.styleDesc" placeholder="如：古风玄幻，文风华丽，偏重意境描写" class="hdz-input hdz-textarea" rows="3"></textarea>
          </div>
        </div>
        <div class="hdz-modal-actions">
          <button class="hdz-btn hdz-btn-ghost" @click="showNew = false">取消</button>
          <button class="hdz-btn hdz-btn-primary" :disabled="creating || !form.title.trim()" @click="createProject">
            {{ creating ? '创建中...' : '确认创建' }}
          </button>
        </div>
        <p v-if="error" class="hdz-error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { $api } = useNuxtApp()
const route = useRoute()

const panel = ref('projects')

/** 断言数组：防止 ApiResponse object 误赋值到 ref<Array> */
function assertArray<T>(v: unknown): asserts v is T[] {
  if (!Array.isArray(v)) throw new Error('[HDZ] projects must be an array, got ' + typeof v)
}

const projects = ref<any[]>([])
const loading = ref(true)
const showNew = ref(false)
const creating = ref(false)
const error = ref('')
const showModelSettings = ref(false)
const showLocalModel = ref(false)
const localModelUrl = ref('http://localhost:11434')
const localModelName = ref('qwen2.5:7b')

// 书名编辑
const editingTitle = ref<string | null>(null)
const editTitleValue = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)
const savingTitle = ref(false)

function startEditTitle(p: any) {
  editingTitle.value = p.id
  editTitleValue.value = p.title
}

function cancelEditTitle() {
  editingTitle.value = null
  editTitleValue.value = ''
}

async function saveTitle(p: any) {
  if (savingTitle.value) return
  const val = editTitleValue.value.trim()
  if (!val || editingTitle.value !== p.id) {
    cancelEditTitle()
    return
  }
  savingTitle.value = true
  try {
    const res: any = await $api.put(`/api/hdz/projects/${p.id}`, { title: val })
    if (res?.success) {
      p.title = val
    }
  } catch {}
  savingTitle.value = false
  cancelEditTitle()
}

const form = reactive({ title: '', genre: '', wordTarget: 100000, chapterWordTarget: 3000, styleDesc: '' })

const totalChapters = computed(() => projects.value.reduce((s: number, p: any) => s + (p._count?.chapters || 0), 0))
const totalCharacters = computed(() => projects.value.reduce((s: number, p: any) => s + (p._count?.characters || 0), 0))

// 会员数据
const memberTier = ref('free')
const memberCredits = ref(0)
const memberExpiresAt = ref('')
const isVip = computed(() => {
  const t = memberTier.value.toLowerCase()
  return !['free', ''].includes(t)
})
const displayMemberName = computed(() => {
  const map: Record<string, string> = {
    free: '体验版', basic: '基础版', pro: '本地版', enterprise: '年卡',
  }
  return map[memberTier.value] || memberTier.value || '体验版'
})

async function fetchMembership() {
  try {
    const token = useAuthStore().getToken()
    if (!token) return
    const [planRes, meRes] = await Promise.all([
      fetch('/api/member/profile', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
    ])
    if (planRes.ok) {
      const data = await planRes.json()
      memberTier.value = data.memberTier || data.membership?.tier || 'free'
      memberCredits.value = data.credits ?? data.membership?.credits ?? 0
      memberExpiresAt.value = data.memberExpiresAt || ''
    } else if (meRes && meRes.ok) {
      const data = await meRes.json()
      const u = data.user || data
      memberTier.value = u.memberTier || u.membership?.tier || 'free'
      memberCredits.value = u.coins || u.membership?.credits || u.credits || 0
      memberExpiresAt.value = u.memberExpiresAt || ''
    }
  } catch {}
}

async function fetchProjects() {
  loading.value = true
  try {
    const res: any = await $api.get('/api/hdz/projects')
    const data = res?.data?.data ?? []
    assertArray(data)
    projects.value = data
  } catch (e: any) {
    projects.value = []
  } finally {
    loading.value = false
  }
}

async function createProject() {
  if (!form.title.trim()) return
  creating.value = true
  error.value = ''
  try {
    const res: any = await $api.post('/api/hdz/projects', {
      title: form.title, genre: form.genre, wordTarget: form.wordTarget,
      chapterWordTarget: form.chapterWordTarget, styleDesc: form.styleDesc,
    })
    if (res?.data?.data?.id) {
      showNew.value = false
      form.title = ''; form.genre = ''; form.wordTarget = 100000
      form.chapterWordTarget = 3000; form.styleDesc = ''
      await fetchProjects()
    } else {
      error.value = res?.data?.error || res?.data?.message || res?.error || '创建失败'
    }
  } catch (e: any) {
    error.value = e?.response?.data?.error || e?.message || '创建失败'
  } finally {
    creating.value = false
  }
}

function goWorkspace(id: string) {
  router.push(`/hdz/workspace/${id}`)
}

function goMemberCenter() {
  if (isVip.value) {
    router.push('/user/center')
  } else {
    router.push('/user/membership')
  }
}
function goModelConfig() {
  router.push('/director-os/aigc/models')
}

function refresh() {
  fetchProjects()
}

async function deleteProject(p: any) {
  if (!confirm(`确认删除项目「${p.title}」？\n\n此操作将永久删除项目的所有章节、角色、设定、记忆等全部数据，不可恢复。`)) return
  try {
    const res: any = await $api.delete(`/api/hdz/projects/${p.id}`)
    if (res?.success) {
      projects.value = projects.value.filter((x: any) => x.id !== p.id)
    } else {
      alert('删除失败: ' + (res?.error || '未知错误'))
    }
  } catch (e: any) {
    alert('删除失败: ' + (e.message || '未知错误'))
  }
}

function statusLabel(s: string) {
  const map: Record<string, string> = { draft: '草稿', active: '进行中', completed: '已完成' }
  return map[s] || s
}

function formatNum(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toLocaleString()
}

function formatTime(t: string) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

fetchProjects()
fetchMembership()
</script>

<style scoped>
/* ========== 全局结构 ========== */
.hdz-workspace {
  min-height: 100vh;
  background: #f5f0e8;
  color: #222222;
  display: flex;
  flex-direction: column;
}
.hdz-ws-body { display: flex; margin-top: 48px; flex: 1; overflow: hidden; }
.hdz-ws-body > main { overflow-y: auto; flex: 1; }

/* ========== 顶栏 ========== */
.hdz-ws-topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: 48px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px;
  backdrop-filter: blur(16px); background: rgba(245,240,232,0.85);
  border-bottom: 1px solid rgba(0,0,0,0.08);
}
.hdz-ws-topbar-left { display: flex; align-items: center; gap: 10px; }
.hdz-ws-back { font-size: 0.8rem; color: #8b7355; text-decoration: none; }
.hdz-ws-back:hover { color: #6b5a40; }
.hdz-ws-sep { color: rgba(0,0,0,0.12); }
.hdz-ws-project-title { font-size: 0.9rem; font-weight: 600; color: #333; }
.hdz-ws-genre-tag { font-size: 0.65rem; padding: 1px 6px; border-radius: 3px; background: rgba(168,130,255,0.12); color: #7a5f9a; }
.hdz-ws-topbar-right { display: flex; gap: 14px; }
.hdz-ws-stat { font-size: 0.75rem; color: #888; }

/* ========== 左侧栏 ========== */
.hdz-ws-sidebar {
  width: 220px; flex-shrink: 0;
  padding: 16px 10px;
  border-right: 1px solid rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.02);
  display: flex; flex-direction: column;
}
.hdz-ws-sidebar-section { margin-bottom: 20px; }
.hdz-ws-sidebar-title { font-size: 0.7rem; color: #999; padding: 0 10px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
.hdz-ws-sidebar-btn {
  display: block; width: 100%; text-align: left;
  padding: 8px 10px; margin-bottom: 2px; border-radius: 6px;
  background: transparent; border: none;
  font-size: 0.8rem; color: #666; cursor: pointer;
  transition: all 0.15s;
}
.hdz-ws-sidebar-btn:hover { color: #333; background: rgba(0,0,0,0.03); }
.hdz-ws-sidebar-btn.active { color: #6b5a9f; background: rgba(168,130,255,0.08); }

/* ========== 左栏底部卡片 ========== */
.hdz-ws-sidebar-bottom { margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 6px; }
.hdz-ws-card {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  transition: all 0.15s; background: transparent; border: 1px solid transparent;
}
.hdz-ws-card:hover { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); }
.hdz-ws-card-icon { font-size: 1rem; flex-shrink: 0; }
.hdz-ws-card-info { flex: 1; min-width: 0; }
.hdz-ws-card-title { font-size: 0.75rem; color: #555; font-weight: 500; }
.hdz-ws-card-desc { font-size: 0.65rem; color: #888; margin-top: 1px; }
.hdz-ws-card-arrow { font-size: 0.7rem; color: #aaa; }
.hdz-ws-card--member:hover .hdz-ws-card-icon { color: #b8860b; }
.hdz-vip-icon { filter: drop-shadow(0 0 6px rgba(200,160,50,0.4)); }
.hdz-ws-card--model:hover .hdz-ws-card-icon { color: #7a5f9a; }
.hdz-ws-card--local:hover .hdz-ws-card-icon { color: #4a7a9a; }

/* ========== 中栏 ========== */
.hdz-ws-main {
  flex: 1; padding: 20px 24px; overflow-y: auto;
}
.hdz-ws-panel { }
.hdz-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 20px;
}
.hdz-panel-header span { font-size: 1rem; font-weight: 600; }
.hdz-panel-loading { text-align: center; padding: 60px 0; color: #999; }
.hdz-panel-empty { text-align: center; padding: 80px 0; }
.hdz-panel-empty .hdz-empty-icon { font-size: 3rem; margin-bottom: 16px; }
.hdz-panel-empty .hdz-empty-text { font-size: 1.1rem; color: #666; margin-bottom: 8px; }
.hdz-panel-empty .hdz-empty-hint { font-size: 0.85rem; color: #999; margin-bottom: 24px; }

/* ========== 项目网格 ========== */
.hdz-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.hdz-project-card {
  padding: 20px; border-radius: 12px;
  background: linear-gradient(135deg, rgba(200,160,50,0.06), rgba(180,140,30,0.03));
  border: 1px solid rgba(200,160,50,0.15);
  cursor: pointer; transition: all 0.2s;
}
.hdz-project-card:hover {
  background: linear-gradient(135deg, rgba(200,160,50,0.12), rgba(180,140,30,0.06));
  border-color: rgba(200,160,50,0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(200,160,50,0.12);
}
.hdz-project-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
.hdz-project-genre { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; background: rgba(200,160,50,0.12); color: #8a7a30; }
.hdz-project-status { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; }
.hdz-status--draft { background: rgba(200,160,50,0.08); color: #7a6a30; }
.hdz-status--active { background: rgba(200,160,50,0.15); color: #5a4a20; }
.hdz-status--completed { background: rgba(200,160,50,0.1); color: #8a7a40; }
.hdz-project-title { font-size: 1.05rem; font-weight: 600; color: #5a4a20; flex: 1; min-width: 0; }
.hdz-project-title-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.hdz-project-title-input {
  flex: 1; font-size: 1rem; font-weight: 600; color: #5a4a20;
  padding: 2px 6px; border: 1px solid rgba(200,160,50,0.4); border-radius: 4px;
  background: rgba(255,255,255,0.8); outline: none;
  font-family: inherit;
}
.hdz-project-title-input:focus { border-color: rgba(200,160,50,0.7); box-shadow: 0 0 0 2px rgba(200,160,50,0.15); }
.hdz-project-rename-btn {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 4px;
  border: 1px solid transparent; background: transparent;
  font-size: 0.75rem; color: #b8a870; cursor: pointer; display: flex;
  align-items: center; justify-content: center; opacity: 0;
  transition: all 0.15s;
}
.hdz-project-card:hover .hdz-project-rename-btn { opacity: 1; }
.hdz-project-rename-btn:hover { border-color: rgba(200,160,50,0.3); background: rgba(200,160,50,0.08); color: #8a7a40; }
.hdz-project-delete-btn {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 4px;
  border: 1px solid transparent; background: transparent;
  font-size: 0.75rem; color: #b8a870; cursor: pointer; display: flex;
  align-items: center; justify-content: center; opacity: 0;
  transition: all 0.15s;
}
.hdz-project-card:hover .hdz-project-delete-btn { opacity: 1; }
.hdz-project-delete-btn:hover { border-color: rgba(200,80,50,0.3); background: rgba(200,80,50,0.08); color: #c62828; }
.hdz-project-desc { font-size: 0.75rem; color: #8a7a50; margin-bottom: 8px; line-height: 1.5; }
.hdz-project-meta { display: flex; gap: 16px; font-size: 0.75rem; color: #7a6a40; margin-bottom: 8px; }
.hdz-project-time { font-size: 0.7rem; color: #9a8a60; }

/* ========== 右侧建议栏 ========== */
.hdz-ws-aside {
  width: 220px; flex-shrink: 0;
  padding: 16px 12px;
  border-left: 1px solid rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.01);
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 20px;
}
.hdz-aside-title { font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
.hdz-aside-suggestions { display: flex; flex-direction: column; gap: 8px; }
.hdz-aside-suggestion {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 8px 10px; border-radius: 6px;
  background: rgba(0,0,0,0.02);
  font-size: 0.75rem; line-height: 1.5;
  color: #888;
  transition: all 0.15s;
}
.hdz-aside-suggestion:hover { background: rgba(0,0,0,0.04); color: #444; }
.hdz-aside-sug-icon { flex-shrink: 0; font-size: 0.9rem; }
.hdz-aside-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hdz-stat-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px; border-radius: 6px;
  background: rgba(0,0,0,0.02);
}
.hdz-stat-label { font-size: 0.65rem; color: #999; }
.hdz-stat-value { font-size: 1rem; font-weight: 600; color: #6b5a9f; }
.hdz-aside-next-steps { display: flex; flex-direction: column; gap: 6px; }
.hdz-aside-step-btn {
  text-align: left; width: 100%;
  padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.02); color: #888;
  font-size: 0.75rem; cursor: pointer; transition: all 0.15s;
}
.hdz-aside-step-btn:hover { background: rgba(168,130,255,0.06); border-color: rgba(168,130,255,0.15); color: #6b5a9f; }

/* ========== 弹窗 ========== */
.hdz-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
}
.hdz-modal {
  width: 480px; max-width: 90vw; padding: 28px;
  background: #faf7f0; border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.1);
  color: #333;
}
.hdz-modal-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 24px; color: #333; }
.hdz-form { display: flex; flex-direction: column; gap: 16px; }
.hdz-field { display: flex; flex-direction: column; gap: 6px; }
.hdz-field label { font-size: 0.8rem; color: #666; }
.hdz-required { color: #e04060; }
.hdz-field-row { display: flex; gap: 12px; }
.hdz-field-row .hdz-field { flex: 1; }
.hdz-input {
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 8px; padding: 10px 12px;
  color: #333; font-size: 0.85rem;
  outline: none; transition: border-color 0.2s;
}
.hdz-input:focus { border-color: rgba(168,130,255,0.5); }
.hdz-textarea { resize: vertical; font-family: inherit; }
select.hdz-input { cursor: pointer; appearance: auto; -webkit-appearance: auto; }
.hdz-modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
.hdz-error { color: #e04060; font-size: 0.8rem; margin-top: 12px; text-align: center; }

/* ========== 公用按钮 ========== */
.hdz-btn {
  padding: 8px 18px; border-radius: 6px;
  font-size: 0.8rem; font-weight: 500;
  border: none; cursor: pointer; transition: all 0.2s;
  display: inline-flex; align-items: center; gap: 4px;
}
.hdz-btn-primary {
  background: linear-gradient(135deg, rgba(168,130,255,0.15), rgba(180,140,200,0.15));
  color: #6b5a9f;
  border: 1px solid rgba(168,130,255,0.2);
}
.hdz-btn-primary:hover { background: linear-gradient(135deg, rgba(168,130,255,0.25), rgba(180,140,200,0.25)); }
.hdz-btn-primary:disabled { opacity: 0.4; cursor: default; }
.hdz-btn-ghost { background: transparent; color: #999; }
.hdz-btn-ghost:hover { color: #555; }
.hdz-btn-sm { padding: 6px 14px; font-size: 0.75rem; }
.hdz-btn-xs { padding: 4px 10px; font-size: 0.7rem; }
</style>
