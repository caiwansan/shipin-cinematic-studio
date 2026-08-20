<template>
  <!-- 昆仑会议（腾讯会议式）：会议中心 + 会议室 -->
  <div class="m-meet">
    <!-- 会议中心 -->
    <div v-if="!inRoom" class="mmc">
      <div class="mmc-head">
        <span class="mmc-title">🎥 昆仑会议</span>
        <span class="mmc-back" @click="$emit('close')">✕</span>
      </div>

      <div class="mmc-actions">
        <button class="mmc-btn primary" @click="createOpen = true">🎉 发起会议</button>
        <button class="mmc-btn" @click="joinOpen = true">🔑 加入会议</button>
      </div>

      <!-- 创建成功：显示会议号 + 邀请链接 -->
      <div v-if="createdMeeting" class="mmc-created">
        <div class="mc-c-title">✅ 会议已创建，邀请好友参会</div>
        <div class="mc-c-row">会议号 <b class="mc-c-no">{{ createdMeeting.meetingNo }}</b></div>
        <div class="mc-c-url">{{ createdMeeting.inviteUrl }}</div>
        <div class="mc-c-btns">
          <button class="mmc-btn" @click="copyInvite(createdMeeting)">🔗 复制邀请链接</button>
          <button class="mmc-btn primary" @click="enterCreated">🚪 进入会议</button>
        </div>
        <button class="mc-c-close" @click="createdMeeting = null">关闭</button>
      </div>

      <!-- 快速会议选择 -->
      <div class="mmc-sec">
        <div class="mmc-sec-t">进行中 / 我参与的</div>
        <div v-if="!activeMeetings.length" class="mmc-empty">暂无进行中的会议，点「发起会议」开始</div>
        <div v-for="m in activeMeetings" :key="'a'+m.id" class="mmc-row" @click="joinById(String(m.id))">
          <span class="mtg-dot"></span>
          <div class="mmc-row-i">
            <div class="mmc-row-t">{{ m.title || ('会议 ' + shortId(m.id)) }}</div>
            <div class="mmc-row-s">会议号 {{ shortId(m.id) }} · {{ m.participant_count || 0 }} 人 · {{ fmtTime(m.started_at) }}</div>
          </div>
          <span class="mmc-row-go">进入 ›</span>
        </div>
      </div>

      <div class="mmc-sec">
        <div class="mmc-sec-t">历史会议</div>
        <div v-if="!historyMeetings.length" class="mmc-empty">暂无历史会议</div>
        <div v-for="m in historyMeetings.slice(0,10)" :key="'h'+m.id" class="mmc-row" @click="openSummary(String(m.id))">
          <div class="mmc-row-i">
            <div class="mmc-row-t">{{ m.title || ('会议 ' + shortId(m.id)) }} · <span class="mmc-ended">{{ m.status === 'ended' ? '已结束' : '已解散' }}</span></div>
            <div class="mmc-row-s">{{ fmtTime(m.started_at) }}{{ m.summary ? ' · 有AI纪要' : '' }}</div>
          </div>
          <span class="mmc-row-go">纪要 ›</span>
        </div>
      </div>

      <!-- 发起会议弹窗 -->
      <div v-if="createOpen" class="mmc-mask" @click.self="createOpen = false">
        <div class="mmc-sheet">
          <div class="mmc-sheet-t">🎉 发起会议</div>
          <input v-model="createTitle" class="mmc-input" maxlength="40" placeholder="会议主题（如：部门周会）" @keyup.enter="doCreate" />
          <div class="mmc-sheet-btns">
            <button class="mmc-btn cancel" @click="createOpen = false">取消</button>
            <button class="mmc-btn primary" :disabled="creating" @click="doCreate">{{ creating ? '创建中…' : '创建并进入' }}</button>
          </div>
        </div>
      </div>

      <!-- 加入会议弹窗 -->
      <div v-if="joinOpen" class="mmc-mask" @click.self="joinOpen = false">
        <div class="mmc-sheet">
          <div class="mmc-sheet-t">🔑 加入会议</div>
          <input v-model="joinNo" class="mmc-input" maxlength="12" placeholder="输入会议号（ID 或 6位码）" @keyup.enter="doJoin" />
          <div class="mmc-sheet-btns">
            <button class="mmc-btn cancel" @click="joinOpen = false">取消</button>
            <button class="mmc-btn primary" :disabled="joining" @click="doJoin">{{ joining ? '加入中…' : '加入' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 会议室（腾讯会议式） -->
    <div v-else class="mmr">
      <div class="mmr-top">
        <span class="mmr-back" @click="leaveRoom">‹</span>
        <div class="mmr-ti">
          <div class="mmr-name">{{ meet.title || ('会议 ' + roomNo) }} <span class="mmr-code">#{{ roomNo }}</span></div>
          <div class="mmr-sub"><span v-if="timer" class="mmr-timer">⏱ {{ timer }}</span> · {{ participants.filter(p=>!p.left_at).length }} 人在会</div>
        </div>
      </div>

      <div class="mmr-grid" :class="{ chat: roomTab !== '' }">
        <!-- 视频 / 音频网格 -->
        <div v-for="p in gridParticipants" :key="p.uid" class="mmr-tile" :class="{ me: p.uid === meUid, speaking: p.speaking }">
          <video v-if="p.stream && p.video" :ref="(el: any) => setTileVideo(p.uid, el)" class="mmr-video" autoplay playsinline muted></video>
          <div v-else class="mmr-av">{{ (p.name || '?').slice(0,1) }}</div>
          <div class="mmr-tile-name">{{ p.name }}<span v-if="p.uid === meUid">（我）</span>{{ p.muted ? ' 🔇' : '' }}{{ p.isHost ? ' 👑' : '' }}</div>
        </div>
      </div>

      <!-- 右侧 成员 / 聊天 -->
      <div v-if="roomTab" class="mmr-side">
        <div class="mmr-side-head">
          <button class="mmr-side-tab" :class="{ on: roomTab === 'members' }" @click="roomTab = 'members'">👥 成员</button>
          <button class="mmr-side-tab" :class="{ on: roomTab === 'chat' }" @click="roomTab = 'chat'">💬 聊天</button>
          <span class="mmr-side-close" @click="roomTab = ''">✕</span>
        </div>
        <div v-if="roomTab === 'members'" class="mmr-list">
          <div v-for="p in participants.filter(x=>!x.left_at)" :key="'m'+p.uid" class="mmr-mem">
            <div class="mmr-av sm">{{ (p.name||'?').slice(0,1) }}</div>
            <span class="mmr-mem-name">{{ p.name }}{{ p.uid === meUid ? '（我）' : '' }}{{ p.isHost ? ' 👑' : '' }}</span>
            <span class="mmr-mem-role">{{ p.role === 'host' ? '主持人' : '成员' }}</span>
            <button v-if="isHost && p.uid !== meUid" class="mmr-mem-act" @click="kickMember(p)">移出</button>
          </div>
        </div>
        <div v-else class="mmr-chat">
          <div class="mmr-msgs">
            <div v-for="(m,i) in meetMessages" :key="'c'+i" class="mmr-msg" :class="{ mine: m.fromUID === meUid || m.mine }">
              <span class="mmr-msg-name">{{ m.name || (m.fromUID === meUid ? '我' : '') }}</span>
              <img v-if="m.imgUrl" class="mmr-msg-img" :src="m.imgUrl" @click="openMsgImg(m.imgUrl)" /><div v-else class="mmr-msg-bubble">{{ m.text }}</div>
            </div>
            <div v-if="!meetMessages.length" class="mmr-empty-chat">会议开始前可说两句，或等 AI 秘书转写</div>
          </div>
          <div class="mmr-input">
            <button class="mmr-input-img" @click="onPickImgClick">📷</button>
            <input type="file" ref="mtgFile" accept="image/*" style="display:none" @change="onPickImg($event)" />
            <input v-model="meetDraft" class="mmr-input-box" placeholder="发消息…(Enter发送)" @keyup.enter="sendMeetMsg" />
            <button class="mmr-input-send" @click="sendMeetMsg">发送</button>
          </div>
        </div>
      </div>

      <!-- 底部控制条 -->
      <div class="mmr-bar">
        <button class="mmr-ctl" :class="{ off: micMuted }" @click="toggleMic">{{ micMuted ? '🔇' : '🎤' }}<br><small>{{ micMuted ? '取消静音' : '静音' }}</small></button>
        <button class="mmr-ctl" :class="{ off: camOff }" @click="toggleCam">{{ camOff ? '🙈' : '🎥' }}<br><small>{{ camOff ? '开摄像头' : '关摄像头' }}</small></button>
        <button class="mmr-ctl" @click="roomTab = roomTab === 'chat' ? '' : 'chat'">💬<br><small>聊天</small></button>
        <button class="mmr-ctl" @click="roomTab = roomTab === 'members' ? '' : 'members'">👥<br><small>成员</small></button>
        <button class="mmr-ctl" @click="inviteOpen = true">✉️<br><small>邀请</small></button>
        <button v-if="isHost" class="mmr-ctl end" @click="endMeeting">⏹<br><small>结束</small></button>
        <button v-else class="mmr-ctl leave" @click="leaveRoom">🚪<br><small>离开</small></button>
      </div>

      <!-- 邀请好友面板 -->
      <div v-if="inviteOpen" class="mmr-mask" @click.self="inviteOpen = false">
        <div class="mmi">
          <div class="mmi-head">✉️ 邀请好友参加会议</div>
          <div class="mmi-sub">发送会议邀请到私聊，好友点「加入会议」即可参加</div>
          <div v-if="!friendList.length" class="mmi-empty">暂无好友，先添加好友</div>
          <div v-for="u in friendList" :key="u.id" class="mmi-row" @click="inviteFriend(u)">
            <div class="mmr-av sm">{{ (u.name || '?').slice(0, 1) }}</div>
            <span class="mmi-name">{{ u.name }}</span>
            <span class="mmi-online" :class="{ on: u.online }">{{ u.online ? '在线' : '离线' }}</span>
          </div>
          <button class="mmi-close" @click="inviteOpen = false">关闭</button>
        </div>
      </div>
    </div>
  </div>

            <div id="mmr-img-mask" style="position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.9);display:none;align-items:center;justify-content:center;z-index:9999" @click="closeMsgImg">
              <img id="mmr-img-full" style="max-width:92%;max-height:92%;object-fit:contain" src="" />
            </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watchEffect } from 'vue'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'

const props = defineProps<{ tea: any }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const tea = props.tea
const authTok = () => localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''

// ── 会议中心状态 ──
const inRoom = ref(false)
const createOpen = ref(false)
const joinOpen = ref(false)
const creating = ref(false)
const joining = ref(false)
const createTitle = ref('')
const joinNo = ref('')
const activeMeetings = ref<any[]>([])
const historyMeetings = ref<any[]>([])
const createdMeeting = ref<any>(null)
let pollTimer: any = null

// ── 会议室状态 ──
const meetId = ref('')
const meet = ref<any>({})
const meUid = ref('')
const participants = ref<any[]>([])
const cmdRegistered = ref(false)
const roomTab = ref('')
const meetMessages = ref<any[]>([])
const meetDraft = ref('')
const mtgFile = ref<any>(null)
const micMuted = ref(false)
const camOff = ref(false)
const timer = ref('')
let timerIv: any = null
const pcMap = new Map<string, RTCPeerConnection>()
const streamMap = new Map<string, MediaStream>()
const localStream = ref<MediaStream | null>(null)
const videoElMap = new Map<string, HTMLVideoElement>()
let signalPollIv: any = null
// 邀请
const inviteOpen = ref(false)
const friendList = ref<any[]>([])
async function openInvite() {
  inviteOpen.value = true
  try {
    const allUsers = (await tea.loadUsers() || []).filter((u: any) => String(u.id) !== meUid.value)
    // 过滤掉已在会议中的用户
    const inRoomUids = new Set(participants.value.filter((p) => !p.left_at).map((p) => p.uid))
    friendList.value = allUsers.filter((u: any) => !inRoomUids.has(String(u.id)))
  } catch { friendList.value = [] }
}
async function inviteFriend(u: any) {
  try {
    // 验证会议仍然存在
    const info = await mobileAuthFetch('/api/meeting/info?meetingId=' + encodeURIComponent(meetId.value))
    const ij = await info.json()
    if (!ij.success || ij.data.status !== 'active') { mobileToast('会议已结束，无法邀请'); return }
    // 检查是否已在会议中
    const alreadyIn = (ij.data.participants || []).some((p: any) => p.user_uid === String(u.id) && !p.left_at)
    if (alreadyIn) { mobileToast((u.name || u.id) + ' 已在会议中'); return }
    const priv = await tea.ensurePrivate(String(u.id))
    const card = `[meeting]${meetId.value}|${(meet.value.title || '昆仑会议')}|${Date.now()}`
    await tea.sendText(card, priv.channelId, priv.channelType)
    mobileToast('已发送邀请给 ' + (u.name || u.id))
    inviteOpen.value = false
  } catch { mobileToast('邀请发送失败') }
}
// 会议邀请卡片解析（供外部加入）
function parseInvite(idOrText: string): string { return String(idOrText).replace(/^\[meeting\]/, '').split('|')[0] }

const shortId = (s: any) => String(s || '').slice(-6)
const roomNo = computed(() => String(meet.value.meeting_no || shortId(meetId.value)))
const isHost = computed(() => meet.value.host_uid === meUid.value)
const gridParticipants = computed(() => {
  const arr = participants.value.filter((p) => !p.left_at)
  // 自己排第一
  arr.sort((a: any, b: any) => (a.uid === meUid.value ? -1 : b.uid === meUid.value ? 1 : 0))
  return arr
})
function fmtTime(t: any) {
  if (!t) return ''
  const d = new Date(t); const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}
function setTileVideo(uid: string, el: any) { if (el) videoElMap.set(uid, el) }
// 把参与者流绑定到对应视频 tile（流变化/元素挂载后重绑）
watchEffect(() => {
  const list = gridParticipants.value
  if (!inRoom.value) return
  for (const p of list) {
    const el = videoElMap.get(p.uid)
    if (el && p.stream && el.srcObject !== p.stream) { try { el.srcObject = p.stream } catch {} }
    // 自己(tile可能没 video, 用本端流)
  }
})

// ── 会议中心 ──
async function loadMeetings() {
  try {
    const r = await mobileAuthFetch('/api/meeting/list?status=active&limit=20')
    const j = await r.json()
    activeMeetings.value = j.data?.meetings || []
  } catch {}
  try {
    const r = await mobileAuthFetch('/api/meeting/list?status=ended&limit=20')
    const j = await r.json()
    historyMeetings.value = j.data?.meetings || []
  } catch {}
}
async function doCreate() {
  const title = createTitle.value.trim() || '昆仑会议'
  creating.value = true
  try {
    const r = await mobileAuthFetch('/api/meeting/create', { method: 'POST', body: JSON.stringify({ title }) })
    const j = await r.json()
    if (!j.success) { mobileToast(j.error || '创建失败'); return }
    createOpen.value = false
    createTitle.value = ''
    // 发起后留在会议中心：展示会议号 + 邀请链接，用户链接/会议号给别人进，或点「进入会议」进会议室
    createdMeeting.value = { id: String(j.data.id), meetingNo: String(j.data.meetingNo || ''), title, inviteUrl: String(j.data.inviteUrl || '') }
    await loadMeetings()
  } catch { mobileToast('创建失败') } finally { creating.value = false }
}
function copyInvite(m: any) {
  const t = m.inviteUrl || `https://aigc.fushtn.com/meeting?no=${m.meetingNo}`
  try { navigator.clipboard?.writeText(t); mobileToast('✅ 邀请链接已复制') }
  catch { mobileToast('复制失败，请长按链接复制') }
}
function enterCreated() { if (createdMeeting.value) joinById(String(createdMeeting.value.id)); }
async function doJoin() {
  const no = joinNo.value.trim()
  if (!no) { mobileToast('请输入会议号'); return }
  joining.value = true
  try { await joinById(no) } finally { joining.value = false }
}
function openSummary(id: string) {
  if (id) joinById(id)
}
// 对外暴露（消息页快捷进入）
function openRoomById(id: string) { joinById(id) }
defineExpose({ openRoomById })

async function joinById(idOrNo: string) {
  joinOpen.value = false
  try {
    let targetId = String(idOrNo || '').trim()
    // 若是 6 位数字会议号 → 用 by-no 解析出会议 id
    if (/^\d{6}$/.test(targetId)) {
      const br = await mobileAuthFetch('/api/meeting/by-no?no=' + encodeURIComponent(targetId))
      const bj = await br.json()
      if (!bj.success) { mobileToast(bj.error || '会议号不存在'); return }
      if (bj.data.status !== 'active') { mobileToast('会议不存在或已结束'); return }
      targetId = String(bj.data.id)
    }
    const info = await mobileAuthFetch('/api/meeting/info?meetingId=' + encodeURIComponent(targetId))
    const ij = await info.json()
    if (!ij.success) { mobileToast(ij.error || '会议不存在'); return }
    const m = ij.data
    if (m.status !== 'active') { mobileToast('会议不存在或已结束'); return }
    await mobileAuthFetch('/api/meeting/join', { method: 'POST', body: JSON.stringify({ meetingId: m.id }) })
    await enterRoom(String(m.id), m.title || '', false)
  } catch { mobileToast('加入失败') }
}

// ── 进入会议室 ──
async function enterRoom(id: string, title: string, isHostCreate: boolean) {
  meUid.value = tea.userId.value
  meetId.value = id
  meet.value = { id, title, host_uid: isHostCreate ? meUid.value : (undefined) }
  inRoom.value = true; roomTab.value = 'chat'
  micMuted.value = false
  camOff.value = false
  // 订阅会议频道（聊天用）
  try { await tea.subscribeChannel('mtg_' + id, 4) } catch {}
  // 拉取 ICE 配置
  try { const r = await mobileAuthFetch('/api/im/rtc/config'); const j = await r.json(); if (j.success && j.data?.iceServers?.length) iceServers = j.data.iceServers } catch {}
  // 注册 CMD 信令（幂等，避免重复）
  if (!cmdRegistered.value) { tea.onCMD(handleCmd); cmdRegistered.value = true }
  // 刷新详情
  try {
    const r = await mobileAuthFetch('/api/meeting/info?meetingId=' + encodeURIComponent(id))
    const j = await r.json()
    if (j.success) { meet.value = j.data; participants.value = (j.data.participants || []).map((p: any) => ({ uid: p.user_uid, name: '', role: p.role, left_at: p.left_at, isHost: p.role === 'host' })) }
  } catch {}
  loadParticipantNames()
  startTimer()
  // 获取本地媒体
  try { localStream.value = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true }, video: { width: { ideal: 640 }, height: { ideal: 480 } } }) } catch {}
  addSelfParticipant()
  // 广播加入（mesh：其他成员收到后主动建连）
  announceJoin()
  // 启动会话消息轮询 + 信令
  signalPollIv = setInterval(pollRoom, 2500)
  pollRoom()
  // 注册 CMD 信令
  tea.onCMD(handleCmd)
}
function addSelfParticipant() {
  const me = { uid: meUid.value, name: (readMyName()), role: isHost.value ? 'host' : 'member', left_at: null, isHost: isHost.value, stream: localStream.value, video: !camOff.value, muted: false, mine: true }
  const idx = participants.value.findIndex((p) => p.uid === meUid.value)
  if (idx >= 0) participants.value[idx] = me; else participants.value.push(me)
}
function readMyName() {
  try { const u = JSON.parse(localStorage.getItem('auth_user') || '{}'); return u?.username || u?.nickname || '我' } catch { return '我' }
}

