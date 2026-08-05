// useKunlunTea.ts — 昆仑茶馆 IM 连接 composable（client-only，SDK 动态加载防 SSR 崩溃）
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

    // 连接状态监听
    sdk.connectManager.addConnectStatusListener((st: number) => {
      status.value = st
    })
    // 消息监听
    if (messageHandler) {
      sdk.chatManager.addMessageListener(messageHandler)
    }
    sdk.connect()
  }

  async function disconnect() {
    if (!sdk) return
    sdk.disconnect()
    status.value = 0
  }

  function onMessage(handler: (msg: any) => void) {
    messageHandler = handler
    if (sdk) sdk.chatManager.addMessageListener(handler)
  }

  /** 发送文本消息 */
  async function sendText(text: string, channelId: string, channelType: number) {
    if (!sdk) throw new Error('SDK 未初始化')
    const channel = sdk.newChannel(channelId, channelType)
    const content = sdk.newMessageText(text)
    return sdk.chatManager.send(content, channel)
  }

  /** 拉取频道历史消息（走昆仑镜代理） */
  async function loadHistory(channelId: string, channelType: number, startSeq = 0, limit = 50) {
    const res = await authFetch('/api/im/messages/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, channelType, startSeq, limit, pullMode: 1 }),
    })
    const json = await res.json()
    return json.success ? (json.data?.messages || []) : []
  }

  return { status, userId, connected, connecting, statusLabel, connect, disconnect, onMessage, sendText, loadHistory }
}
