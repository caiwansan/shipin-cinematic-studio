// useKunlunTea.ts — 昆仑茶馆 IM 连接 composable（client-only，SDK 动态加载防 SSR 崩溃）
// P1.2：三栏控制台数据（频道分组 / 成员 / 私聊 / 用户 / 在线状态上报）
import { ref, computed } from 'vue'

// 带登录态的 fetch（localStorage auth_token → Authorization）
function authFetch(input: string, init?: RequestInit): Promise<Response> {
  let token = ''
  if (typeof window !== 'undefined') {
    token =
      window.localStorage?.getItem('auth_token') ||
      window.localStorage?.getItem('accessToken') ||
      ''
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(input, { ...init, headers, credentials: 'include' })
}

// WuKongIM ConnectStatus: 0=Disconnect 1=Connected 2=Connecting 3=ConnectFail 4=ConnectKick
const CONNECT_STATUS = { Disconnect: 0, Connected: 1, Connecting: 2, ConnectFail: 3, ConnectKick: 4 } as const

let sdkPromise: Promise<any> | null = null
function getSDK() {
  if (!sdkPromise) {
    sdkPromise = import('wukongimjssdk').then((mod: any) => {
      const sdk = mod.default?.shared ? mod.default.shared() : mod.shared()
      return sdk
    })
  }
  return sdkPromise
}

// SDK 模块导出（CMDContent 等类）— RTC 信令构造用
let sdkModulePromise: Promise<any> | null = null
function getSDKModule() {
  if (!sdkModulePromise) {
    sdkModulePromise = import('wukongimjssdk')
  }
  return sdkModulePromise
}

export function useKunlunTea() {
  const status = ref(0)
  const userId = ref('')
  const connected = computed(() => status.value === CONNECT_STATUS.Connected)
  const connecting = computed(() => status.value === CONNECT_STATUS.Connecting)
  const statusLabel = computed(() => {
    const map: Record<number, string> = {
      0: '未连接',
      1: '已连接',
      2: '连接中',
      3: '连接失败',
      4: '被踢下线',
    }
    return map[status.value] || '未知'
  })

  let sdk: any = null
  let messageHandler: ((msg: any) => void) | null = null
  let cmdHandler: ((msg: any) => void) | null = null
  let sendStatusHandler: ((p: any) => void) | null = null

  async function connect() {
    const tokenRes = await authFetch('/api/im/token', { method: 'POST' })
    const tokenJson = await tokenRes.json()
    if (!tokenJson.success) throw new Error(tokenJson.error || '获取 IM token 失败')
    const { uid, token, wsAddr } = tokenJson.data

    const configRes = await authFetch('/api/im/config')
    const configJson = await configRes.json()
    const finalWs = configJson.data?.wsAddr || wsAddr

    sdk = await getSDK()
    sdk.config.addr = finalWs
    sdk.config.uid = uid
    sdk.config.token = token
    userId.value = uid

    // IM-CHA-M10.2 修复：SDK 默认把 type=2 当图片（MessageImage）解码，服务端代发消息
    // （红包/礼物/抢红包/撤回）payload={type:2, content:{kind,...}} 嵌套字段全被丢弃
    // → 好友实时收到的红包/礼物渲染为空（history 正常因前端自己解 payload）。
    // 注册增强解码类：平铺嵌套 content，图片（url/width/height）与代发消息（kind）双兼容
    try {
      const mod = await getSDKModule()
      const JSONContentClass = class JSONContent extends mod.MessageContent {
        raw: any = null
        content: any = null
        constructor() { super() }
        get contentType() { return 2 }
        decodeJSON(c: any) {
          this.raw = c
          if (c && typeof c === 'object') {
            if (c.content && typeof c.content === 'object') {
              this.content = c.content
              Object.assign(this, c.content)
            } else if (typeof c.content === 'string') {
              this.content = c.content
            }
            if (c.type !== undefined) this.type = c.type
          }
        }
        encodeJSON() {
          return this.raw?.content && typeof this.raw.content === 'object' ? this.raw.content : this.raw || {}
        }
      }
      sdk.register(2, () => new JSONContentClass())
    } catch (e) {
      console.warn('[昆仑茶馆] type=2 解码增强注册失败（非致命）', e)
    }

    // SDK provider：频道成员列表走昆仑镜 API（WuKongIM v1.2.6 无订阅者查询接口）
    try {
      if (sdk.config.provider) {
        sdk.config.provider.channelInfoCallback = async (ch: any) => {
          return { channel: ch, name: ch.channelID === 'kl_public_tea' ? '昆仑茶馆 · 大堂' : '', avatar: '' }
        }
        sdk.config.provider.syncSubscribersCallback = async (ch: any, _version: number) => {
          const res = await authFetch(`/api/im/channels/${encodeURIComponent(ch.channelID)}/members?type=${ch.channelType}`)
          const json = await res.json()
          const members = json.success ? (json.data?.members || []) : []
          return members.map((m: any) => ({
            ...m,
            channel: sdk.newChannel(m.channel.channelID, m.channel.channelType),
          }))
        }
        sdk.config.provider.syncConversationsCallback = async () => []
      }
    } catch (e) {
      console.warn('[昆仑茶馆] provider 配置失败（非致命）', e)
    }

    // 连接状态监听
    sdk.connectManager.addConnectStatusListener((st: number) => {
      status.value = st
      // 连接/断开 → 上报在线状态（fire-and-forget）
      if (st === CONNECT_STATUS.Connected) reportPresence(true)
      if (st === CONNECT_STATUS.Disconnect) reportPresence(false)
    })
    // 消息监听
    if (messageHandler) {
      sdk.chatManager.addMessageListener(messageHandler)
    }
    // CMD 信令监听（RTC 语音/视频 1v1 走 WuKongIM 命令消息，不落历史、实时直达）
    if (cmdHandler) {
      sdk.chatManager.addCMDListener(cmdHandler)
    }
    // 发送回执监听（SendackPacket：服务端确认发送结果）
    if (sendStatusHandler) {
      sdk.chatManager.addMessageStatusListener(sendStatusHandler)
    }
    sdk.connect()
  }

  async function disconnect() {
    if (!sdk) return
    reportPresence(false)
    sdk.disconnect()
    status.value = 0
  }

  /** 频道订阅丢失（容器重启/订阅被清）→ 重新签发 token（幂等 subscriber_add 恢复订阅）+ 重连 */
  async function rejoin() {
    if (!sdk) {
      await connect()
      return
    }
    const tokenRes = await authFetch('/api/im/token', { method: 'POST' })
    const tokenJson = await tokenRes.json()
    if (!tokenJson.success) throw new Error(tokenJson.error || '获取 IM token 失败')
    sdk.config.uid = tokenJson.data.uid
    sdk.config.token = tokenJson.data.token
    userId.value = tokenJson.data.uid
    sdk.disconnect()
    await new Promise((r) => setTimeout(r, 300))
    sdk.connect()
  }

  function onMessage(handler: (msg: any) => void) {
    messageHandler = handler
    if (sdk) sdk.chatManager.addMessageListener(handler)
  }

  /** CMD 信令监听（RTC 通话信令；WuKongIM 命令消息 contentType=99，不落历史） */
  function onCMD(handler: (msg: any) => void) {
    cmdHandler = handler
    if (sdk) sdk.chatManager.addCMDListener(handler)
  }

  /** 发送 CMD 信令消息（RTC 语音/视频 1v1）
   *  SDK CMDContent.encodeJSON 返回 {}（cmd/param 不随 payload 发送）→ 覆写为携带 cmd+param
   *  接收端 CMDContent.decodeJSON 解析出 cmd/param → addCMDListener 分流 */
  async function sendCMD(cmd: string, param: any, channelId: string, channelType: number) {
    if (!sdk) throw new Error('SDK 未初始化')
    const mod = await getSDKModule()
    const content = new mod.CMDContent()
    content.cmd = cmd
    content.param = param
    content.encodeJSON = () => ({ cmd, param })
    const channel = sdk.newChannel(channelId, channelType)
    return sdk.chatManager.send(content, channel)
  }

  /** 发送回执（SendackPacket：clientSeq + reasonCode，0=成功） */
  function onSendStatus(handler: (p: any) => void) {
    sendStatusHandler = handler
    if (sdk) sdk.chatManager.addMessageStatusListener(handler)
  }

  /** 发送文本消息 */
  async function sendText(text: string, channelId: string, channelType: number) {
    if (!sdk) throw new Error('SDK 未初始化')
    const channel = sdk.newChannel(channelId, channelType)
    const content = sdk.newMessageText(text)
    return sdk.chatManager.send(content, channel)
  }

  // ══ IM-CHA-M10 语音消息（自定义 contentType=5） ══
  // 继承 SDK MessageContent：encodeJSON 输出 {url, duration, name, ttlHours}，type 自动=5
  let VoiceContentClass: any = null
  async function getVoiceContentClass() {
    if (VoiceContentClass) return VoiceContentClass
    const mod = await getSDKModule()
    VoiceContentClass = class VoiceContent extends mod.MessageContent {
      url = ''
      duration = 0
      name = ''
      ttlHours = 168
      constructor(url = '', duration = 0, name = '', ttlHours = 168) {
        super()
        this.url = url
        this.duration = duration
        this.name = name
        this.ttlHours = ttlHours
      }
      get contentType() {
        return 5
      }
      encodeJSON() {
        return { url: this.url, duration: this.duration, name: this.name, ttlHours: this.ttlHours }
      }
      decodeJSON(c: any) {
        this.url = c?.url || ''
        this.duration = c?.duration || 0
        this.name = c?.name || ''
        this.ttlHours = c?.ttlHours || 168
      }
    }
    // 注册类型工厂：SDK 收到 type=5 消息时用该类 decodeJSON
    try {
      sdk?.register?.(5, () => new VoiceContentClass())
    } catch { /* SDK 未初始化时注册会在 connect 后由 sendVoice 完成 */ }
    return VoiceContentClass
  }

  /** 发送语音消息（先 /api/im/upload 上传，再 SDK 发自定义 type=5） */
  async function sendVoice(opts: { url: string; duration: number; name: string; ttlHours: number; channelId: string; channelType: number }) {
    if (!sdk) throw new Error('SDK 未初始化')
    const VCls = await getVoiceContentClass()
    sdk.register(5, () => new VCls())
    const content = new VCls(opts.url, opts.duration, opts.name, opts.ttlHours)
    const channel = sdk.newChannel(opts.channelId, opts.channelType)
    return sdk.chatManager.send(content, channel)
  }

  /** 订阅频道（显式订阅：私聊/私有频道必须订阅才能收到实时消息；listener 置空避免与全局 onMessage 双渲染） */
  function subscribeChannel(channelId: string, channelType: number) {
    if (!sdk) return
    const channel = sdk.newChannel(channelId, channelType)
    sdk.onSubscribe(channel, () => {})
  }

  /** 拉取频道历史消息（走昆仑镜代理） */
  async function loadHistory(channelId: string, channelType: number, startSeq = 0, limit = 50) {
    const res = await authFetch('/api/im/messages/history', {
      method: 'POST',
      body: JSON.stringify({ channelId, channelType, startSeq, limit, pullMode: 1 }),
    })
    const json = await res.json()
    return json.success ? (json.data?.messages || []) : []
  }

  /** 频道列表（三栏左栏：公共频道 / 我的频道 / 最近私聊） */
  async function loadChannels() {
    const res = await authFetch('/api/im/channels')
    const json = await res.json()
    return json.success ? json.data : { public: [], groups: [], dms: [] }
  }

  /** 频道成员列表 */
  async function loadMembers(channelId: string, channelType: number) {
    const res = await authFetch(`/api/im/channels/${encodeURIComponent(channelId)}/members?type=${channelType}`)
    const json = await res.json()
    return json.success ? (json.data?.members || []) : []
  }

  /** 创建/复用私聊频道 */
  async function ensurePrivate(peerUid: string) {
    const res = await authFetch('/api/im/channels/ensure-private', {
      method: 'POST',
      body: JSON.stringify({ peerUid }),
    })
    const json = await res.json()
    return json.success ? json.data : null
  }

  /** 用户列表（右栏好友 tab） */
  async function loadUsers(q = '') {
    const res = await authFetch(`/api/im/users${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    const json = await res.json()
    return json.success ? (json.data?.users || []) : []
  }

  /** 批量解析 uid → 账号昵称（群里说话显示昵称） */
  async function resolveNames(uids: string[]) {
    const res = await authFetch('/api/im/users/resolve', { method: 'POST', body: JSON.stringify({ uids }) })
    const json = await res.json()
    return json.success ? (json.data?.names || {}) : {}
  }

  /** 在线状态上报 */
  async function reportPresence(online: boolean) {
    try {
      await authFetch('/api/im/presence', { method: 'POST', body: JSON.stringify({ online }) })
    } catch (e) {
      /* 非致命 */
    }
  }

  return { status, userId, connected, connecting, statusLabel, connect, disconnect, rejoin, onMessage, onCMD, sendCMD, onSendStatus, sendText, sendVoice, subscribeChannel, loadHistory, loadChannels, loadMembers, ensurePrivate, loadUsers, resolveNames, reportPresence }
}
