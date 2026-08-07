// useRtcCall.ts — 昆仑茶馆 R11 语音/视频 1v1 通话 composable
// 信令：WuKongIM CMD 消息（type=99，不落历史、实时直达）经临时私有频道 rtc_<callId>（type=4）交换
//   ⚠️ 不走私聊频道：WuKongIM v1.2.6 单聊(type=1)不支持 subscriber_add（「个人频道不支持添加订阅者」），
//      投递目标解析失败（消息永远到不了对端）；临时 type=4 频道仅订阅双方，通话结束删除
// 媒体：WebRTC P2P 直连（内容不过平台，R3 存储哲学一致）；TURN 中继兜底（coturn）
// 状态机：idle → calling → connecting → active；idle → incoming → connecting → active
import { ref, readonly } from 'vue'
import { useKunlunTea } from './useKunlunTea'

type Tea = ReturnType<typeof useKunlunTea>

export type RtcMode = 'audio' | 'video'
export type RtcState = 'idle' | 'calling' | 'incoming' | 'connecting' | 'active'

const CALL_TIMEOUT_MS = 45000 // 呼叫 45s 无人接听自动取消
const ICE_WAIT_MS = 15000 // 被叫 accept 后 15s 内未收到 offer → 超时挂断

interface CallPeer {
  uid: string
  name: string
  avatar: string
  channelId: string // 私聊频道 ID（uid@uid）
  channelType: number // 1
}

