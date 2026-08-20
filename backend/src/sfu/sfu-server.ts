// 昆仑会议 SFU 服务器 — 千人会议室核心
// 架构：WebSocket 信令 + werift WebRTC + 选择性转发
// 扩展性：活跃发言者模型 — 只转发最近 N 个发言者的流给观众

import { WebSocketServer, WebSocket } from 'ws'
import { RTCPeerConnection, MediaStreamTrack, RTCRtpTransceiver } from 'werift'
import type { SfuPeer, SfuMeeting, SfuProducer, SfcConsumer, SfuSignalMessage } from './types.js'

// ── 配置 ──
const SFU_PORT = Number(process.env.SFU_PORT || 3001)
const MAX_ACTIVE_SPEAKERS = 4        // 同时转发的最大发言者数
const MAX_PEERS_PER_MEETING = 1000   // 单会议室最大人数
const ACTIVE_SPEAKER_THRESHOLD = 0.02 // 音频能量阈值
const SPEAKER_CHECK_INTERVAL = 2000   // 发言者检测间隔 ms

// ── 状态 ──
const meetings = new Map<string, SfuMeeting>()
const peers = new Map<string, SfuPeer>()      // peerId -> peer
const wsToPeer = new Map<WebSocket, string>()  // ws -> peerId

// ── WebSocket 信令服务器 ──
const wss = new WebSocketServer({ port: SFU_PORT })
console.log(`[SFU] 🚀 千人会议室 SFU 服务器启动，端口 ${SFU_PORT}`)

wss.on('connection', (ws: WebSocket) => {
  console.log('[SFU] 新 WebSocket 连接')

  ws.on('message', async (data: Buffer | string) => {
    try {
      const msg: SfuSignalMessage = JSON.parse(data.toString())
      await handleSignal(ws, msg)
    } catch (e) {
      console.warn('[SFU] 消息解析失败:', (e as Error).message)
    }
  })

  ws.on('close', () => {
    const peerId = wsToPeer.get(ws)
    if (peerId) {
      handleDisconnect(peerId)
      wsToPeer.delete(ws)
    }
  })

  ws.on('error', (e) => {
    console.warn('[SFU] WebSocket 错误:', e.message)
    const peerId = wsToPeer.get(ws)
    if (peerId) {
      handleDisconnect(peerId)
      wsToPeer.delete(ws)
    }
  })
})

// ── 信令处理 ──
async function handleSignal(ws: WebSocket, msg: SfuSignalMessage) {
  switch (msg.type) {
    case 'join': await handleJoin(ws, msg); break
    case 'offer': await handleOffer(ws, msg); break
    case 'ice': await handleIce(ws, msg); break
    case 'produce': await handleProduce(ws, msg); break
    case 'close': {
      const peerId = wsToPeer.get(ws)
      if (peerId) { handleDisconnect(peerId); wsToPeer.delete(ws) }
      break
    }
  }
}

async function handleJoin(ws: WebSocket, msg: { meetingId: string; token: string }) {
  // 验证 token（简化：直接信任，生产环境需要 JWT 验证）
  const peerId = extractPeerIdFromToken(msg.token)
  if (!peerId) {
    send(ws, { type: 'join-error', error: '认证失败' })
    return
  }

  const meetingId = msg.meetingId
  let meeting = meetings.get(meetingId)
  if (!meeting) {
    meeting = {
      id: meetingId,
      hostUid: peerId,
      peers: new Map(),
      activeSpeakers: [],
      maxActiveSpeakers: MAX_ACTIVE_SPEAKERS,
      createdAt: Date.now()
    }
    meetings.set(meetingId, meeting)
  }

  // 检查会议室人数上限
  if (meeting.peers.size >= MAX_PEERS_PER_MEETING) {
    send(ws, { type: 'join-error', error: '会议室已满（1000人上限）' })
    return
  }

  // 创建 WebRTC PeerConnection
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })

  const peer: SfuPeer = {
    id: peerId,
    meetingId,
    pc,
    transports: {},
    producers: new Map(),
    consumers: new Map(),
    joinedAt: Date.now(),
    lastActivity: Date.now(),
    audioLevel: 0,
    isSpeaking: false
  }

  // 处理 incoming tracks（接收来自参与者的媒体）
  pc.ontrack = (track: MediaStreamTrack) => {
    handleIncomingTrack(peer, track)
  }

  pc.onicecandidate = (candidate: any) => {
    if (candidate) {
      send(ws, { type: 'ice', candidate: candidate.toJSON ? candidate.toJSON() : candidate })
    }
  }

  pc.onconnectionstatechange = () => {
    console.log(`[SFU] Peer ${peerId} 连接状态: ${pc.connectionState}`)
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      handleDisconnect(peerId)
    }
  }

  meeting.peers.set(peerId, peer)
  peers.set(peerId, peer)
  wsToPeer.set(ws, peerId)

  console.log(`[SFU] Peer ${peerId} 加入会议 ${meetingId}，当前 ${meeting.peers.size} 人`)

  // 通知新参与者当前活跃发言者
  send(ws, {
    type: 'join-ok',
    peerId,
    activeSpeakers: meeting.activeSpeakers,
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })

  // 广播新成员加入
  broadcastToMeeting(meetingId, { type: 'peer-joined', peerId }, peerId)
}

