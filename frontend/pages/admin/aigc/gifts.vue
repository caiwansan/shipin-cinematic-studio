<!--
  pages/admin/aigc/gifts.vue — 礼物商品管理（GIFT-GOLD-ECO-01 / COMMUNITY-GIFT-DOUYIN-01）
  抖音式礼物墙：分类分区卡片 + 渐变图标 + emoji 图标选择器 + 渐变配色 + 实时预览 + 抖音礼物库一键填充
  礼物在昆仑茶馆聊天场景赠送：钻石购买 → 接收方按 65% 即时结算金币
-->
<template>
  <div class="gifts-admin">
    <div class="admin-head">
      <div>
        <h1 class="admin-title">🎁 礼物商品管理</h1>
        <p class="admin-sub">抖音式礼物墙 · 收礼方按钻石价值 65% 即时结算金币 · 共 {{ totalCount }} 款 · 💎 {{ totalRange }}</p>
      </div>
      <div class="head-actions">
        <button class="template-btn" @click="templateOpen = true">📦 抖音礼物库</button>
        <button class="add-btn" @click="openEdit(null)">+ 新增礼物</button>
      </div>
    </div>

    <!-- 抖音礼物库（一键填充） -->
    <div v-if="templateOpen" class="modal-mask" @click.self="templateOpen = false">
      <div class="modal-card template-card">
        <button class="modal-close" @click="templateOpen = false">✕</button>
        <h3>📦 抖音礼物库 <span class="tpl-sub">点选礼物快速填充编辑表单</span></h3>
        <div class="tpl-grid">
          <button
            v-for="t in DOUYIN_TEMPLATES"
            :key="t.name"
            class="tpl-item"
            @click="pickTemplate(t)"
          >
            <span class="tpl-icon" :style="{ background: t.gradient }">{{ t.iconUrl }}</span>
            <span class="tpl-name">{{ t.name }}</span>
            <span class="tpl-price">💎{{ t.priceDiamonds }}</span>
            <span class="tpl-cat">{{ t.category }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 礼物列表：按分类分区（抖音式） -->
    <div v-for="sec in sections" :key="sec.category" class="section">
      <div class="section-head">
        <span class="section-title" :style="{ color: sec.color }">{{ sec.emoji }} {{ sec.category }}</span>
        <span class="section-count">{{ sec.items.length }} 款</span>
      </div>
      <div class="gift-grid">
        <div v-for="g in sec.items" :key="g.id" class="gift-card" :class="{ 'is-off': !g.isActive }">
          <div class="gift-card-top">
            <span
              class="gift-big-icon"
              :style="{ background: g.iconGradient || 'linear-gradient(135deg,#1e293b,#334155)' }"
            >{{ g.iconUrl || '🎁' }}</span>
            <div class="gift-meta">
              <div class="gift-name">{{ g.name }}</div>
              <div class="gift-price">💎 {{ g.priceDiamonds }}</div>
            </div>
            <button class="status-toggle" :class="g.isActive ? 'on' : 'off'" @click="toggleActive(g)">
              {{ g.isActive ? '上架中' : '已下架' }}
            </button>
          </div>
          <div class="gift-card-foot">
            <span class="gift-sort">排序 {{ g.sortOrder }}</span>
            <div class="gift-ops">
              <button class="op-btn" @click="openEdit(g)">编辑</button>
              <button class="op-btn danger" @click="removeGift(g)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!sec.items.length" class="empty">该分类暂无礼物</div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="editing" class="modal-mask" @click.self="editing = null">
      <div class="modal-card edit-card">
        <button class="modal-close" @click="editing = null">✕</button>
        <h3>{{ editing.id ? '编辑礼物' : '新增礼物' }}</h3>

        <!-- 实时预览 -->
        <div class="live-preview">
          <span
            class="preview-icon"
            :style="{ background: form.iconGradient || 'linear-gradient(135deg,#1e293b,#334155)' }"
          >{{ form.iconUrl || '🎁' }}</span>
          <div class="preview-meta">
            <div class="preview-name">{{ form.name || '礼物名称' }}</div>
            <div class="preview-price">💎 {{ form.priceDiamonds || 0 }} 钻石</div>
            <div class="preview-cat">{{ form.category }}</div>
          </div>
        </div>

        <!-- emoji 图标选择器 -->
        <div class="form-section">
          <span class="form-label">图标（点选 emoji）</span>
          <div class="emoji-picker">
            <button
              v-for="e in EMOJIS"
              :key="e"
              class="emoji-cell"
              :class="{ 'emoji-cell--on': form.iconUrl === e }"
              @click="form.iconUrl = e"
            >{{ e }}</button>
          </div>
        </div>

        <!-- 渐变配色选择器 -->
        <div class="form-section">
          <span class="form-label">渐变底色</span>
          <div class="gradient-picker">
            <button
              v-for="gd in GRADIENTS"
              :key="gd"
              class="gradient-cell"
              :class="{ 'gradient-cell--on': form.iconGradient === gd }"
              :style="{ background: gd }"
              @click="form.iconGradient = gd"
            >{{ form.iconGradient === gd ? '✓' : '' }}</button>
            <input v-model="form.iconGradient" class="form-input gradient-custom" placeholder="或自定义 linear-gradient(...)" />
          </div>
        </div>

        <div class="form-grid">
          <label class="form-field">
            <span>礼物名称</span>
            <input v-model="form.name" placeholder="如：小心心" class="form-input" />
          </label>
          <label class="form-field">
            <span>钻石价格</span>
            <input v-model.number="form.priceDiamonds" type="number" min="1" class="form-input" />
          </label>
          <label class="form-field">
            <span>分类（抖音式）</span>
            <select v-model="form.category" class="form-input">
              <option>热门</option>
              <option>豪华</option>
              <option>专属</option>
              <option>其他</option>
            </select>
          </label>
          <label class="form-field">
            <span>排序（小在前）</span>
            <input v-model.number="form.sortOrder" type="number" class="form-input" />
          </label>
        </div>
        <div class="form-actions">
          <button class="btn-ghost" @click="editing = null">取消</button>
          <button class="btn-save" :disabled="saving" @click="saveGift">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
definePageMeta({ layout: 'admin-aigc' })

// ── 抖音式礼物库预设（与后端 seed 对齐） ──
const DOUYIN_TEMPLATES = [
  { name: '荧光棒', priceDiamonds: 5, iconUrl: '✨', gradient: 'linear-gradient(135deg,#84fab0,#8fd3f4)', category: '热门' },
  { name: '小心心', priceDiamonds: 10, iconUrl: '💗', gradient: 'linear-gradient(135deg,#ff9a9e,#fecfef)', category: '热门' },
  { name: '玫瑰花', priceDiamonds: 20, iconUrl: '🌹', gradient: 'linear-gradient(135deg,#ff758c,#ff7eb3)', category: '热门' },
  { name: '棒棒糖', priceDiamonds: 30, iconUrl: '🍭', gradient: 'linear-gradient(135deg,#f6d365,#fda085)', category: '热门' },
  { name: '星星', priceDiamonds: 50, iconUrl: '⭐', gradient: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)', category: '热门' },
  { name: '奶茶', priceDiamonds: 66, iconUrl: '🧋', gradient: 'linear-gradient(135deg,#e0b58f,#f5d9b8)', category: '热门' },
  { name: '纸飞机', priceDiamonds: 66, iconUrl: '✈️', gradient: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)', category: '热门' },
  { name: '热气球', priceDiamonds: 100, iconUrl: '🎈', gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', category: '豪华' },
  { name: '冰淇淋', priceDiamonds: 128, iconUrl: '🍦', gradient: 'linear-gradient(135deg,#ffecd2,#fcb69f)', category: '豪华' },
  { name: '甜甜圈', priceDiamonds: 168, iconUrl: '🍩', gradient: 'linear-gradient(135deg,#fbc2eb,#ff9a9e)', category: '豪华' },
  { name: '盲盒', priceDiamonds: 199, iconUrl: '🎁', gradient: 'linear-gradient(135deg,#667eea,#764ba2)', category: '豪华' },
  { name: '彩虹', priceDiamonds: 258, iconUrl: '🌈', gradient: 'linear-gradient(135deg,#43e97b,#38f9d7)', category: '豪华' },
  { name: '烟花', priceDiamonds: 520, iconUrl: '🎆', gradient: 'linear-gradient(135deg,#fa709a,#fee140)', category: '豪华' },
  { name: '跑车', priceDiamonds: 666, iconUrl: '🏎️', gradient: 'linear-gradient(135deg,#ff9a9e,#fad0c4)', category: '豪华' },
  { name: '火箭', priceDiamonds: 1314, iconUrl: '🚀', gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)', category: '专属' },
  { name: '豪华游艇', priceDiamonds: 2000, iconUrl: '🛥️', gradient: 'linear-gradient(135deg,#0ba360,#3cba92)', category: '专属' },
  { name: '嘉年华', priceDiamonds: 3000, iconUrl: '🎡', gradient: 'linear-gradient(135deg,#c471f5,#fa71cd)', category: '专属' },
  { name: '梦幻城堡', priceDiamonds: 5200, iconUrl: '🏰', gradient: 'linear-gradient(135deg,#f6d365,#fda085)', category: '专属' },
  { name: '至尊皇冠', priceDiamonds: 8888, iconUrl: '👑', gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', category: '专属' },
  { name: '守护天使', priceDiamonds: 13140, iconUrl: '👼', gradient: 'linear-gradient(135deg,#e0c3fc,#8ec5fc)', category: '专属' },
]

// ── 精选礼物 emoji 图标库 ──
const EMOJIS = [
  '💗', '❤️', '🧡', '💛', '💚', '💙', '💜', '💖', '💘', '💝', '💕',
  '🌹', '🌸', '🌺', '💐', '🌷', '🌻', '🪷', '🌼',
  '🍭', '🍬', '🍫', '🍦', '🍩', '🧋', '🎂', '🍰', '🍎', '🍇',
  '⭐', '🌟', '✨', '🎈', '🎆', '🎇', '🎉', '🎊', '🎁', '🏆',
  '👑', '💎', '🚀', '🏎️', '🛥️', '✈️', '🎡', '🎠', '🌈', '☁️',
  '🦋', '🐰', '🍀', '🎵', '🎤', '📣', '🕯️', '🎐', '👼', '🐻',
]

// ── 预设渐变配色 ──
const GRADIENTS = [
  'linear-gradient(135deg,#ff9a9e,#fecfef)',
  'linear-gradient(135deg,#ff758c,#ff7eb3)',
  'linear-gradient(135deg,#f6d365,#fda085)',
  'linear-gradient(135deg,#fbc2eb,#a6c1ee)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#84fab0,#8fd3f4)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#f7971e,#ffd200)',
  'linear-gradient(135deg,#c471f5,#fa71cd)',
  'linear-gradient(135deg,#0ba360,#3cba92)',
  'linear-gradient(135deg,#e0c3fc,#8ec5fc)',
  'linear-gradient(135deg,#ffecd2,#fcb69f)',
]

const SECTION_META: Record<string, { emoji: string; color: string }> = {
  '热门': { emoji: '🔥', color: '#fb7185' },
  '豪华': { emoji: '💎', color: '#38bdf8' },
  '专属': { emoji: '👑', color: '#fbbf24' },
  '其他': { emoji: '🎁', color: '#a78bfa' },
}

const gifts = ref<any[]>([])
const editing = ref<any>(null)
const saving = ref(false)
const templateOpen = ref(false)
const form = ref<any>({ name: '', priceDiamonds: 1, iconUrl: '', iconGradient: '', category: '热门', sortOrder: 0 })

const sections = computed(() => {
  const cats = ['热门', '豪华', '专属', '其他']
  return cats.map((c) => ({
    category: c,
    emoji: SECTION_META[c]?.emoji || '🎁',
    color: SECTION_META[c]?.color || '#a78bfa',
    items: gifts.value.filter((g) => g.category === c),
  }))
})
const totalCount = computed(() => gifts.value.length)
const totalRange = computed(() => {
  if (!gifts.value.length) return '—'
  const prices = gifts.value.map((g) => g.priceDiamonds)
  return `${Math.min(...prices)} ~ ${Math.max(...prices)}`
})

function adminToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

async function load() {
  try {
    const r = await fetch('/api/admin/gifts/products', { headers: { Authorization: 'Bearer ' + adminToken() } })
    const j = await r.json()
    gifts.value = (j.data || {}).gifts || []
  } catch { gifts.value = [] }
}

function openEdit(g: any) {
  editing.value = g
  form.value = g
    ? { ...g }
    : { name: '', priceDiamonds: 1, iconUrl: '', iconGradient: '', category: '热门', sortOrder: 0 }
}

function pickTemplate(t: any) {
  editing.value = { id: null }
  form.value = { name: t.name, priceDiamonds: t.priceDiamonds, iconUrl: t.iconUrl, iconGradient: t.gradient, category: t.category, sortOrder: 0 }
  templateOpen.value = false
}

async function saveGift() {
  if (!form.value.name || !form.value.priceDiamonds || form.value.priceDiamonds < 1) {
    alert('请填写名称且钻石价格 ≥ 1')
    return
  }
  saving.value = true
  try {
    const url = editing.value?.id
      ? '/api/admin/gifts/products/' + editing.value.id
      : '/api/admin/gifts/products'
    const r = await fetch(url, {
      method: editing.value?.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken() },
      body: JSON.stringify(form.value),
    })
    const j = await r.json()
    if (j.success) {
      editing.value = null
      await load()
    } else {
      alert(j.error || '保存失败')
    }
  } catch { alert('保存失败') } finally { saving.value = false }
}

async function toggleActive(g: any) {
  await fetch('/api/admin/gifts/products/' + g.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken() },
    body: JSON.stringify({ isActive: !g.isActive }),
  })
  await load()
}

