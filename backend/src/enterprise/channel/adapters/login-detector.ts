/**
 * login-detector.ts — BrowserLoginDetector v2
 *
 * SPRINT-MEDIA-LOGIN-REALITY-FIX-01 Task02
 * 统一二维码探针：任何平台禁止自行编写二维码提取逻辑，统一走本 Detector。
 *
 * 检测顺序（掌柜定义）：
 *   A. DOM img    → img[src*=qr|login]、data:image、https 二维码图（视频号）
 *   B. Canvas     → 普通 canvas + shadow DOM 内 canvas，toDataURL 取图
 *   C. iframe     → 遍历 page.frames()，子 frame 内重复 A+B（跨域 frame 各自 evaluate）
 *   D. 截图 fallback → 视口截图 → sharp 中央裁剪 → jsQR 解码验证 → 命中返回裁剪图
 *
 * 返回统一结构：
 *   { loginMethod, qrCode(base64 已放大白边), source, channels: {img,canvas,iframe,screenshot}, detail }
 * channels 供 Login Debug Panel 展示「为什么没有二维码」。
 *
 * 纪律：禁止假设二维码存在（canvas/shadow DOM/blob URL/iframe 都要覆盖）；
 *      任何通道失败都记录到 channels，不静默。
 */
import type { Page, Frame } from 'playwright'
import sharp from 'sharp'
import jsQR from 'jsqr'

export interface QrChannelState {
  found: boolean
  count: number
  note?: string
}

export interface QrHit {
  src?: string
  x: number
  y: number
  w: number
  h: number
}

export interface QrDetectionResult {
  loginMethod: 'qr' | 'sms' | 'unknown'
  /** base64（已放大+白边，可直接 data:image/png 展示） */
  qrCode?: string
  expiresAt?: string
  /** 命中来源：img | canvas | iframe | screenshot | none */
  source: 'img' | 'canvas' | 'iframe' | 'screenshot' | 'none'
  detail?: QrHit
  channels: {
    img: QrChannelState
    canvas: QrChannelState
    iframe: QrChannelState & { frames: number }
    screenshot: QrChannelState & { scanned: boolean }
  }
}

/** frame 内 img 扫描（A 通道核心，Node 端不可直接跑 → 序列化为字符串 evaluate） */
const IMG_SCAN_FN = `(() => {
  const hits = []
  const imgs = Array.from(document.querySelectorAll('img'))
  for (const el of imgs) {
    const r = el.getBoundingClientRect()
    const src = el.src || ''
    const w = r.width, h = r.height
    let reason = ''
    if (/^(data:image\\/png|data:image\\/jpeg|data:image\\/webp)/.test(src) && w >= 100 && w <= 400 && Math.abs(w - h) < 40) {
      reason = 'data-image-square'
    } else if (/qrcode|qr_|qrCode|qr=|login/i.test(src) && w >= 100 && w <= 500 && h >= 100 && h <= 500) {
      reason = 'url-qr-keyword'
    } else if (/data:image/.test(src) && w >= 60 && w <= 500 && Math.abs(w - h) < 50) {
      reason = 'data-image-any'
    }
    if (reason && w > 0 && h > 0) {
      hits.push({ src: src.slice(0, 4096), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(w), h: Math.round(h), reason })
    }
  }
  return hits
})()`

/** frame 内 canvas 扫描（B 通道核心，含 shadow DOM；toDataURL 失败=tainted 跳过） */
const CANVAS_SCAN_FN = `(() => {
  const hits = []
  const seen = new Set()
  const visit = (root) => {
    for (const el of root.querySelectorAll('canvas')) {
      if (seen.has(el)) continue
      seen.add(el)
      const r = el.getBoundingClientRect()
      const w = r.width, h = r.height
      if (w < 60 || w > 600 || h < 60 || h > 600) continue
      if (Math.abs(w - h) > 60) continue
      try {
        const dataUrl = el.toDataURL('image/png')
        if (dataUrl && dataUrl.length > 4000) {
          hits.push({ src: dataUrl.slice(0, 4096), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(w), h: Math.round(h), reason: 'canvas' })
        }
      } catch (e) { /* tainted canvas 跳过 */ }
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) visit(el.shadowRoot)
    }
  }
  visit(document)
  return hits
})()`

/** 页面文本摘要（Login Debug Panel 用）：去空白取前 180 字 */
const TEXT_SAMPLE_FN = `(() => {
  const t = (document.body ? document.body.innerText : '') || ''
  return t.replace(/\\s+/g, ' ').slice(0, 180)
})()`