export function useRtcCall(tea: Tea) {
  const state = ref<RtcState>('idle')
  const mode = ref<RtcMode>('audio')
  const peer = ref<CallPeer | null>(null)
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  const micMuted = ref(false)
  const camOff = ref(false)
  const errorMsg = ref('')
  const busy = ref(false) // 通话中收到新来电 → 自动拒绝

  let pc: RTCPeerConnection | null = null
  let iceServers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }]
  let callId = ''
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let iceWaitTimer: ReturnType<typeof setTimeout> | null = null
  let connLostTimer: ReturnType<typeof setTimeout> | null = null
  let selfUid = ''
  let ownName = ''
  let ownAvatar = ''
  let isCaller = false
  let incomingOffer: RTCSessionDescriptionInit | null = null

  // ── 信令频道（临时私有频道，通话级生命周期）──
  async function ensureSignalChannel(targetUid: string): Promise<{ channelId: string; channelType: number }> {
    const res = await fetch('/api/im/rtc/signal-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''}` },
      body: JSON.stringify({ callId, peerUid: targetUid }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '创建信令频道失败')
    return json.data
  }
  function closeSignalChannel() {
    if (!callId) return
    fetch('/api/im/rtc/signal-channel/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''}` },
      body: JSON.stringify({ callId }),
    }).catch(() => {})
  }

  // ── 工具 ──
  function clearTimers() {
    ;[pendingTimer, iceWaitTimer, connLostTimer].forEach((t) => t && clearTimeout(t))
    pendingTimer = iceWaitTimer = connLostTimer = null
  }
  // 信令频道校验：rtc_ 前缀私有频道（type=4），仅通话双方可见，callId 匹配防干扰
  function isSignalChannel(msg: any): boolean {
    const ch = msg.channel
    return !!ch && ch.channelType === 4 && typeof ch.channelID === 'string' && ch.channelID.startsWith('rtc_')
  }

  // ── 媒体 ──
  async function acquireMedia(m: RtcMode): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: m === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    })
    return stream
  }
  function releaseMedia() {
    localStream.value?.getTracks().forEach((t) => t.stop())
    localStream.value = null
    remoteStream.value?.getTracks().forEach((t) => t.stop())
    remoteStream.value = null
  }

  // ── RTCPeerConnection ──
  function newPC(): RTCPeerConnection {
    const p = new RTCPeerConnection({ iceServers })
    p.onicecandidate = (e) => {
      if (e.candidate && peer.value && state.value !== 'idle') {
        tea.sendCMD('rtc:ice', { callId, candidate: e.candidate.toJSON() }, peer.value.channelId, peer.value.channelType).catch(() => {})
      }
    }
    p.ontrack = (e) => {
      remoteStream.value = e.streams[0] || new MediaStream([e.track])
    }
    p.onconnectionstatechange = () => {
      if (!p) return
      if (p.connectionState === 'connected' || p.connectionState === 'completed') {
        if (connLostTimer) { clearTimeout(connLostTimer); connLostTimer = null }
        state.value = 'active'
      } else if (p.connectionState === 'failed') {
        if (state.value === 'active') { errorMsg.value = '连接中断（可能是网络/NAT 限制，TURN 未生效）'; hangup(true) }
      } else if (p.connectionState === 'disconnected') {
        // 短暂抖动容忍：8s 未恢复视为断线
        if (!connLostTimer) connLostTimer = setTimeout(() => { if (state.value === 'active') { errorMsg.value = '通话连接已断开'; hangup(true) } }, 8000)
      }
    }
    localStream.value?.getTracks().forEach((t) => p.addTrack(t, localStream.value!))
    return p
  }

  function sendSignal(cmd: string, param: Record<string, any>) {
    if (!peer.value) return Promise.resolve()
    return tea.sendCMD(cmd, { callId, ...param }, peer.value.channelId, peer.value.channelType).catch((e: any) => {
      console.warn('[RTC] 信令发送失败', cmd, e)
    })
  }

  // ── 呼叫方 ──
  /** 发起通话：targetUid 目标用户，m 语音/视频 */
  async function startCall(targetUid: string, m: RtcMode, targetName: string, targetAvatar = '') {
    if (!tea.connected.value) { errorMsg.value = '茶馆未连接，请先连接'; return }
    if (state.value !== 'idle') return
    try {
      selfUid = tea.userId.value
      ownName = targetName === '' ? '' : ownName // placeholder, filled by caller via page
      mode.value = m // 先设模式：本地 PiP v-if 依赖 mode，localStream 赋值后 watch 才能绑上
      const stream = await acquireMedia(m)
      localStream.value = stream
      callId = `${selfUid.slice(0, 8)}-${Date.now().toString(36)}`
      // 创建临时信令频道并订阅双方（type=4 私有频道，绕开单聊 subscriber 限制）
      const sig = await ensureSignalChannel(targetUid)
      isCaller = true
      peer.value = { uid: targetUid, name: targetName, avatar: targetAvatar, channelId: sig.channelId, channelType: sig.channelType }
      state.value = 'calling'
      await sendSignal('rtc:call', { mode: m, callerName: ownName, callerAvatar: ownAvatar })
      pendingTimer = setTimeout(() => {
        if (state.value === 'calling') { errorMsg.value = '对方未接听，已自动取消'; cleanup() }
      }, CALL_TIMEOUT_MS)
    } catch (e: any) {
      releaseMedia()
      errorMsg.value = e?.name === 'NotAllowedError' ? '未授权麦克风/摄像头权限' : (e?.message || '发起通话失败')
      state.value = 'idle'
    }
  }

  /** 取消呼叫（对方未接时主动放弃） */
  async function cancelCall() {
    if (state.value === 'calling') {
      await sendSignal('rtc:cancel', {}).catch(() => {}) // 先发再清（cleanup 删频道）
    }
    cleanup()
  }

  // ── 被叫方 ──
  async function acceptCall() {
    if (!peer.value || !incomingOffer) return
    try {
      const stream = await acquireMedia(mode.value)
      localStream.value = stream
      state.value = 'connecting'
      await sendSignal('rtc:accept', {})
      pc = newPC()
      // 主叫收到 accept 后会发 offer；等待 offer 到达后 createAnswer
      iceWaitTimer = setTimeout(() => { if (state.value === 'connecting') { errorMsg.value = '通话建立超时'; cleanup() } }, ICE_WAIT_MS)
    } catch (e: any) {
      errorMsg.value = e?.name === 'NotAllowedError' ? '未授权麦克风/摄像头权限' : (e?.message || '接听失败')
      await sendSignal('rtc:reject', { reason: 'media_failed' })
      cleanup()
    }
  }
  function rejectCall(reason = 'declined') {
    sendSignal('rtc:reject', { reason })
    cleanup()
  }

  // ── 挂断 ──
  async function hangup(remote = false) {
    if (state.value === 'active' || state.value === 'connecting') {
      await sendSignal('rtc:hangup', {}).catch(() => {}) // 先发 hangup 再清理（cleanup 删信令频道，不能先删后发）
    }
    cleanup(remote)
  }
  function cleanup(remote = false) {
    clearTimers()
    if (pc) { try { pc.close() } catch { /* noop */ } pc = null }
    releaseMedia()
    // 延迟删信令频道：给最后一条信令（hangup/cancel）留投递时间（SDK send 仅入队，非服务端确认）
    setTimeout(closeSignalChannel, 1500)
    incomingOffer = null
    isCaller = false
    state.value = 'idle'
    peer.value = null
    micMuted.value = false
    camOff.value = false
    if (!remote && !errorMsg.value) errorMsg.value = ''
  }

  // ── 通话控制 ──
  function toggleMic() {
    micMuted.value = !micMuted.value
    localStream.value?.getAudioTracks().forEach((t) => (t.enabled = !micMuted.value))
  }
  function toggleCam() {
    camOff.value = !camOff.value
    localStream.value?.getVideoTracks().forEach((t) => (t.enabled = !camOff.value))
  }

  // ── 信令分发（页面在 tea.onCMD 中调用）──
  async function handleSignal(msg: any) {
    const content = msg.content
    if (!content || content.contentType !== 99) return
    const cmd = content.cmd
    const param = content.param || {}
    const fromUid = msg.fromUID || (msg.from_uid as string)
    if (!fromUid) return
    // 只处理 rtc_ 私有信令频道消息（频道仅双方，天然隔离）
    if (!isSignalChannel(msg)) return

    switch (cmd) {
      case 'rtc:call': {
        if (state.value !== 'idle') {
          // 忙线：自动拒绝
          tea.sendCMD('rtc:reject', { callId: param.callId, reason: 'busy' }, msg.channel.channelID, msg.channel.channelType).catch(() => {})
          return
        }
        selfUid = tea.userId.value
        callId = param.callId || ''
        isCaller = false
        mode.value = param.mode === 'video' ? 'video' : 'audio'
        peer.value = { uid: fromUid, name: param.callerName || fromUid, avatar: param.callerAvatar || '', channelId: msg.channel.channelID, channelType: msg.channel.channelType }
        incomingOffer = { type: 'offer' } // 占位：offer 由主叫稍后发送，先弹窗
        state.value = 'incoming'
        // 弹窗 45s 无操作自动消失
        pendingTimer = setTimeout(() => { if (state.value === 'incoming') cleanup() }, CALL_TIMEOUT_MS)
        break
      }
      case 'rtc:accept': {
        if (state.value !== 'calling' || param.callId !== callId) return
        state.value = 'connecting'
        clearTimers()
        pc = newPC()
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal('rtc:sdp', { sdp: pc.localDescription })
        iceWaitTimer = setTimeout(() => { if (state.value === 'connecting') { errorMsg.value = '通话建立超时'; cleanup() } }, ICE_WAIT_MS)
        break
      }
      case 'rtc:sdp': {
        if (!pc || state.value !== 'connecting' || param.callId !== callId) return
        const desc = param.sdp as RTCSessionDescriptionInit
        if (desc.type === 'offer') {
          await pc.setRemoteDescription(desc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await sendSignal('rtc:sdp', { sdp: pc.localDescription })
        } else if (desc.type === 'answer') {
          await pc.setRemoteDescription(desc)
        }
        break
      }
      case 'rtc:ice': {
        if (!pc || param.callId !== callId) return
        try { await pc.addIceCandidate(param.candidate) } catch { /* 竞态忽略 */ }
        break
      }
      case 'rtc:reject': {
        if (state.value === 'calling' && param.callId === callId) {
          errorMsg.value = param.reason === 'busy' ? '对方忙线中' : '对方已拒绝'
          cleanup()
        }
        break
      }
      case 'rtc:cancel': {
        if (state.value === 'incoming' && param.callId === callId) {
          errorMsg.value = '对方已取消呼叫'
          cleanup()
        }
        break
      }
      case 'rtc:hangup': {
        if ((state.value === 'active' || state.value === 'connecting' || state.value === 'incoming' || state.value === 'calling') && param.callId === callId) {
          cleanup(true)
        }
        break
      }
    }
  }

  /** 页面初始化：拉取 ICE 配置 + 注册信令监听 */
  async function init(opts: { onCallState?: (s: RtcState) => void }) {
    try {
      const res = await fetch('/api/im/rtc/config', {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''}` },
      })
      const json = await res.json()
      if (json.success && json.data?.iceServers?.length) iceServers = json.data.iceServers
    } catch { /* 默认 Google STUN 兜底 */ }
    tea.onCMD(handleSignal)
    // 身份信息（页面在 connect 后调用 setIdentity 补齐）
    return { setIdentity: (uid: string, name: string, avatar: string) => { selfUid = uid; ownName = name; ownAvatar = avatar } }
  }

  return {
    state: readonly(state),
    mode: readonly(mode),
    peer: readonly(peer),
    localStream: readonly(localStream),
    remoteStream: readonly(remoteStream),
    micMuted: readonly(micMuted),
    camOff: readonly(camOff),
    errorMsg: readonly(errorMsg),
    init,
    startCall,
    cancelCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMic,
    toggleCam,
    handleSignal,
  }
}