async function loadParticipantNames() {
  // 参与者姓名：优先用本地已缓存的用户信息；否则显示 uid 短码
  for (const p of participants.value) {
    if (!p.name) p.name = (p.uid || '').slice(0, 6)
  }
}

// ── 计时 ──
function startTimer() {
  const start = Date.now()
  timerIv = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000)
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    timer.value = (h ? String(h).padStart(2,'0') + ':' : '') + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0')
  }, 1000)
}

// ── 会议消息（IM 会议频道 mtg_<id>, type=4）──
async function pollRoom() {
  // 拉取会议频道消息历史
  try {
    const arr = await tea.loadHistory('mtg_' + meetId.value, 4, 0, 50)
    if (arr.length) {
      const fresh = arr.map((m: any) => { const from = m.fromUID || m.from_uid; return { fromUID: from, name: from === meUid.value ? '' : (m.senderName || ''), text: contentText(m), imgUrl: msgImgUrl(m), mine: from === meUid.value, seq: m.messageSeq } })
      const known = new Set<number>()
      const merged: any[] = []
      for (const x of meetMessages.value) { merged.push(x); if (x && x.seq !== undefined && x.seq !== null && !x.local) known.add(x.seq) }
      for (const f of fresh) {
        const s = f && f.seq
        if (s === undefined || s === null || s < 0) { if (f && f.mine) continue; else continue }
        if (f.mine) {
          const li = merged.findIndex((x: any) => x && x.local && x.mine && x.text === f.text)
          if (li >= 0) { merged[li] = { ...merged[li], ...f, local: false }; known.add(s); continue }
        }
        if (!known.has(s)) { merged.push({ ...f, local: false }); known.add(s) }
      }
      meetMessages.value = merged
    }
  } catch {}
  // 刷新参与者（人数）
  try {
    const r = await mobileAuthFetch('/api/meeting/info?meetingId=' + encodeURIComponent(meetId.value))
    const j = await r.json()
    if (j.success) {
      const list = j.data.participants || []
      const seen = new Set(list.filter((p: any) => !p.left_at).map((p: any) => p.user_uid))
      participants.value = participants.value.filter((p) => seen.has(p.uid) || p.uid === meUid.value)
      meet.value = { ...meet.value, participant_count: list.filter((p: any) => !p.left_at).length }
    }
  } catch {}
}
// 从消息 content 提取图片绝对 URL（图片消息返回url，否则空）
function msgImgUrl(m: any) { const c = m.content
  let p: any = c
  if (typeof c === 'string') { try { p = JSON.parse(c) } catch { return '' } }
  const url = (p && (p.url || p.content?.url || p?.url)) || ''
  if (!url) return ''
  const kind = p.kind || p.content?.kind || ''
  if (kind && kind !== 'image') return ''
  return url.indexOf('http') === 0 ? url : ('https://aigc.fushtn.com' + (url.indexOf('/') === 0 ? url : '/' + url))
}
function openMsgImg(url: string) { const el = document.getElementById('mmr-img-mask'); const im = document.getElementById('mmr-img-full'); if (el && im) { im.src = url; el.style.display = 'flex' } }
function closeMsgImg() { const el = document.getElementById('mmr-img-mask'); if (el) el.style.display = 'none' }
function contentText(m: any) {
  const c = m.content
  if (typeof c === 'string') { try { const p = JSON.parse(c); if (p?.url) return (p.kind === 'image' || !p.kind) ? '[图片]' : '[' + (p.kind || '消息') + ']'; return p?.content?.text || p?.text || (p?.content ?? c) } catch { return c } }
  if (c?.url) return (c.kind === 'image' || !c.kind) ? '[图片]' : '[' + (c.kind || '消息') + ']'
  if (typeof c?.content === 'string') return c.content
  if (typeof c?.text === 'string') return c.text
  if (c?.content?.text) return c.content.text
  if (c?.content?.url) return '[图片]'
  if (c?.contentType !== undefined && c?.contentType !== 99) return '[消息]'
  return '' }