async function removeGift(g: any) {
  if (!confirm(`确定删除礼物「${g.name}」？历史赠送记录保留`)) return
  await fetch('/api/admin/gifts/products/' + g.id, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + adminToken() },
  })
  await load()
}

onMounted(load)
</script>

<style scoped>
.gifts-admin { padding: 24px; max-width: 1080px; }
.admin-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.admin-title { font-size: 22px; margin: 0; }
.admin-sub { color: rgba(255, 255, 255, 0.45); font-size: 13px; margin: 4px 0 0; }
.head-actions { display: flex; gap: 10px; }
.add-btn { background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 10px; color: #fff; padding: 10px 18px; font-weight: 700; cursor: pointer; }
.template-btn { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; color: rgba(255, 255, 255, 0.85); padding: 10px 16px; font-weight: 600; cursor: pointer; }
.template-btn:hover { border-color: rgba(251, 191, 36, 0.5); color: #fbbf24; }

/* ── 分类分区 ── */
.section { margin-bottom: 26px; }
.section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.section-title { font-size: 17px; font-weight: 800; letter-spacing: 0.5px; }
.section-count { font-size: 12px; color: rgba(255, 255, 255, 0.35); }

.gift-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.gift-card { background: #0D1328; border: 1px solid #1A2240; border-radius: 14px; padding: 14px; transition: transform 0.12s, border-color 0.12s; }
.gift-card:hover { transform: translateY(-2px); border-color: rgba(251, 191, 36, 0.35); }
.gift-card.is-off { opacity: 0.55; }
.gift-card-top { display: flex; align-items: center; gap: 12px; }
.gift-big-icon {
  width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
  font-size: 28px; flex-shrink: 0; box-shadow: inset 0 -8px 16px rgba(255,255,255,0.18), inset 0 2px 4px rgba(255,255,255,0.35), 0 6px 14px rgba(0,0,0,0.35);
  text-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
.gift-meta { flex: 1; min-width: 0; }
.gift-name { font-size: 15px; font-weight: 700; color: rgba(255, 255, 255, 0.92); }
.gift-price { font-size: 13px; color: #fbbf24; font-weight: 700; margin-top: 2px; }
.status-toggle { border: none; border-radius: 999px; padding: 4px 10px; font-size: 11px; cursor: pointer; flex-shrink: 0; }
.status-toggle.on { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.status-toggle.off { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.5); }
.gift-card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.gift-sort { font-size: 11px; color: rgba(255, 255, 255, 0.35); }
.gift-ops { display: flex; gap: 8px; }
.op-btn { background: rgba(255, 255, 255, 0.07); border: none; border-radius: 8px; color: rgba(255, 255, 255, 0.8); padding: 4px 12px; font-size: 12px; cursor: pointer; }
.op-btn.danger { color: #f87171; }
.empty { padding: 32px; text-align: center; color: rgba(255, 255, 255, 0.35); background: #0D1328; border: 1px dashed #1A2240; border-radius: 14px; }

/* ── 弹窗 ── */
.modal-mask { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.modal-card { background: #0D1328; border: 1px solid #1A2240; border-radius: 16px; padding: 24px; width: 640px; max-width: 94vw; position: relative; max-height: 88vh; overflow-y: auto; }
.modal-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: rgba(255, 255, 255, 0.4); font-size: 18px; cursor: pointer; z-index: 2; }
.modal-card h3 { margin: 0 0 18px; font-size: 16px; }
.tpl-sub { font-size: 12px; color: rgba(255, 255, 255, 0.4); font-weight: 400; margin-left: 8px; }

/* 礼物库 */
.template-card { width: 720px; }
.tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
.tpl-item { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px 6px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; transition: transform 0.12s, border-color 0.12s; }
.tpl-item:hover { transform: translateY(-2px); border-color: rgba(251, 191, 36, 0.5); }
.tpl-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: inset 0 -6px 12px rgba(255,255,255,0.18), 0 4px 10px rgba(0,0,0,0.3); }
.tpl-name { font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.9); }
.tpl-price { font-size: 11px; color: #fbbf24; font-weight: 700; }
.tpl-cat { font-size: 10px; color: rgba(255, 255, 255, 0.4); }

/* 实时预览 */
.live-preview { display: flex; align-items: center; gap: 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 14px; padding: 14px; margin-bottom: 16px; }
.preview-icon { width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 34px; box-shadow: inset 0 -8px 16px rgba(255,255,255,0.18), inset 0 2px 4px rgba(255,255,255,0.35), 0 6px 16px rgba(0,0,0,0.35); text-shadow: 0 2px 6px rgba(0,0,0,0.25); }
.preview-name { font-size: 17px; font-weight: 800; color: rgba(255, 255, 255, 0.95); }
.preview-price { font-size: 14px; color: #fbbf24; font-weight: 700; margin-top: 2px; }
.preview-cat { font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 2px; }

/* emoji 选择器 */
.form-section { margin-bottom: 14px; }
.form-label { display: block; font-size: 12px; color: rgba(255, 255, 255, 0.55); margin-bottom: 8px; }
.emoji-picker { display: flex; flex-wrap: wrap; gap: 4px; }
.emoji-cell { width: 34px; height: 34px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid transparent; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.emoji-cell:hover { background: rgba(255, 255, 255, 0.1); }
.emoji-cell--on { border-color: #fbbf24; background: rgba(251, 191, 36, 0.15); }

/* 渐变选择器 */
.gradient-picker { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.gradient-cell { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; font-size: 13px; color: #fff; font-weight: 800; text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
.gradient-cell:hover { transform: scale(1.12); }
.gradient-cell--on { border-color: #fff; box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.6); }
.gradient-custom { width: 260px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 6px; }
.form-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.55); }
.form-input { background: #0B1020; border: 1px solid #1A2240; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: rgba(255, 255, 255, 0.8); outline: none; }
.form-input:focus { border-color: rgba(251, 191, 36, 0.5); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-ghost { background: rgba(255, 255, 255, 0.07); border: none; border-radius: 8px; color: rgba(255, 255, 255, 0.7); padding: 9px 18px; cursor: pointer; }
.btn-save { background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 8px; color: #fff; padding: 9px 24px; font-weight: 700; cursor: pointer; }
.btn-save:disabled { opacity: 0.5; }
</style>
