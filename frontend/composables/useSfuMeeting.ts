// 昆仑会议 SFU 客户端 — 千人会议室 WebRTC 连接
// 架构：WebSocket 信令 + 浏览器原生 WebRTC + 活跃发言者模型

import { ref, reactive } from 'vue'

export interface SfuConfig {
  sfuUrl: string
  sfuToken: string
  meetingId: string
  iceServers: RTCIceServer[]
}

export interface RemotePeer {
  uid: string
  name?: string
  stream?: MediaStream
  audioTrack?: MediaStreamTrack
  videoTrack?: MediaStreamTrack
  isSpeaking: boolean
  isHost: boolean
}

export function useSfuMeeting() {
  const connected = ref(false)
  const connecting = ref(false)
  const error = ref('')
  const remotePeers = reactive<Map<string, RemotePeer>>(new Map())
  const activeSpeakers = ref<string[]>([])
  const localStream = ref<MediaStream | null>(null)

  let ws: WebSocket | null = null
  let pc: RTCPeerConnection | null = null
  let cfg: SfuConfig | null = null
  let reconnectTimer: any = null

  async function connect(config: SfuConfig): Promise<boolean> {
    cfg = config
    connecting.value = true
    error.value = ''

    try {
      // 1. 获取本地媒体
      localStream.value = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 640 }, height: { ideal: 480 } }
      })
    } catch (e) {
      console.warn('[SFU] 媒体获取失败，尝试仅音频:', e)
      try {
        localStream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (e2) {
        error.value = '无法访问麦克风/摄像头'
        connecting.value = false
        return false
      }
    }

    // 2. 创建 PeerConnection
    pc = new RTCPeerConnection({ iceServers: config.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }] })

    // 添加本端轨道
    localStream.value.getTracks().forEach((track) => {
      if (pc && localStream.value) {
        pc.addTrack(track, localStream.value)
      }
    })

    // 处理远端轨道
    pc.ontrack = (event: RTCTrackEvent) => {
      const [stream] = event.streams
      if (!stream) return
      // 这里需要根据 track 的 metadata 或 ssrc 来识别是哪个 peer 的流
      // 简化：通过 SFU 信令消息中的 producerId 来关联
      handleRemoteTrack(stream, event.track)
    }

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ice', candidate: event.candidate.toJSON() }))
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('[SFU] 连接状态:', pc?.connectionState)
      if (pc?.connectionState === 'failed' || pc?.connectionState === 'closed') {
        error.value = '连接失败'
        connected.value = false
      }
    }

    // 3. 建立 WebSocket 信令
    return new Promise<boolean>((resolve) => {
      try {
        ws = new WebSocket(config.sfuUrl)

        ws.onopen = async () => {
          console.log('[SFU] WebSocket 已连接')
          // 发送加入请求
          ws?.send(JSON.stringify({ type: 'join', meetingId: config.meetingId, token: config.sfuToken }))
        }

        ws.onmessage = async (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data)
            await handleSignal(msg, resolve)
          } catch (e) {
            console.warn('[SFU] 消息解析失败:', e)
          }
        }

        ws.onerror = (e) => {
          console.error('[SFU] WebSocket 错误:', e)
          error.value = '信令连接失败'
          connecting.value = false
          resolve(false)
        }

        ws.onclose = () => {
          console.log('[SFU] WebSocket 已关闭')
          connected.value = false
        }
      } catch (e) {
        error.value = '连接失败'
        connecting.value = false
        resolve(false)
      }
    })
  }

  async function handleSignal(msg: any, resolve?: (v: boolean) => void) {
    switch (msg.type) {
      case 'join-ok': {
        connected.value = true
        connecting.value = false
        activeSpeakers.value = msg.activeSpeakers || []
        // 创建并发送 offer
        if (pc) {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          ws?.send(JSON.stringify({ type: 'offer', sdp: offer.sdp }))
        }
        resolve?.(true)
        break
      }
      case 'join-error': {
        error.value = msg.error || '加入失败'
        connecting.value = false
        resolve?.(false)
        break
      }
      case 'answer': {
        if (pc && msg.sdp) {
          await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
        }
        break
      }
      case 'ice': {
        if (pc && msg.candidate) {
          try { await pc.addIceCandidate(msg.candidate) } catch (e) { /* ignore */ }
        }
        break
      }
      case 'peer-joined': {
        console.log('[SFU] 新成员加入:', msg.peerId)
        break
      }
      case 'peer-left': {
        remotePeers.delete(msg.peerId)
        break
      }
      case 'active-speakers': {
        activeSpeakers.value = msg.speakers || []
        break
      }
      case 'speaking': {
        const peer = remotePeers.get(msg.peerId)
        if (peer) peer.isSpeaking = msg.speaking
        break
      }
      case 'produce-ok': {
        console.log('[SFU] 流发布成功:', msg.id, msg.kind)
        break
      }
    }
  }

  function handleRemoteTrack(stream: MediaStream, track: MediaStreamTrack) {
    // 简化：通过 stream.id 识别 peer
    // 实际实现需要 SFU 在信令消息中携带 peerId
    const peerId = stream.id || 'unknown'
    let peer = remotePeers.get(peerId)
    if (!peer) {
      peer = { uid: peerId, isSpeaking: false, isHost: false }
      remotePeers.set(peerId, peer)
    }
    if (track.kind === 'audio') peer.audioTrack = track
    if (track.kind === 'video') peer.videoTrack = track
    peer.stream = stream
  }

  // 切换麦克风
  function toggleMic(muted: boolean) {
    localStream.value?.getAudioTracks().forEach((t) => (t.enabled = !muted))
  }

  // 切换摄像头
  function toggleCam(off: boolean) {
    localStream.value?.getVideoTracks().forEach((t) => (t.enabled = !off))
  }

  // 断开连接
  function disconnect() {
    try { ws?.send(JSON.stringify({ type: 'close' })) } catch {}
    try { ws?.close() } catch {}
    ws = null
    try { pc?.close() } catch {}
    pc = null
    localStream.value?.getTracks().forEach((t) => t.stop())
    localStream.value = null
    remotePeers.clear()
    connected.value = false
    activeSpeakers.value = []
  }

  return {
    connected,
    connecting,
    error,
    remotePeers,
    activeSpeakers,
    localStream,
    connect,
    disconnect,
    toggleMic,
    toggleCam
  }
}
