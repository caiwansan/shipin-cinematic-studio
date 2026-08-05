<!--
  pages/admin/aigc/gifts.vue — 礼物商品管理（GIFT-GOLD-ECO-01）
  礼物在昆仑茶馆聊天场景赠送：钻石购买 → 接收方按 65% 即时结算金币
-->
<template>
  <div class="gifts-admin">
    <div class="admin-head">
      <div>
        <h1 class="admin-title">🎁 礼物商品管理</h1>
        <p class="admin-sub">礼物在昆仑茶馆聊天中赠送 · 收礼方按钻石价值 65% 即时结算金币</p>
      </div>
      <button class="add-btn" @click="openEdit(null)">+ 新增礼物</button>
    </div>

    <!-- 礼物列表 -->
    <div class="list-card">
      <div class="table-head">
        <span class="col-gift">礼物</span>
        <span class="col-price">钻石价格</span>
        <span class="col-cat">分类</span>
        <span class="col-sort">排序</span>
        <span class="col-status">状态</span>
        <span class="col-ops">操作</span>
      </div>
      <div v-for="g in gifts" :key="g.id" class="table-row">
        <span class="col-gift"><span class="gift-icon-cell">{{ g.iconUrl || '🎁' }}</span> {{ g.name }}</span>
        <span class="col-price">💎 {{ g.priceDiamonds }}</span>
        <span class="col-cat"><span class="cat-badge">{{ g.category }}</span></span>
        <span class="col-sort">{{ g.sortOrder }}</span>
        <span class="col-status">
          <button class="status-toggle" :class="g.isActive ? 'on' : 'off'" @click="toggleActive(g)">
            {{ g.isActive ? '上架中' : '已下架' }}
          </button>
        </span>
        <span class="col-ops">
          <button class="op-btn" @click="openEdit(g)">编辑</button>
          <button class="op-btn danger" @click="removeGift(g)">删除</button>
        </span>
      </div>
      <div v-if="!gifts.length" class="empty">暂无礼物，点击右上角「新增礼物」创建</div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="editing" class="modal-mask" @click.self="editing = null">
      <div class="modal-card">
        <button class="modal-close" @click="editing = null">✕</button>
        <h3>{{ editing.id ? '编辑礼物' : '新增礼物' }}</h3>
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
            <span>图标（emoji 或图片URL）</span>
            <input v-model="form.iconUrl" placeholder="💗 或 https://..." class="form-input" />
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
import { ref, onMounted } from 'vue'
definePageMeta({ layout: 'admin-aigc' })

const gifts = ref<any[]>([])
const editing = ref<any>(null)
const saving = ref(false)
const form = ref<any>({ name: '', priceDiamonds: 1, iconUrl: '', category: '热门', sortOrder: 0 })

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
    : { name: '', priceDiamonds: 1, iconUrl: '', category: '热门', sortOrder: 0 }
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
.gifts-admin { padding: 24px; max-width: 960px; }
.admin-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.admin-title { font-size: 22px; margin: 0; }
.admin-sub { color: rgba(255, 255, 255, 0.45); font-size: 13px; margin: 4px 0 0; }
.add-btn { background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 10px; color: #fff; padding: 10px 18px; font-weight: 700; cursor: pointer; }

.list-card { background: #0D1328; border: 1px solid #1A2240; border-radius: 14px; overflow: hidden; }
.table-head, .table-row { display: flex; align-items: center; padding: 12px 18px; gap: 8px; }
.table-head { background: rgba(255, 255, 255, 0.03); font-size: 12px; color: rgba(255, 255, 255, 0.4); }
.table-row { border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 14px; }
.col-gift { flex: 2; display: flex; align-items: center; gap: 8px; }
.col-price { flex: 1; color: #fbbf24; font-weight: 700; }
.col-cat { flex: 1; }
.col-sort { flex: 0.6; color: rgba(255, 255, 255, 0.5); }
.col-status { flex: 1; }
.col-ops { flex: 1.2; display: flex; gap: 8px; }
.gift-icon-cell { font-size: 22px; }
.cat-badge { background: rgba(251, 191, 36, 0.12); color: #fbbf24; border-radius: 999px; padding: 3px 10px; font-size: 12px; }
.status-toggle { border: none; border-radius: 999px; padding: 4px 12px; font-size: 12px; cursor: pointer; }
.status-toggle.on { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.status-toggle.off { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.5); }
.op-btn { background: rgba(255, 255, 255, 0.07); border: none; border-radius: 8px; color: rgba(255, 255, 255, 0.8); padding: 5px 12px; font-size: 12px; cursor: pointer; }
.op-btn.danger { color: #f87171; }
.empty { padding: 40px; text-align: center; color: rgba(255, 255, 255, 0.35); }

.modal-mask { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.modal-card { background: #0D1328; border: 1px solid #1A2240; border-radius: 16px; padding: 24px; width: 460px; max-width: 92vw; position: relative; }
.modal-close { position: absolute; top: 12px; right: 12px; background: none; border: none; color: rgba(255, 255, 255, 0.4); font-size: 18px; cursor: pointer; }
.modal-card h3 { margin: 0 0 18px; font-size: 16px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: rgba(255, 255, 255, 0.55); }
.form-input { background: #0B1020; border: 1px solid #1A2240; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: rgba(255, 255, 255, 0.8); outline: none; }
.form-input:focus { border-color: rgba(251, 191, 36, 0.5); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-ghost { background: rgba(255, 255, 255, 0.07); border: none; border-radius: 8px; color: rgba(255, 255, 255, 0.7); padding: 9px 18px; cursor: pointer; }
.btn-save { background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 8px; color: #fff; padding: 9px 24px; font-weight: 700; cursor: pointer; }
.btn-save:disabled { opacity: 0.5; }
</style>