export class BrowserLoginDetector {
  /** 主入口：A→B→C→D 顺序检测，任一命中即返回 */
  async detect(page: Page): Promise<QrDetectionResult> {
    const channels = {
      img: { found: false, count: 0, note: '' } as QrChannelState,
      canvas: { found: false, count: 0, note: '' } as QrChannelState,
      iframe: { found: false, count: 0, note: '', frames: 0 } as QrChannelState & { frames: number },
      screenshot: { found: false, count: 0, note: '', scanned: false } as QrChannelState & { scanned: boolean },
    }

    try {
      // A. DOM img（主 frame）
      const imgHits = (await page.evaluate(IMG_SCAN_FN).catch(() => [])) as QrHit[]
      channels.img.count = imgHits.length
      if (imgHits.length) {
        channels.img.found = true
        channels.img.note = `命中 ${imgHits.length} 张候选图`
        // ⚠️ 禁止假设二维码存在：候选图必须过 jsQR 解码验证，失败继续下一通道
        for (const cand of imgHits) {
          const b64 = await this.imgToBase64(page, cand)
          if (b64 && (await this.b64IsQr(b64))) {
            channels.img.note = `命中 ${imgHits.length} 张候选图，jsQR 验证通过`
            return this.ok('img', b64, cand, channels)
          }
        }
        channels.img.note = '候选图 jsQR 验证全部失败（可能是 banner/占位图）'
      } else {
        channels.img.note = '未找到二维码 img'
      }
    } catch (e: any) {
      channels.img.note = `img 通道异常: ${e?.message?.slice(0, 60)}`
    }

    try {
      // B. Canvas（主 frame + shadow DOM）
      const canvasHits = (await page.evaluate(CANVAS_SCAN_FN).catch(() => [])) as any[]
      channels.canvas.count = canvasHits.length
      if (canvasHits.length) {
        channels.canvas.found = true
        channels.canvas.note = `命中 ${canvasHits.length} 个 canvas`
        for (const cand of canvasHits) {
          const b64 = await this.imgToBase64(page, cand)
          if (b64 && (await this.b64IsQr(b64))) {
            channels.canvas.note = `命中 ${canvasHits.length} 个 canvas，jsQR 验证通过`
            return this.ok('canvas', b64, cand, channels)
          }
        }
        channels.canvas.note = 'canvas jsQR 验证全部失败'
      } else {
        channels.canvas.note = '未找到二维码 canvas'
      }
    } catch (e: any) {
      channels.canvas.note = `canvas 通道异常: ${e?.message?.slice(0, 60)}`
    }

    try {
      // C. iframe（所有子 frame 内重复 img + canvas）
      const frames = page.frames().filter((f) => f !== page.mainFrame())
      channels.iframe.frames = frames.length
      for (const f of frames) {
        const fImg = (await f.evaluate(IMG_SCAN_FN).catch(() => [])) as QrHit[]
        if (fImg.length) {
          channels.iframe.found = true
          channels.iframe.count += fImg.length
          for (const cand of fImg) {
            const b64 = await this.imgToBase64(page, cand, f)
            if (b64 && (await this.b64IsQr(b64))) return this.ok('iframe', b64, cand, channels)
          }
        }
        const fCanvas = (await f.evaluate(CANVAS_SCAN_FN).catch(() => [])) as any[]
        if (fCanvas.length) {
          channels.iframe.found = true
          channels.iframe.count += fCanvas.length
          for (const cand of fCanvas) {
            const b64 = await this.imgToBase64(page, cand, f)
            if (b64 && (await this.b64IsQr(b64))) return this.ok('iframe', b64, cand, channels)
          }
        }
      }
      channels.iframe.note = frames.length ? `扫描 ${frames.length} 个 iframe 未命中` : '无 iframe'
    } catch (e: any) {
      channels.iframe.note = `iframe 通道异常: ${e?.message?.slice(0, 60)}`
    }

    try {
      // D. 截图 fallback：视口截图 → 中央裁剪 → jsQR 解码验证
      channels.screenshot.scanned = true
      const shot = await page.screenshot({ type: 'png' })
      const { buf, w, h } = await this.cropCenter(shot)
      const code = await this.decodeQr(buf, w, h)
      if (code) {
        channels.screenshot.found = true
        channels.screenshot.note = '截图中央区域 jsQR 解码命中'
        const b64 = await this.enlarge(buf, w, h)
        if (b64) return this.ok('screenshot', b64, { x: 0, y: 0, w, h }, channels)
        return this.ok('screenshot', buf.toString('base64'), { x: 0, y: 0, w, h }, channels)
      }
      channels.screenshot.note = '截图中央无 QR 编码'
    } catch (e: any) {
      channels.screenshot.note = `截图通道异常: ${e?.message?.slice(0, 60)}`
    }

    // 全部通道失败：检查是否短信登录面（如实报告 loginMethod，不猜二维码）
    let smsSurface = false
    try {
      const t = await this.pageTextSample(page)
      smsSurface = /发送验证码|短信登录|手机号登录|验证码登录|手机验证码|收不到验证码/.test(t)
    } catch {}
    return { loginMethod: smsSurface ? 'sms' : 'unknown', source: 'none', channels }
  }