function onPickImgClick() { const el = mtgFile.value as any; if (el) el.value = ''; el.click() }
async function onPickImg(ev: any) { const f = ev.target && ev.target.files && ev.target.files[0]; if (!f) return
  mobileToast('上传中…');
  try { const fd = new FormData(); fd.append('file', f);
    const up = await mobileAuthFetch('/api/im/upload', { method: 'POST', body: fd });
    const j = await up.json(); if (!j.success || !j.data?.url) { mobileToast('上传失败'); return }
    const url = j.data.url; const absUrl = url.indexOf('http') === 0 ? url : ('https://aigc.fushtn.com' + (url.indexOf('/') === 0 ? url : '/' + url));
    const content = { url, name: j.data.name || 'img', kind: 'image', width: j.data.width || 0, height: j.data.height || 0, mime: j.data.mime || 'image/jpeg', thumbUrl: j.data.thumbUrl || '', ttlHours: j.data.ttlHours || 0 };
    const s = await mobileAuthFetch('/api/im/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: 'mtg_' + meetId.value, channelType: 4, contentType: 2, content }) });
    const sj = await s.json(); if (!sj.success) { mobileToast('发送失败'); return }
    meetMessages.value.push({ fromUID: meUid.value, name: '', text: '', imgUrl: absUrl, mine: true, seq: -Date.now(), local: true });
    mobileToast('已发送');
  } catch (e) { mobileToast('发图失败') } }
async function sendMeetMsg() {
  const t = meetDraft.value.trim()
  if (!t) return
  meetDraft.value = ''
  try { await tea.sendText(t, 'mtg_' + meetId.value, 4); meetMessages.value.push({ fromUID: meUid.value, name: '', text: t, mine: true, seq: -Date.now(), local: true }) } catch { mobileToast('发送失败') }
}

// ── 控制 ──
function toggleMic() {
  micMuted.value = !micMuted.value
  localStream.value?.getAudioTracks().forEach((tr) => (tr.enabled = !micMuted.value))
  sendSignal('mute', { muted: micMuted.value })
  const me = participants.value.find((p) => p.uid === meUid.value); if (me) me.muted = micMuted.value
}
function toggleCam() {
  camOff.value = !camOff.value
  localStream.value?.getVideoTracks().forEach((tr) => (tr.enabled = !camOff.value))
  sendSignal('video', { on: !camOff.value })
  const me = participants.value.find((p) => p.uid === meUid.value); if (me) me.video = !camOff.value
}
function kickMember(p: any) {
  sendSignal('kick', { targetUid: p.uid, name: p.name })
  closePeer(p.uid)
  const mp = participants.value.find((x) => x.uid === p.uid); if (mp) mp.left_at = new Date().toISOString()
  mobileToast('已移出 ' + p.name)
}

// ═══ 会议 mesh WebRTC 引擎（参照 PC v1：mtg CMD 信令 + 悟空频道广播 + 全连接 mesh）═══
let iceServers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }]
const peers = new Map<string, RTCPeerConnection>()