async function handleOffer(ws: WebSocket, msg: { sdp: string; kind?: string }) {
  const peerId = wsToPeer.get(ws)
  if (!peerId) return
  const peer = peers.get(peerId)
  if (!peer) return

  await peer.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
  const answer = await peer.pc.createAnswer()
  await peer.pc.setLocalDescription(answer)

  send(ws, { type: 'answer', sdp: answer.sdp, kind: msg.kind })
}

async function handleIce(ws: WebSocket, msg: { candidate: any; kind?: string }) {
  const peerId = wsToPeer.get(ws)
  if (!peerId) return
  const peer = peers.get(peerId)
  if (!peer) return

  try {
    await peer.pc.addIceCandidate(msg.candidate)
  } catch (e) {
    console.warn('[SFU] ICE candidate 添加失败:', (e as Error).message)
  }
}

async function handleProduce(ws: WebSocket, msg: { kind: 'audio' | 'video'; rtpParameters: any }) {
  const peerId = wsToPeer.get(ws)
  if (!peerId) return
  const peer = peers.get(peerId)
  if (!peer) return

  const producerId = `${peerId}-${msg.kind}-${Date.now()}`
  const producer: SfuProducer = {
    id: producerId,
    peerId,
    kind: msg.kind,
    rtpParameters: msg.rtpParameters,
    track: null // 实际 track 从 pc.ontrack 获取
  }

  peer.producers.set(producerId, producer)

  console.log(`[SFU] Peer ${peerId} 发布 ${msg.kind} 流: ${producerId}`)

  send(ws, { type: 'produce-ok', id: producerId, kind: msg.kind })

  // 通知其他参与者有新流可用
  const meeting = meetings.get(peer.meetingId)
  if (meeting) {
    // 如果这个 producer 是活跃发言者，通知所有参与者
    broadcastNewProducer(meeting, producer)
  }
}

function handleIncomingTrack(peer: SfuPeer, track: MediaStreamTrack) {
  const kind: 'audio' | 'video' = track.kind as any
  const producerId = `${peer.id}-${kind}-track`

  // 查找或创建 producer
  let producer = peer.producers.get(producerId)
  if (!producer) {
    producer = {
      id: producerId,
      peerId: peer.id,
      kind,
      rtpParameters: {},
      track
    }
    peer.producers.set(producerId, producer)
  } else {
    producer.track = track
  }

  console.log(`[SFU] Peer ${peer.id} 的 ${kind} 轨道就绪: ${producerId}`)

  // 如果是音频，监听音频能量（活跃发言者检测）
  if (kind === 'audio') {
    monitorAudioLevel(peer, track)
  }

  // 通知会议中的其他参与者
  const meeting = meetings.get(peer.meetingId)
  if (meeting) {
    broadcastNewProducer(meeting, producer)
  }
}

// ── 媒体路由 ──
function broadcastNewProducer(meeting: SfuMeeting, producer: SfuProducer) {
  // 只给活跃发言者的流创建 consumer
  // 非发言者的流不转发（节省带宽）
  for (const [peerId, peer] of meeting.peers) {
    if (peerId === producer.peerId) continue // 不转发给自己

    // 如果 producer 的拥有者是活跃发言者，创建 consumer
    const isActiveSpeaker = meeting.activeSpeakers.includes(producer.peerId)
    if (!isActiveSpeaker && producer.kind === 'video') {
      // 非发言者的视频不转发（节省带宽）
      continue
    }

    // 创建 consumer 并通知对方
    createConsumer(peer, producer).catch((e) => {
      console.warn(`[SFU] 为 ${peerId} 创建 consumer 失败:`, e.message)
    })
  }
}

async function createConsumer(peer: SfuPeer, producer: SfuProducer) {
  const consumerId = `consumer-${peer.id}-${producer.id}`

  // 如果已存在，跳过
  if (peer.consumers.has(consumerId)) return

  const consumer: SfcConsumer = {
    id: consumerId,
    producerId: producer.id,
    peerId: peer.id,
    kind: producer.kind,
    rtpParameters: producer.rtpParameters,
    track: producer.track
  }

  peer.consumers.set(consumerId, consumer)

  // 通知对方有新流可用
  const ws = findWebSocket(peer.id)
  if (ws) {
    send(ws, {
      type: 'consume-ok',
      id: consumerId,
      producerId: producer.id,
      kind: producer.kind,
      rtpParameters: producer.rtpParameters,
      sdp: '' // 实际 SDP 通过 transceivers 处理
    })
  }
}

