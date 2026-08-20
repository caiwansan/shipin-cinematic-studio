// useSigning.ts — 手机版全局身份签名工具
// 对齐桌面 identity.js：助记词 → AES 解密私钥 → ECDSA P-256 SHA-256 签名
// 覆盖：发帖内容 / 聊天文本 / 图片·视频(media-sign 链)
import { ref } from 'vue'
import { mobileAuthFetch } from './useMobileApi'

export function useSigning() {
  // 取本地助记词（kunlun_idme），无则提示先创建身份
  const ready = ref(false)
  const pubKey = ref('')

  function bufToB64(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    let bin = ''
    const CH = 0x8000
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)))
    return btoa(bin)
  }
  async function idKey(mnemonic: string): Promise<Uint8Array> {
    const data = new TextEncoder().encode(String(mnemonic).trim().toLowerCase())
    return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  }
  function ecdsaSigToB64(sigBytes: Uint8Array): string {
    if (sigBytes.length === 64) {
      // P1363(r||s) → DER(SHA256withECDSA)：30 len 02 len r 02 len s
      const r = sigBytes.slice(0, 32), s = sigBytes.slice(32)
      const strip = (a: Uint8Array) => { let i = 0; while (i < a.length - 1 && a[i] === 0) i++; const b = a.slice(i); if (b[0] & 0x80) return new Uint8Array([0, ...b]); return b }
      const rn = strip(r), sn = strip(s)
      const der = new Uint8Array([0x30, 0, 0x02, rn.length, ...rn, 0x02, sn.length, ...sn])
      der[1] = der.length - 2
      return bufToB64(der)
    }
    return bufToB64(sigBytes)
  }
  function myMnemonic(): string {
    try { return (localStorage.getItem('kunlun_idme') || '').trim() } catch { return '' }
  }
  function hasIdentity(): boolean { return !!myMnemonic() }

  // 取身份公钥（PEM）
  async function loadPubKey(): Promise<string> {
    if (pubKey.value) return pubKey.value
    try {
      const r = await mobileAuthFetch('/api/auth/identity/info')
      const j = await r.json()
      pubKey.value = j.data?.pubKey || ''
      return pubKey.value
    } catch { return '' }
  }

  // 用助记词对文本签名 → base64(DER)
  async function signText(mnemonic: string, text: string): Promise<string> {
    const aesRaw = await crypto.subtle.importKey('raw', await idKey(mnemonic), 'AES-GCM', false, ['decrypt'])
    const infoRes = await mobileAuthFetch('/api/auth/identity/info')
    const info = await infoRes.json()
    const enc = info?.data?.encKey || info?.data?.privateKeyEnc || ''
    if (!enc) throw new Error('未找到身份私钥，请先「验证身份」或重新创建身份')
    const parts = String(enc).split('.')
    const iv = new Uint8Array([...atob(parts[0])].map((c) => c.charCodeAt(0)))
    const tag = new Uint8Array([...atob(parts[1])].map((c) => c.charCodeAt(0)))
    const ct = new Uint8Array([...atob(parts[2])].map((c) => c.charCodeAt(0)))
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: undefined, tagLength: 128 }, aesRaw, new Uint8Array([...ct, ...tag]))
    const pkcs8 = pt
    const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(text))
    return ecdsaSigToB64(new Uint8Array(sig))
  }

  // 图片/视频：签名 url|kind 并同步到 /api/tea/media-sign（密钥+签名链）
  async function signMedia(url: string, kind: 'send' | 'forward' = 'send'): Promise<{ ok: boolean; err?: string }> {
    const mn = myMnemonic()
    if (!mn) return { ok: false, err: 'no_identity' }
    try {
      const sig = await signText(mn, url + '|' + kind)
      const pk = await loadPubKey()
      const r = await mobileAuthFetch('/api/tea/media-sign', { method: 'POST', body: JSON.stringify({ url, kind, sig, pubKey: pk }) })
      const j = await r.json()
      return r.ok && j.success ? { ok: true } : { ok: false, err: j.error || '签名上链失败' }
    } catch (e: any) { return { ok: false, err: e?.message || '签名失败' } }
  }

  // 全局：确保身份可用；无身份返回 false（调用方提示）
  function ensureIdentity(): boolean { return hasIdentity() }

  return { hasIdentity, ensureIdentity, myMnemonic, signText, signMedia, loadPubKey }
}
