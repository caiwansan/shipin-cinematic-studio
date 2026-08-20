<template>
  <div class="min-h-full" style="background: #070B16">
    <div class="max-w-[1000px] mx-auto px-4 py-4 space-y-4">
      <div>
        <h1 class="text-lg font-bold text-amber-300 tracking-wider">🔐 昆仑茶馆 · 会员密钥管理（监管合规）</h1>
        <p class="text-xs text-slate-400 mt-1">仅 admin 可见 · 需监管私钥签名解锁 · 配合国家监管部门调取会员身份信息/登录记录/备份索引</p>
      </div>

      <!-- ① 监管密钥设置 -->
      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4">
        <h2 class="text-sm font-bold text-amber-300 mb-2">① 监管密钥设置</h2>
        <label class="text-xs text-slate-400 block mb-1">监管公钥（SPKI PEM，由监管私钥生成）</label>
        <textarea v-model="guardKey" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" rows="4" placeholder="-----BEGIN PUBLIC KEY-----..."></textarea>
        <div class="flex gap-2 mt-3 flex-wrap">
          <button @click="genKeyPair" class="px-3.5 py-2 rounded-lg text-xs bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold cursor-pointer">⚡ 首次生成管理员密钥对</button>
          <button @click="saveGuardKey" class="px-3.5 py-2 rounded-lg text-xs border border-slate-600 text-slate-300 hover:text-white cursor-pointer">保存公钥</button>
          <button @click="loadGuardKey" class="px-3.5 py-2 rounded-lg text-xs border border-slate-600 text-slate-300 hover:text-white cursor-pointer">读取当前状态</button>
        </div>
        <div v-if="guardStatus" :class="statusCls(guardStatus[0])" class="mt-3 text-xs rounded-lg px-3 py-2 whitespace-pre-wrap">{{ guardStatus[1] }}</div>
        <div v-if="privShow" class="mt-2 text-xs rounded-lg px-3 py-2 bg-amber-950/40 border border-amber-700/40 text-amber-200 whitespace-pre-wrap">
          {{ privShow }}
          <div class="mt-2"><button @click="downloadPriv" class="px-3 py-1.5 rounded-lg text-xs bg-red-900/40 border border-red-700/50 text-red-200 cursor-pointer">💾 下载私钥文件</button></div>
        </div>
      </div>

      <!-- ② 监管私钥解锁 -->
      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4">
        <h2 class="text-sm font-bold text-amber-300 mb-2">② 监管私钥解锁</h2>
        <div :class="unlockToken ? 'text-emerald-400 font-bold text-sm mb-2' : 'text-red-400 font-bold text-sm mb-2'">● {{ unlockToken ? '已解锁（至 ' + unlockExpire + '）' : '未解锁' }}</div>
        <label class="text-xs text-slate-400 block mb-1">监管私钥（PKCS8 PEM，仅本地签名用，不上传）</label>
        <textarea v-model="guardPriv" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono" rows="4" placeholder="-----BEGIN PRIVATE KEY-----..."></textarea>
        <div class="flex gap-2 mt-3">
          <button @click="unlock" class="px-3.5 py-2 rounded-lg text-xs bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold cursor-pointer">🔓 私钥签名解锁（30 分钟）</button>
          <button @click="lock" class="px-3.5 py-2 rounded-lg text-xs border border-slate-600 text-slate-300 hover:text-white cursor-pointer">锁定</button>
        </div>
        <div v-if="unlockStatus" :class="statusCls(unlockStatus[0])" class="mt-3 text-xs rounded-lg px-3 py-2 whitespace-pre-wrap">{{ unlockStatus[1] }}</div>
      </div>

      <!-- ③ 会员信息调取 -->
      <div class="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-4">
        <h2 class="text-sm font-bold text-amber-300 mb-2">③ 会员信息调取（需解锁）</h2>
        <label class="text-xs text-slate-400 block mb-1">用户标识（用户名 / 手机号 / 用户ID / 公钥指纹）</label>
        <input v-model="q" @input="onUserSearch" class="w-full bg-black/40 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200" placeholder="搜索用户（用户名/手机号）" />
        <div class="mt-2 max-h-[200px] overflow-y-auto border border-slate-800 rounded-lg bg-black/25">
          <div v-if="userLoading" class="text-xs text-slate-500 px-3 py-2">⏳ 加载用户列表…</div>
          <div v-else-if="!users.length && unlockToken" class="text-xs text-slate-500 px-3 py-2">无匹配用户</div>
          <div v-for="u in users" :key="u.id" @click="selectUser(u)" class="flex items-center gap-3 px-3 py-2 border-b border-slate-800/50 cursor-pointer hover:bg-amber-500/10 text-xs">
            <span class="text-amber-300 w-2/5 truncate">{{ u.username || '?' }}</span>
            <span class="text-slate-400 flex-1">{{ u.phone || '-' }}</span>
            <span class="text-emerald-400">调取 →</span>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button @click="queryUser" class="px-3.5 py-2 rounded-lg text-xs bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold cursor-pointer">🔎 调取用户信息</button>
          <button @click="queryBackups" class="px-3.5 py-2 rounded-lg text-xs border border-slate-600 text-slate-300 hover:text-white cursor-pointer">🗄 备份分片索引</button>
        </div>
        <div v-if="queryStatus" :class="statusCls(queryStatus[0])" class="mt-3 text-xs rounded-lg px-3 py-2 whitespace-pre-wrap">{{ queryStatus[1] }}</div>
        <pre v-if="queryOut" class="mt-3 max-h-[340px] overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-slate-300 bg-black/40 border border-slate-800 rounded-lg p-3">{{ queryOut }}</pre>
        <div v-if="queryOut" class="mt-2"><button @click="copyQuery" class="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 hover:text-white cursor-pointer">📋 复制全部详情</button></div>
      </div>

      <div class="text-[11px] text-slate-500 leading-relaxed">
        ⚠️ 合规说明：本功能仅用于配合国家监管部门调查（如用户通过社区/聊天实施诈骗）。调取内容：身份公钥、登录 IP 记录、助记词加密的私钥托管密文（助记词明文仅用户本地持有）、分布式备份分片索引。所有操作需 admin 监管私钥签名验证后方可执行，无私钥无权访问。请依法使用。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref } from 'vue'