function sendSignal(action: string, param: Record<string, any>) {
  if (!meetId.value) return Promise.resolve()
  return tea.sendCMD('mtg', { action, meetingId: meetId.value, ...param }, 'mtg_' + meetId.value, 4).catch(() => {})
}
function sendTo(uid: string, action: string, param: Record<string, any>) {
  return tea.sendCMD('mtg', { action, meetingId: meetId.value, to: uid, ...param }, 'mtg_' + meetId.value, 4).catch(() => {})
}
function peerName(uid: string) {
  const p = participants.value.find((x) => x.uid === uid)
  return p?.name || uid.slice(0, 6)
}

function newPeerPC(peerUid: string): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers })
  pc.onicecandidate = (e) => { if (e.candidate) sendTo(peerUid, 'ice', { candidate: e.candidate.toJSON() }).catch(() => {}) }
  pc.ontrack = (e) => {
    const stream = e.streams[0] || new MediaStream([e.track])
    const mp = participants.value.find((p) => p.uid === peerUid)
    if (mp) { mp.stream = stream; mp.hasMedia = true }
    bindTile(peerUid)
  }
  pc.onconnectionstatechange = () => {
    if (['failed', 'closed'].includes(pc.connectionState)) closePeer(peerUid)
  }
  // 加入本端音视频轨道
  localStream.value?.getTracks().forEach((t) => { try { pc.addTrack(t, localStream.value!) } catch {} })
  return pc
}
function bindTile(uid: string) {
  // 渲染循环里定时把远端流绑到视频元素
}
async function ensurePeer(peerUid: string) {
  if (peerUid === meUid.value || peers.has(peerUid)) return
  const pc = newPeerPC(peerUid)
  peers.set(peerUid, pc)
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await sendTo(peerUid, 'sdp', { type: 'offer', sdp: pc.localDescription?.sdp })
}
function closePeer(peerUid: string) {
  const pc = peers.get(peerUid)
  if (pc) { try { pc.close() } catch {} }
  peers.delete(peerUid)
  const mp = participants.value.find((p) => p.uid === peerUid)
  if (mp) { mp.stream = null; mp.hasMedia = false }
}