// ── 活跃发言者检测 ──
function monitorAudioLevel(peer: SfuPeer, track: MediaStreamTrack) {
  // 简化：基于时间轮询音频能量
  // 实际实现需要从 RTCRtpReceiver 获取 audioLevel 统计
  // werift 的 receiver 有 getStats() 方法
}

function updateActiveSpeakers(meeting: SfuMeeting) {
  // 按音频能量排序，取前 N 个
  const speakingPeers = Array.from(meeting.peers.values())
    .filter(p => p.isSpeaking)
    .sort((a, b) => b.audioLevel - a.audioLevel)
    .slice(0, meeting.maxActiveSpeakers)

  const newSpeakers = speakingPeers.map(p => p.id)
  const oldSpeakers = meeting.activeSpeakers

  // 检查是否有变化
  const changed = newSpeakers.length !== oldSpeakers.length ||
    newSpeakers.some((s, i) => s !== oldSpeakers[i])

  if (changed) {
    meeting.activeSpeakers = newSpeakers
    console.log(`[SFU] 会议 ${meeting.id} 活跃发言者更新: ${newSpeakers.join(', ')}`)

    // 广播活跃发言者变化
    broadcastToMeeting(meeting.id, { type: 'active-speakers', speakers: newSpeakers })

    // 重新路由：为新发言者创建 consumer，停止非发言者的转发
    rerouteMedia(meeting)
  }
}

function rerouteMedia(meeting: SfuMeeting) {
  for (const [peerId, peer] of meeting.peers) {
    // 为活跃发言者的流创建 consumer
    for (const speakerId of meeting.activeSpeakers) {
      if (speakerId === peerId) continue
      const speaker = meeting.peers.get(speakerId)
      if (!speaker) continue

      for (const [producerId, producer] of speaker.producers) {
        createConsumer(peer, producer).catch(() => {})
      }
    }

    // 清理非活跃发言者的 consumer
    for (const [consumerId, consumer] of peer.consumers) {
      const producerOwnerId = consumer.producerId.split('-')[0]
      if (!meeting.activeSpeakers.includes(producerOwnerId)) {
        peer.consumers.delete(consumerId)
      }
    }
  }
}

// ── 断开连接 ──
function handleDisconnect(peerId: string) {
  const peer = peers.get(peerId)
  if (!peer) return

  console.log(`[SFU] Peer ${peerId} 断开连接`)

  // 关闭 PeerConnection
  try { peer.pc.close() } catch {}

  // 从会议中移除
  const meeting = meetings.get(peer.meetingId)
  if (meeting) {
    meeting.peers.delete(peerId)
    meeting.activeSpeakers = meeting.activeSpeakers.filter(s => s !== peerId)

    // 广播离开
    broadcastToMeeting(peer.meetingId, { type: 'peer-left', peerId })

    // 清理空会议
    if (meeting.peers.size === 0) {
      meetings.delete(peer.meetingId)
      console.log(`[SFU] 会议 ${peer.meetingId} 已清空，自动销毁`)
    } else {
      // 更新活跃发言者
      updateActiveSpeakers(meeting)
    }
  }

  peers.delete(peerId)
}

// ── 工具函数 ──
function send(ws: WebSocket, msg: SfuSignalMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function broadcastToMeeting(meetingId: string, msg: SfuSignalMessage, excludePeerId?: string) {
  const meeting = meetings.get(meetingId)
  if (!meeting) return

  for (const [peerId] of meeting.peers) {
    if (peerId === excludePeerId) continue
    const ws = findWebSocket(peerId)
    if (ws) send(ws, msg)
  }
}

function findWebSocket(peerId: string): WebSocket | undefined {
  for (const [ws, pid] of wsToPeer) {
    if (pid === peerId) return ws
  }
  return undefined
}

function extractPeerIdFromToken(token: string): string | null {
  // 简化：token 就是 peerId
  // 生产环境需要 JWT 验证
  if (!token || token.length < 4) return null
  return token
}

// ── 活跃发言者检测定时器 ──
setInterval(() => {
  for (const [, meeting] of meetings) {
    if (meeting.peers.size > 1) {
      updateActiveSpeakers(meeting)
    }
  }
}, SPEAKER_CHECK_INTERVAL)

// ── 健康检查 ──
console.log(`[SFU] 配置: 单会议室最大 ${MAX_PEERS_PER_MEETING} 人, 活跃发言者 ${MAX_ACTIVE_SPEAKERS} 人`)
console.log(`[SFU] WebSocket 信令端口: ${SFU_PORT}`)
console.log(`[SFU] 等待连接...`)