const guardKey = ref('')
const guardPriv = ref('')
const guardStatus = ref<[string, string] | null>(null)
const privShow = ref('')
const unlockToken = ref('')
const unlockExpire = ref('')
const unlockStatus = ref<[string, string] | null>(null)
const q = ref('')
const users = ref<any[]>([])
const userLoading = ref(false)
const queryStatus = ref<[string, string] | null>(null)
const queryOut = ref('')

function tok() { return window.localStorage?.getItem('auth_token') || '' }
function statusCls(k: string) {
  if (k === 'ok') return 'bg-emerald-900/30 border border-emerald-700/40 text-emerald-200'
  if (k === 'warn') return 'bg-amber-900/30 border border-amber-700/40 text-amber-200'
  return 'bg-red-900/30 border border-red-700/40 text-red-200'
}
async function api(path: string, opts: any = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok(), ...(opts.headers || {}) } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || j.message || ('HTTP ' + res.status))
  return j
}

async function genKeyPair() {
  try {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const pubRaw = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey))
    const privRaw = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey))
    const pubPem = '-----BEGIN PUBLIC KEY-----\n' + btoa(String.fromCharCode(...pubRaw)).replace(/(.{64})/g, '$1\n') + '\n-----END PUBLIC KEY-----'
    const privPem = '-----BEGIN PRIVATE KEY-----\n' + btoa(String.fromCharCode(...privRaw)).replace(/(.{64})/g, '$1\n') + '\n-----END PRIVATE KEY-----'
    guardKey.value = pubPem
    window.__guardPriv = privPem
    guardStatus.value = ['warn', '⏳ 正在自动保存公钥…']
    try {
      await api('/api/admin/identity/guard-key', { method: 'PUT', body: JSON.stringify({ publicKey: pubPem }) })
      guardStatus.value = ['ok', '✅ 密钥对已生成，公钥已【自动保存】——①立即下载私钥 ②粘贴私钥到②区解锁（私钥仅显示这一次）']
    } catch (e: any) {
      guardStatus.value = ['err', '⚠️ 公钥自动保存失败：' + e.message + '\n请手动点「保存公钥」后再解锁']
    }
    privShow.value = '🔒 管理员监管私钥（只显示这一次，请立即复制或下载）：\n' + privPem
  } catch (e: any) { guardStatus.value = ['err', '❌ ' + e.message] }
}
function downloadPriv() {
  const a = document.createElement('a')
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(privShow.value.replace(/^🔒.*\n/, ''))
  a.download = 'kunlun-guard-private-key.pem'
  a.click()
  alert('私钥已下载，请妥善保管')
}
async function loadGuardKey() {
  try { const j = await api('/api/admin/identity/guard-key'); guardStatus.value = ['ok', j.data.hasKey ? '已配置监管公钥（指纹 ' + j.data.keyMasked + '）' : '未配置监管公钥'] }
  catch (e: any) { guardStatus.value = ['err', '❌ ' + e.message] }
}
async function saveGuardKey() {
  const pub = guardKey.value.trim()
  if (!pub) { guardStatus.value = ['err', '请输入公钥']; return }
  try { await api('/api/admin/identity/guard-key', { method: 'PUT', body: JSON.stringify({ publicKey: pub }) }); guardStatus.value = ['ok', '✅ 监管公钥已保存'] }
  catch (e: any) { guardStatus.value = ['err', '❌ ' + e.message] }
}
async function signChallenge(privPem: string, challenge: string) {
  const pem = privPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(challenge)))
  const half = sig.length / 2
  const r = sig.slice(0, half), s = sig.slice(half)
  const enc = (v: Uint8Array) => { let b = v; while (b[0] === 0) b = b.slice(1); if (b[0] & 0x80) b = new Uint8Array([0, ...b]); return new Uint8Array([0x02, b.length, ...b]) }
  const body = new Uint8Array([...enc(r), ...enc(s)])
  const out = new Uint8Array([0x30, body.length, ...body])
  return btoa(String.fromCharCode(...out))
}
async function unlock() {
  const priv = guardPriv.value.trim()
  if (!priv) { unlockStatus.value = ['err', '请输入监管私钥']; return }
  try {
    unlockStatus.value = ['warn', '⏳ 获取挑战…']
    const c = await api('/api/admin/identity/challenge', { method: 'POST', body: '{}' })
    unlockStatus.value = ['warn', '⏳ 私钥签名中…']
    const signature = await signChallenge(priv, c.data.challenge)
    const u = await api('/api/admin/identity/unlock', { method: 'POST', body: JSON.stringify({ challenge: c.data.challenge, signature }) })
    unlockToken.value = u.data.unlockToken
    unlockExpire.value = new Date(u.data.expireAt).toLocaleTimeString('zh-CN')
    unlockStatus.value = ['ok', '✅ 私钥验证通过，监管会话已解锁（30 分钟）——请从下方用户列表选择要调取的用户']
    loadUserList()
  } catch (e: any) {
    unlockStatus.value = ['err', '❌ ' + e.message + '\n\n可能原因：①私钥与已保存的监管公钥不匹配（请重新「生成密钥对」→立即保存公钥→用新私钥解锁） ②挑战已过期（重新点解锁）']
  }
}
function lock() { unlockToken.value = ''; unlockExpire.value = ''; users.value = []; unlockStatus.value = ['warn', '已锁定'] }
async function loadUserList() {
  if (!unlockToken.value) return
  userLoading.value = true
  try {
    const j = await api('/api/admin/identity/users?unlockToken=' + encodeURIComponent(unlockToken.value) + (q.value ? '&search=' + encodeURIComponent(q.value) : ''))
    users.value = (j.data && j.data.users) || []
  } catch (e: any) { users.value = [] }
  finally { userLoading.value = false }
}
function onUserSearch() { if (unlockToken.value) loadUserList() }
function selectUser(u: any) {
  q.value = u.username || u.phone || u.id
  queryUser()
}
async function copyQuery() {
  try { await navigator.clipboard.writeText(queryOut.value); queryStatus.value = ['ok', '✅ 已复制到剪贴板'] }
  catch (e: any) {
    const ta = document.createElement('textarea')
    ta.value = queryOut.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
    queryStatus.value = ['ok', '✅ 已复制（兼容模式）']
  }
}
async function queryUser() {
  const v = q.value.trim()
  if (!unlockToken.value) { queryStatus.value = ['err', '❌ 请先私钥解锁']; return }
  if (!v) { queryStatus.value = ['err', '请输入用户标识']; return }
  try {
    const j = await api('/api/admin/identity/user?unlockToken=' + encodeURIComponent(unlockToken.value) + '&q=' + encodeURIComponent(v))
    const d = j.data
    const ips = (d.knownIps || []).map((x: any) => (typeof x === 'string' ? x : (x.ip || JSON.stringify(x)))).join('\n    ')
    queryOut.value =
      '账号：' + d.username + ' ｜ 手机：' + (d.phone || '-') + ' ｜ ID：' + d.id +
      '\n注册：' + (d.createdAt || '-') + ' ｜ 最近活跃：' + (d.lastActiveAt || '-') +
      '\n当前 IP：' + (d.activeIp || '-') +
      '\n登录记录 IP（近30条）：\n    ' + (ips || '-') +
      '\n\n🔑 私钥明文（监管备份）：\n' + (d.identity.plainPriv || '（无备份）') +
      '\n\n🗝 助记词明文（监管备份）：\n' + (d.identity.mnemonic || '（无备份）') +
      '\n\n🔑 加密托管密文：\n' + (d.identity.encKey || '（无）') +
      '\n身份公钥指纹：' + d.identity.pubFingerprint +
      '\n身份公钥：' + d.identity.publicKey +
      '\n加密私钥托管（助记词加密密文）：\n' + (d.identity.encKey || '（无）') +
      '\n\n⚠️ 助记词明文仅存于用户本地；如需恢复其备份数据，用上方加密私钥 + 用户助记词（需依法取得）'
    queryStatus.value = ['ok', '✅ 已调取用户信息（可复制）']
  } catch (e: any) { queryStatus.value = ['err', '❌ ' + e.message] }
}
async function queryBackups() {
  const v = q.value.trim()
  if (!unlockToken.value) { queryStatus.value = ['err', '❌ 请先私钥解锁']; return }
  if (!v) { queryStatus.value = ['err', '请输入用户标识']; return }
  try {
    const j = await api('/api/admin/identity/backups?unlockToken=' + encodeURIComponent(unlockToken.value) + '&q=' + encodeURIComponent(v))
    const d = j.data
    queryStatus.value = ['ok', '备份归属键：' + d.ownerKey + '\n分片索引（最近 20）：\n' + (d.shards.length ? d.shards.join('\n') : '（暂无）') + '\n\n提示：分片存储于各在线节点，可依法通过分布式存储协议从节点调取重组。']
  } catch (e: any) { queryStatus.value = ['err', '❌ ' + e.message] }
}
</script>