// ═══ CMD 信令分发（mesh：join/sdp/ice/mute/video/leave/kick/end）═══
function handleCmd(msg: any) {
  const c = msg?.content
  if (!c || c.contentType !== 99) return
  const cmd = c.cmd; const param = c.param || {}
  if (cmd !== 'mtg') return
  const fromUid = msg.fromUID || msg.from_uid
  if (!fromUid || (param.meetingId && param.meetingId !== meetId.value)) return
  // 定向消息：不是给我的则忽略（除广播 action）
  const directed = ['sdp', 'ice'].includes(param.action)
  if (directed && param.to && param.to !== meUid.value) return

  switch (param.action) {
    case 'join': {
      // 有新成员：若还没有其 pc 且非自己 → 主动建立连接（主叫发 offer）
      if (fromUid !== meUid.value && !peers.has(fromUid) && inRoom.value) {
        upsertPeer(fromUid, param.name)
        ensurePeer(fromUid).catch(() => {})
      }
      break
    }
    case 'sdp': {
      if (fromUid === meUid.value || param.to && param.to !== meUid.value) return
      upsertPeer(fromUid, param.name)
      handleSdp(fromUid, param).catch(() => {})
      break
    }
    case 'ice': {
      if (fromUid === meUid.value || param.to && param.to !== meUid.value) return
      const pc = peers.get(fromUid)
      if (pc && param.candidate) { try { pc.addIceCandidate(param.candidate) } catch {} }
      break
    }
    case 'mute': { const mp = participants.value.find((p) => p.uid === fromUid); if (mp) mp.muted = !!param.muted; break }
    case 'video': { const mp = participants.value.find((p) => p.uid === fromUid); if (mp) mp.video = !!param.on; break }
    case 'leave': {
      const mp = participants.value.find((p) => p.uid === fromUid); if (mp && mp.uid !== meUid.value) mp.left_at = new Date().toISOString()
      closePeer(fromUid)
      break
    }
    case 'kick': {
      if (String(param.targetUid) === meUid.value) { mobileToast('你已被主持人移出会议'); leaveRoom() }
      else { closePeer(String(param.targetUid)); const mp = participants.value.find((p) => p.uid === param.targetUid); if (mp) mp.left_at = new Date().toISOString() }
      break
    }
    case 'end': { mobileToast('会议已结束'); leaveRoom(); break }
  }
}
async function handleSdp(fromUid: string, param: any) {
  let pc = peers.get(fromUid)
  if (!pc) { pc = newPeerPC(fromUid); peers.set(fromUid, pc) }
  if (param.type === 'offer') {
    await pc.setRemoteDescription({ type: 'offer', sdp: param.sdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await sendTo(fromUid, 'sdp', { type: 'answer', sdp: pc.localDescription?.sdp, name: readMyName() })
  } else if (param.type === 'answer') {
    if (pc.signalingState !== 'stable') await pc.setRemoteDescription({ type: 'answer', sdp: param.sdp })
  }
}
function upsertPeer(uid: string, name?: string) {
  let mp = participants.value.find((p) => p.uid === uid)
  if (!mp) { mp = { uid, name: name || uid.slice(0, 6), role: 'member', left_at: null, muted: false, video: true }; participants.value.push(mp) }
  else if (name) mp.name = name
  return mp
}
function announceJoin() {
  sendSignal('join', { name: readMyName(), host: isHost.value || undefined }).catch(() => {})
}
async function leaveRoom() {
  try { await mobileAuthFetch('/api/meeting/leave', { method: 'POST', body: JSON.stringify({ meetingId: meetId.value }) }) } catch {}
  tea.sendCMD('mtg', { action: 'leave', meetingId: meetId.value }, 'mtg_' + meetId.value, 4).catch(() => {})
  cleanupRoom()
  inRoom.value = false
  cmdRegistered.value = false
  loadMeetings()
}
async function endMeeting() {
  try { await mobileAuthFetch('/api/meeting/end', { method: 'POST', body: JSON.stringify({ meetingId: meetId.value }) }) } catch {}
  tea.sendCMD('mtg', { action: 'end', meetingId: meetId.value }, 'mtg_' + meetId.value, 4).catch(() => {})
  cleanupRoom()
  inRoom.value = false
  cmdRegistered.value = false
  loadMeetings()
}
function cleanupRoom() {
  if (timerIv) clearInterval(timerIv)
  if (signalPollIv) clearInterval(signalPollIv); signalPollIv = null
  localStream.value?.getTracks().forEach((t) => t.stop()); localStream.value = null
  peers.forEach((pc) => { try { pc.close() } catch {} })
  peers.clear()
  videoElMap.clear()
  roomTab.value = ''; meetMessages.value = []; participants.value = []
  timer.value = ''
}

onMounted(() => { meUid.value = tea.userId.value; loadMeetings(); pollTimer = setInterval(loadMeetings, 20000) })
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer); cleanupRoom() })
</script>