  /** 提取页面文本摘要（Login Debug Panel） */
  async pageTextSample(page: Page): Promise<string> {
    return (await page.evaluate(TEXT_SAMPLE_FN).catch(() => '')) as string
  }

  private ok(source: QrDetectionResult['source'], qrCode: string, detail: QrHit, channels: QrDetectionResult['channels']): QrDetectionResult {
    return { loginMethod: 'qr', qrCode, source, detail, channels }
  }

  /** jsQR 解码验证 base64 是否真二维码（禁止假设二维码存在） */
  private async b64IsQr(b64: string): Promise<boolean> {
    try {
      const buf = Buffer.from(b64, 'base64')
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height)
      return !!code
    } catch {
      return false
    }
  }

  /** 图 → base64：data:image 直接取；https URL 从所在 frame fetch 转 base64；随后放大+白边 */
  private async imgToBase64(page: Page, hit: QrHit, frame?: Frame): Promise<string | undefined> {
    try {
      const src = hit.src || ''
      let b64: string | undefined
      const mimeMatch = src.match(/^data:image\/(png|jpeg|jpg|webp);base64,/)
      if (mimeMatch) {
        b64 = src.slice(mimeMatch[0].length)
      } else if (/^https?:\/\//.test(src)) {
        const f = frame || page.mainFrame()
        const fetched = await f.evaluate(async (s: string) => {
          try {
            const resp = await fetch(s, { credentials: 'include' })
            if (!resp.ok) return null
            const buf = await resp.arrayBuffer()
            const bytes = new Uint8Array(buf)
            let bin = ''
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
            return btoa(bin)
          } catch { return null }
        }, src).catch(() => null)
        if (!fetched) return undefined
        b64 = fetched
      }
      if (!b64) return undefined
      const raw = Buffer.from(b64, 'base64')
      if (raw.length < 300) return undefined
      const out = await this.enlarge(raw, hit.w || 0, hit.h || 0).catch(() => undefined)
      return out || b64
    } catch {
      return undefined
    }
  }

  /** 放大 + 白边（复用抖音成功率最高的处理：1024 + 65px 白边） */
  private async enlarge(buf: Buffer, w: number, h: number): Promise<string> {
    const img = sharp(buf)
    const meta = await img.metadata().catch(() => null)
    const iw = meta?.width || w || 300
    const ih = meta?.height || h || 300
    if (iw < 30 || ih < 30) throw new Error('too small')
    const big = await sharp(buf).resize(1024, 1024, { fit: 'inside' }).png().toBuffer()
    const bigMeta = await sharp(big).metadata()
    const bw = bigMeta.width || 1024
    const bh = bigMeta.height || 1024
    const pad = 65
    const out = await sharp({
      create: {
        width: bw + pad * 2,
        height: bh + pad * 2,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: big, left: pad, top: pad }])
      .png()
      .toBuffer()
    return out.toString('base64')
  }

  /** 视口截图 → 中央 60% 裁剪 → RGBA raw */
  private async cropCenter(shot: Buffer): Promise<{ buf: Buffer; w: number; h: number }> {
    const meta = await sharp(shot).metadata()
    const W = meta.width || 1280
    const H = meta.height || 800
    const cw = Math.round(W * 0.6)
    const ch = Math.round(H * 0.6)
    const left = Math.round((W - cw) / 2)
    const top = Math.round((H - ch) / 2)
    const { data, info } = await sharp(shot)
      .extract({ left, top, width: cw, height: ch })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    return { buf: data, w: info.width, h: info.height }
  }

  /** jsQR 解码 */
  private async decodeQr(raw: Buffer, w: number, h: number): Promise<boolean> {
    try {
      const code = jsQR(new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength), w, h)
      return !!code
    } catch {
      return false
    }
  }
}

export const loginDetector = new BrowserLoginDetector()
