// 昆仑会议 SFU 类型定义

export interface SfuPeer {
  id: string              // user_uid
  meetingId: string
  pc: any                 // RTCPeerConnection (werift)
  transports: {
    audio?: any           // RTCRtpReceiver
    video?: any           // RTCRtpReceiver
  }
  producers: Map<string, SfuProducer>  // trackId -> producer
  consumers: Map<string, SfcConsumer>  // producerId -> consumer
  joinedAt: number
  lastActivity: number
  audioLevel: number      // 0-1, for active speaker detection
  isSpeaking: boolean
}

export interface SfuProducer {
  id: string
  peerId: string
  kind: 'audio' | 'video'
  rtpParameters: any
  track: any              // MediaStreamTrack
}

export interface SfcConsumer {
  id: string
  producerId: string
  peerId: string          // target peer
  kind: 'audio' | 'video'
  rtpParameters: any
  track: any
}

export interface SfuMeeting {
  id: string
  hostUid: string
  peers: Map<string, SfuPeer>  // userUid -> peer
  activeSpeakers: string[]       // userUids of current active speakers
  maxActiveSpeakers: number      // max active speakers to forward
  createdAt: number
}

// WebSocket 信令消息
export type SfuSignalMessage =
  | { type: 'join'; meetingId: string; token: string }
  | { type: 'join-ok'; peerId: string; activeSpeakers: string[]; iceServers: any[] }
  | { type: 'join-error'; error: string }
  | { type: 'offer'; sdp: string; kind: 'audio' | 'video' }
  | { type: 'answer'; sdp: string; kind: 'audio' | 'video' }
  | { type: 'ice'; candidate: any; kind?: 'audio' | 'video' }
  | { type: 'produce'; kind: 'audio' | 'video'; rtpParameters: any }
  | { type: 'produce-ok'; id: string; kind: 'audio' | 'video' }
  | { type: 'produce-error'; error: string }
  | { type: 'consume'; producerId: string; kind: 'audio' | 'video'; rtpParameters: any }
  | { type: 'consume-ok'; id: string; producerId: string; kind: 'audio' | 'video'; rtpParameters: any; sdp: string }
  | { type: 'consume-error'; error: string }
  | { type: 'peer-joined'; peerId: string }
  | { type: 'peer-left'; peerId: string }
  | { type: 'active-speakers'; speakers: string[] }
  | { type: 'speaking'; peerId: string; speaking: boolean }
  | { type: 'close' }