<style scoped>
.m-meet { position: fixed; inset: 0; z-index: 400; background: #0e1116; color: #fff; display: flex; flex-direction: column; }
/* 会议中心 */
.mmc { flex: 1; overflow-y: auto; background: linear-gradient(160deg,#151a23,#0e1116); padding: 16px 14px calc(30px + env(safe-area-inset-bottom)); }
.mmc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.mmc-title { font-size: 18px; font-weight: 800; }
.mmc-back { width: 30px; height: 30px; border-radius: 50%; background: #232a35; display: flex; align-items: center; justify-content: center; color: #bbb; cursor: pointer; }
.mmc-actions { display: flex; gap: 12px; margin-bottom: 18px; }
.mmc-btn { flex: 1; padding: 12px; border: none; border-radius: 12px; background: #232a35; color: #e8eaed; font-size: 15px; font-weight: 600; }
.mmc-btn.primary { background: #2b7cf0; }
.mmc-btn.cancel { flex: 1; background: #2a2f3a; }
.mmc-sec { margin-bottom: 18px; }
.mmc-sec-t { font-size: 13px; color: #8b94a3; margin-bottom: 8px; padding: 0 2px; }
.mmc-empty { text-align: center; color: #5a6372; font-size: 13px; padding: 16px 0; }
.mmc-row { display: flex; align-items: center; gap: 10px; background: #171b23; border-radius: 12px; padding: 12px; margin-bottom: 8px; cursor: pointer; }
.mmc-row-i { flex: 1; min-width: 0; }
.mmc-row-t { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mmc-row-s { font-size: 12px; color: #8b94a3; margin-top: 2px; }
.mmc-row-go { color: #2b7cf0; font-size: 14px; flex-shrink: 0; }
.mmc-ended { color: #f0a030; }
.mmc-mask { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.6); display: flex; align-items: flex-end; }
.mmc-sheet { background: #1b2029; border-radius: 18px 18px 0 0; width: 100%; max-width: 640px; margin: 0 auto; padding: 18px 16px 24px; }
.mmc-sheet-t { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
.mmc-input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px; border: 1px solid #2f3743; background: #12161e; color: #fff; font-size: 15px; }
.mmc-sheet-btns { display: flex; gap: 10px; margin-top: 14px; }
/* 会议室 */
.mmr { flex: 1; display: flex; flex-direction: column; background: #0e1116; }
.mmr-top { display: flex; align-items: center; gap: 8px; padding: 12px 14px; }
.mmr-back { font-size: 24px; color: #bbb; cursor: pointer; }
.mmr-ti { flex: 1; }
.mmr-name { font-size: 15px; font-weight: 700; }
.mmr-code { font-size: 12px; color: #8b94a3; }
.mmr-sub { font-size: 12px; color: #8b94a3; margin-top: 2px; }
.mmr-timer { color: #2bd576; }
.mmr-grid { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 6px 10px; overflow: auto; align-content: start; }
.mmr-tile { position: relative; aspect-ratio: 4/3; background: #1a1f28; border-radius: 10px; overflow: hidden; }
.mmr-tile.me { background: #16233a; }
.mmr-video { width: 100%; height: 100%; object-fit: cover; }
.mmr-av { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #fff; background: linear-gradient(135deg,#2b3a55,#1c2435); }
.mmr-av.sm { position: static; width: 36px; height: 36px; font-size: 16px; border-radius: 50%; }
.mmr-tile-name { position: absolute; left: 0; right: 0; bottom: 0; padding: 4px 8px; font-size: 11px; background: rgba(0,0,0,.5); }
.mmr-side { position: absolute; right: 0; top: 44px; bottom: 64px; width: 82%; max-width: 360px; background: #151a23; border-left: 1px solid #232a35; display: flex; flex-direction: column; z-index: 20; }
.mmr-side-head { display: flex; align-items: center; gap: 6px; padding: 10px; border-bottom: 1px solid #232a35; }
.mmr-side-tab { border: none; background: none; color: #8b94a3; font-size: 14px; padding: 6px 10px; border-radius: 20px; }
.mmr-side-tab.on { background: #2b7cf0; color: #fff; }
.mmr-side-close { margin-left: auto; cursor: pointer; color: #8b94a3; }
.mmr-list { flex: 1; overflow-y: auto; padding: 8px; }
.mmr-mem { display: flex; align-items: center; gap: 8px; padding: 8px; }
.mmr-mem-name { flex: 1; font-size: 14px; }
.mmr-mem-role { font-size: 11px; color: #8b94a3; }
.mmr-mem-act { border: none; background: #e04545; color: #fff; border-radius: 12px; padding: 4px 10px; font-size: 12px; }
.mmr-chat { flex: 1; display: flex; flex-direction: column; }
.mmr-msgs { flex: 1; overflow-y: auto; padding: 10px; }
.mmr-msg { margin-bottom: 8px; }
.mmr-msg.mine { text-align: right; }
.mmr-msg-name { font-size: 11px; color: #8b94a3; display: block; }
.mmr-msg-img { max-width: 200px; max-height: 200px; border-radius: 8px; display: block; object-fit: cover; background:#1a1f27 }
      .mmr-msg-img:active { opacity: 0.7 }
      .mmr-msg-bubble { display: inline-block; background: #232a35; padding: 7px 11px; border-radius: 10px; font-size: 14px; max-width: 90%; word-break: break-word; }
.mmr-msg.mine .mmr-msg-bubble { background: #2b7cf0; }
.mmr-empty-chat { text-align: center; color: #5a6372; font-size: 13px; padding: 30px 10px; }
.mmr-input { display: flex; gap: 8px; padding: 8px 10px; border-top: 1px solid #232a35; }
.mmr-input-img { background: none; border: none; font-size: 20px; color: #cfd6e4; padding: 0 4px; cursor: pointer; flex: 0 0 auto }
      .mmr-input-box { flex: 1; background: #12161e; border: 1px solid #2f3743; border-radius: 8px; padding: 9px 12px; color: #fff; font-size: 14px; }
.mmr-input-send { border: none; background: #2b7cf0; color: #fff; border-radius: 8px; padding: 0 14px; }
.mmr-bar { display: flex; justify-content: space-around; align-items: center; padding: 8px 10px calc(10px + env(safe-area-inset-bottom)); background: #12161e; border-top: 1px solid #1c1c1c; }
.mmr-ctl { background: none; border: none; color: #e8eaed; text-align: center; font-size: 18px; line-height: 1.1; width: 60px; padding: 4px 0; }
.mmr-ctl small { font-size: 10px; color: #8b94a3; }
.mmr-ctl.off { color: #f0a030; }
.mmr-ctl.end { color: #e04545; }
.mmr-ctl.leave { color: #f0a030; }
.mtg-dot { width: 8px; height: 8px; border-radius: 50%; background: #23c743; box-shadow: 0 0 0 3px rgba(35,199,67,.2); flex-shrink: 0; }
/* 邀请面板 */
.mmr-mask { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.6); display: flex; align-items: flex-end; }
.mmi { background: #1b2029; border-radius: 18px 18px 0 0; width: 100%; max-width: 640px; margin: 0 auto; padding: 18px 16px 24px; max-height: 70vh; overflow-y: auto; }
.mmi-head { font-size: 16px; font-weight: 700; }
.mmi-sub { font-size: 12px; color: #8b94a3; margin: 4px 0 12px; }
.mmi-empty { text-align: center; color: #5a6372; padding: 20px 0; font-size: 13px; }
.mmi-row { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid #232a35; cursor: pointer; }
.mmi-name { flex: 1; font-size: 15px; }
.mmi-online { font-size: 11px; color: #8b94a3; }
.mmi-online.on { color: #2bd576; }
.mmi-close { width: 100%; margin-top: 14px; padding: 11px; border: none; border-radius: 10px; background: #232a35; color: #e8eaed; font-size: 15px; }
/* 创建成功面板 */
.mmc-created { background: linear-gradient(135deg,#17243a,#101a29); border: 1px solid #2b7cf0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.mc-c-title { font-size: 15px; font-weight: 700; margin-bottom: 10px; }
.mc-c-row { font-size: 14px; color: #c9d2e0; }
.mc-c-no { font-size: 24px; font-weight: 800; color: #2bd576; letter-spacing: 3px; }
.mc-c-url { font-size: 12px; color: #8b94a3; word-break: break-all; margin: 6px 0 12px; }
.mc-c-btns { display: flex; gap: 10px; }
.mc-c-btns .mmc-btn { flex: 1; padding: 10px; }
.mc-c-close { width: 100%; margin-top: 10px; padding: 8px; border: none; background: none; color: #8b94a3; font-size: 13px; }
</style>
