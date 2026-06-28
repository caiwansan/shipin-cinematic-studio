<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">COS 用户存储管理</h2>
      <div class="flex items-center gap-2">
        <button @click="fetchData" :disabled="syncing"
          class="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all disabled:opacity-50">
          {{ syncing ? '同步中...' : '🔄 同步会员' }}
        </button>
        <button @click="showConfigPanel = !showConfigPanel"
          class="px-3 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all">
          {{ showConfigPanel ? '收起配置' : '接入 COS 设置' }}
        </button>
      </div>
    </div>

    <!-- COS 配置面板 -->
    <div v-if="showConfigPanel" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-xs text-white/60 font-medium">存储配置管理</h3>
        <button @click="addConfig"
          class="px-3 py-1 text-[10px] bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/20 transition-all">
          + 新增配置
        </button>
      </div>

      <!-- 配置列表 -->
      <div class="space-y-2">
        <div v-for="cfg in configs" :key="cfg.id"
          class="flex items-center gap-3 p-3 bg-[#0B1020]/80 border border-[#1A2240]/50 rounded-lg">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs text-white/80 font-medium">{{ cfg.name }}</span>
              <span v-if="cfg.isDefault" class="px-1.5 py-0.5 text-[9px] bg-blue-500/10 text-blue-400 rounded">默认</span>
              <span v-if="!cfg.enabled" class="px-1.5 py-0.5 text-[9px] bg-gray-500/10 text-gray-400 rounded">已禁用</span>
              <span class="text-[10px] text-gray-500">{{ configTypeLabel(cfg.type) }}</span>
            </div>
            <div class="text-[10px] text-gray-600 mt-0.5 truncate">{{ cfg.endpoint }} / {{ cfg.bucket }}</div>
          </div>
          <div class="flex items-center gap-1.5">
            <button @click="editConfig(cfg)" class="px-2 py-1 text-[10px] text-gray-400 hover:text-white transition-all">编辑</button>
            <button v-if="!cfg.isDefault" @click="setDefault(cfg.id)" class="px-2 py-1 text-[10px] text-gray-400 hover:text-blue-400 transition-all">设默认</button>
            <button @click="toggleConfig(cfg.id, cfg.enabled)" class="px-2 py-1 text-[10px] text-gray-400 hover:text-yellow-400 transition-all">
              {{ cfg.enabled ? '禁用' : '启用' }}
            </button>
            <button @click="deleteConfig(cfg.id)" class="px-2 py-1 text-[10px] text-gray-400 hover:text-red-400 transition-all">删除</button>
          </div>
        </div>
        <div v-if="configs.length === 0" class="text-center py-6 text-gray-600 text-[10px]">暂无存储配置，点击"+ 新增配置"添加</div>
      </div>
    </div>

    <!-- 新增/编辑配置弹窗 -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showForm = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 w-full max-w-md mx-4">
        <h3 class="text-sm text-white/80 font-medium mb-4">{{ editingId ? '编辑存储配置' : '新增存储配置' }}</h3>
        <div class="space-y-3">
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">配置名称 *</label>
            <input v-model="form.name" type="text" placeholder="例：阿里云OSS"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-blue-500/50" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">存储类型</label>
              <select v-model="form.type"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-blue-500/50">
                <option value="minio">MinIO</option>
                <option value="aliyun-oss">阿里云 OSS</option>
                <option value="tencent-cos">腾讯云 COS</option>
                <option value="aws-s3">AWS S3</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">默认配置</label>
              <div class="flex items-center gap-2 h-full pt-1">
                <input type="checkbox" v-model="form.isDefault" id="isDefault" class="accent-blue-500" />
                <label for="isDefault" class="text-[10px] text-gray-400">设为默认</label>
              </div>
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">服务地址 *</label>
            <input v-model="form.endpoint" type="text" placeholder="https://oss-cn-hangzhou.aliyuncs.com"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">Region（可选）</label>
            <input v-model="form.region" type="text" placeholder="oss-cn-hangzhou"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-blue-500/50" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">Access Key *</label>
              <div class="flex gap-2">
                <input v-model="accessKeyDisplay" type="password" class="flex-1 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-blue-500/50" />
                <button @click="toggleAccessKeyEdit" class="px-2 py-1 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all cursor-pointer shrink-0">
                  {{ accessKeyEditing ? '取消' : '编辑' }}
                </button>
              </div>
              <p class="text-[9px] text-gray-600 mt-0.5" v-if="!accessKeyEditing && form.accessKey">当前以掩码显示，点击「编辑」可修改</p>
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">Secret Key *</label>
              <div class="flex gap-2">
                <input v-model="secretKeyDisplay" type="password" class="flex-1 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-blue-500/50" />
                <button @click="toggleSecretKeyEdit" class="px-2 py-1 text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-all cursor-pointer shrink-0">
                  {{ secretKeyEditing ? '取消' : '编辑' }}
                </button>
              </div>
              <p class="text-[9px] text-gray-600 mt-0.5" v-if="!secretKeyEditing && form.secretKey">当前以掩码显示，点击「编辑」可修改</p>
            </div>
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">Bucket</label>
            <input v-model="form.bucket" type="text" placeholder="aigc-assets"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">备注</label>
            <input v-model="form.remark" type="text" placeholder="可选"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 outline-none focus:border-blue-500/50" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showForm = false" class="px-4 py-2 text-xs text-gray-400 hover:text-white transition-all">取消</button>
          <button @click="saveConfig" :disabled="saving"
            class="px-4 py-2 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all disabled:opacity-50">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchData" class="ml-2 underline">重试</button>
    </div>
    <template v-else>
      <!-- Summary -->
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
          <div class="text-[10px] text-gray-500 uppercase mb-1">会员总数</div>
          <div class="text-base font-semibold">{{ memberCount }}</div>
        </div>
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
          <div class="text-[10px] text-gray-500 uppercase mb-1">VIP 会员</div>
          <div class="text-base font-semibold">{{ vipCount }}</div>
        </div>
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-4">
          <div class="text-[10px] text-gray-500 uppercase mb-1">总存储量</div>
          <div class="text-base font-semibold">{{ formatBytes(totalStorage) }}</div>
        </div>
      </div>

      <!-- 筛选 -->
      <div class="flex items-center gap-2 mb-3">
        <select v-model="filterTier" class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-1.5 text-[10px] text-white/60 outline-none focus:border-blue-500/50">
          <option value="">全部会员</option>
          <option value="vip">VIP</option>
          <option value="free">免费</option>
        </select>
        <input v-model="searchQuery" type="text" placeholder="搜索用户名/邮箱..."
          class="flex-1 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-1.5 text-[10px] text-white/60 outline-none focus:border-blue-500/50 max-w-xs" />
      </div>

      <!-- 用户存储列表 -->
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-[#1A2240] text-gray-500">
              <th class="text-left px-4 py-3 font-medium">用户</th>
              <th class="text-left px-4 py-3 font-medium">会员等级</th>
              <th class="text-left px-4 py-3 font-medium">存储用量</th>
              <th class="text-left px-4 py-3 font-medium">文件数</th>
              <th class="text-left px-4 py-3 font-medium">配额</th>
              <th class="text-left px-4 py-3 font-medium">使用率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUsers" :key="u.id || u.userId" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3">
                <div class="text-white/80">{{ u.username || '用户' }}</div>
                <div class="text-[9px] text-gray-600">{{ u.email || '' }}</div>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 text-[9px] rounded"
                  :class="isVip(u.memberTier) ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-500/10 text-gray-500'">
                  {{ getTierLabel(u.memberTier) }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-300">{{ formatBytes(u.storageUsed || u.usedBytes || 0) }}</td>
              <td class="px-4 py-3 text-gray-400">{{ u.fileCount || u.files || 0 }}</td>
              <td class="px-4 py-3 text-gray-400">{{ u.storageLimit ? formatBytes(u.storageLimit) : u.quota ? formatBytes(u.quota) : '不限' }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-20 h-1.5 bg-[#1A2240] rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all"
                      :style="{ width: Math.min(usagePercent(u), 100) + '%' }"
                      :class="usagePercent(u) > 80 ? 'bg-red-400' : usagePercent(u) > 50 ? 'bg-yellow-400' : 'bg-green-400'">
                    </div>
                  </div>
                  <span class="text-[10px] text-gray-500">{{ usagePercent(u).toFixed(0) }}%</span>
                </div>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-gray-600">
                {{ loading ? '加载中...' : '暂无会员存储数据，点击「同步会员」从数据库拉取' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 上次同步时间 -->
      <div class="text-[9px] text-gray-700 text-right">
        最后更新: {{ lastSyncTime }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
import { getTierLabel, isVip } from '~/constants/membership'
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted, watch } from 'vue'

const loading = ref(true)
const syncing = ref(false)
const error = ref('')
const storageUsers = ref<any[]>([])
const lastSyncTime = ref('--')
const showConfigPanel = ref(false)
const showForm = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const configs = ref<any[]>([])
const filterTier = ref('')
const searchQuery = ref('')

// 掩码显示变量
const accessKeyDisplay = ref('')
const secretKeyDisplay = ref('')
const accessKeyEditing = ref(false)
const secretKeyEditing = ref(false)

function maskValue(val: string): string {
  if (!val) return ''
  if (val.length <= 4) return '****' + val
  return '****' + val.slice(-4)
}

function toggleAccessKeyEdit() {
  accessKeyEditing.value = !accessKeyEditing.value
  if (accessKeyEditing.value) {
    accessKeyDisplay.value = form.value.accessKey
  } else {
    accessKeyDisplay.value = form.value.accessKey ? maskValue(form.value.accessKey) : ''
  }
}

function toggleSecretKeyEdit() {
  secretKeyEditing.value = !secretKeyEditing.value
  if (secretKeyEditing.value) {
    secretKeyDisplay.value = form.value.secretKey
  } else {
    secretKeyDisplay.value = form.value.secretKey ? maskValue(form.value.secretKey) : ''
  }
}

watch(accessKeyDisplay, (val) => {
  if (accessKeyEditing.value) form.value.accessKey = val
})
watch(secretKeyDisplay, (val) => {
  if (secretKeyEditing.value) form.value.secretKey = val
})

const defaultForm = () => ({
  name: '',
  type: 'minio',
  endpoint: '',
  region: '',
  accessKey: '',
  secretKey: '',
  bucket: 'aigc-assets',
  isDefault: false,
  enabled: true,
  remark: '',
})
const form = ref(defaultForm())

const memberCount = computed(() => storageUsers.value.length)
const vipCount = computed(() => storageUsers.value.filter(u => u.memberTier && u.memberTier !== 'free').length)
const totalStorage = computed(() => storageUsers.value.reduce((sum: number, u: any) => sum + (u.storageUsed || u.usedBytes || 0), 0))

const filteredUsers = computed(() => {
  let list = storageUsers.value
  if (filterTier.value === 'vip') {
    list = list.filter(u => u.memberTier && u.memberTier !== 'free')
  } else if (filterTier.value === 'free') {
    list = list.filter(u => !u.memberTier || u.memberTier === 'free')
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((u: any) =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
  }
  return list
})

function tierLabel(tier: string): string {
  return getTierLabel(tier)
}

function configTypeLabel(type: string): string {
  const map: Record<string, string> = { 'minio': 'MinIO', 'aliyun-oss': '阿里云OSS', 'tencent-cos': '腾讯云COS', 'aws-s3': 'AWS S3' }
  return map[type] || type
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}

function usagePercent(u: any): number {
  const used = u.storageUsed || u.usedBytes || 0
  const limit = u.storageLimit || u.quota || 0
  if (!limit) return 0
  return (used / limit) * 100
}

// COS 配置操作
const token = () => getToken() || ''

async function fetchConfigs() {
  try {
    const res = await fetch('/api/admin/storage-config', { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const d = await res.json()
      configs.value = d.data || []
    }
  } catch {}
}

function addConfig() {
  editingId.value = null
  form.value = defaultForm()
  accessKeyDisplay.value = ''
  secretKeyDisplay.value = ''
  accessKeyEditing.value = false
  secretKeyEditing.value = false
  showForm.value = true
}

function editConfig(cfg: any) {
  editingId.value = cfg.id
  form.value = { ...cfg, secretKey: cfg.secretKey || '', accessKey: cfg.accessKey || '' }
  // 设置掩码
  accessKeyDisplay.value = form.value.accessKey ? maskValue(form.value.accessKey) : ''
  secretKeyDisplay.value = form.value.secretKey ? maskValue(form.value.secretKey) : ''
  accessKeyEditing.value = false
  secretKeyEditing.value = false
  showForm.value = true
}

async function saveConfig() {
  saving.value = true
  try {
    const body = editingId.value ? { ...form.value, id: editingId.value } : { ...form.value }
    const res = await fetch('/api/admin/storage-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      showForm.value = false
      await fetchConfigs()
    } else {
      const d = await res.json()
      alert(d.error || '保存失败')
    }
  } catch { alert('保存失败') } finally { saving.value = false }
}

async function setDefault(id: string) {
  await fetch(`/api/admin/storage-config/${id}/default`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
  await fetchConfigs()
}

async function toggleConfig(id: string) {
  await fetch(`/api/admin/storage-config/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } })
  await fetchConfigs()
}

async function deleteConfig(id: string) {
  if (!confirm('确认删除此存储配置？')) return
  await fetch(`/api/admin/storage-config/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
  await fetchConfigs()
}

async function fetchData() {
  syncing.value = true
  loading.value = true
  error.value = ''
  try {
    const t = getToken()
    const res = await fetch('/api/admin/members-storage', {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    })
    if (res.ok) {
      const d = await res.json()
      storageUsers.value = d.data || []
      lastSyncTime.value = new Date().toLocaleString('zh-CN', { hour12: false })
    } else {
      throw new Error(`API 返回 ${res.status}`)
    }
  } catch (e: any) {
    error.value = `同步失败: ${e.message}`
  }
  loading.value = false
  syncing.value = false
}

onMounted(() => { fetchData(); fetchConfigs() })
</script>
