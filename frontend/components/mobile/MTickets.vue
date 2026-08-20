<template>
  <MPageShell title="银票" @close="$emit('close')">
    <!-- 顶部 tab：我的银票 / 扫码核销 / 商家订单 -->
    <div class="mt-tabs">
      <button v-for="t in tabs" :key="t.k" class="mt-tab" :class="{ on: tab === t.k }" @click="tab = t.k">{{ t.name }}</button>
    </div>

    <!-- ① 我的银票卡包 -->
    <section v-if="tab === 'mine'">
      <div class="mt-sec">我的银票（{{ bought.length }}）</div>
      <div v-if="!bought.length" class="mt-empty">还没有银票 · 去城市商家用工分兑换商品可得银票核销券</div>
      <div v-for="o in bought" :key="o.id" class="mt-ticket" :class="{ done: o.status === 'redeemed' }">
        <div class="mt-ticket-head">
          <span class="mt-ticket-name">🎫 {{ o.product_name || '易货银票' }}</span>
          <span class="mt-ticket-status" :class="{ ok: o.status === 'revealed' || o.status === 'redeemed' }">
            {{ o.status === 'redeemed' ? '✅ 已核销' : '🟢 待核销' }}
          </span>
        </div>
        <div class="mt-ticket-mid">
          <div class="mt-ticket-code">{{ o.code }}</div>
          <div class="mt-ticket-amt">{{ o.amount }} 工分</div>
        </div>
        <div class="mt-ticket-foot">
          <!-- 二维码(待核销) -->
          <img v-if="o.status === 'earned' && o.qr" :src="o.qr" class="mt-ticket-qr" alt="银票二维码" />
          <div v-else class="mt-ticket-noqr"></div>
          <div class="mt-ticket-time">下单 {{ (o.created_at ? fmtTs(o.created_at) : '') }}</div>
        </div>
      </div>
    </section>

    <!-- ② 扫码核销（商家扫买家银票） -->
    <section v-if="tab === 'scan'">
      <div class="mt-sec">扫码核销银票</div>
      <p class="mt-tip">商家扫描顾客银票二维码，或直接输入核销码，确认收货后工分按 2%代理商 + 3%推荐人 + 95%商家 自动分润。</p>
      <button class="mt-btn primary" @click="startScan">{{ scanning ? '扫码中…' : '📷 开启扫码' }}</button>
      <div v-if="scanning" class="mt-scanner">
        <video ref="scanVideo" class="mt-video" playsinline muted></video>
        <div class="mt-scan-hint">对准银票二维码</div>
      </div>
      <div class="mt-sec" style="margin-top:14px">或输入核销码</div>
      <div class="mt-code-row">
        <input v-model="redeemCode" class="mt-input" maxlength="8" placeholder="8 位核销码" />
        <button class="mt-btn primary sm" :disabled="redeeming" @click="doRedeem">{{ redeeming ? '处理中…' : '核销' }}</button>
      </div>
      <div v-if="scanOk" class="mt-scan-ok">✅ 核销成功，工分已分润</div>
    </section>

    <!-- ③ 商家订单管理 -->
    <section v-if="tab === 'sold'">
      <div v-if="!isSeller" class="mt-tip">你还没有城市商家身份。成为认证商家后，在此管理兑换订单与核销。</div>
      <div class="mt-sec">我的店铺订单（{{ sold.length }}）</div>
      <div v-if="!sold.length" class="mt-empty">暂无兑换订单</div>
      <div v-for="o in sold" :key="'s' + o.id" class="mt-order">
        <div class="mt-order-top">
          <span class="mt-order-name">{{ o.product_name || '商品' }}</span>
          <span class="mt-ticket-status" :class="{ ok: o.status === 'redeemed' }">{{ o.status === 'redeemed' ? '✅ 已核销' : '🟢 待核销' }}</span>
        </div>
        <div class="mt-order-mid">{{ o.amount }} 工分 · 核销码 {{ o.code }}</div>
        <button v-if="o.status === 'earned'" class="mt-btn primary sm" @click="doRedeemCode(o.code)">核销确认收货</button>
      </div>
    </section>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { mobileAuthFetch, mobileToast, mobileToken } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()

const tabs = [
  { k: 'mine', name: '我的银票' },
  { k: 'scan', name: '扫码核销' },
  { k: 'sold', name: '商家订单' },
]
const tab = ref('mine')

const bought = ref<any[]>([])
const sold = ref<any[]>([])
const isSeller = ref(false)

// 扫码
const scanning = ref(false)
const scanVideo = ref<any>(null)
const scanOk = ref(false)
const redeemCode = ref('')
const redeeming = ref(false)
let scanStream: MediaStream | null = null
let scanTimer: any = null

async function load() {
  try {
    const r = await mobileAuthFetch('/api/city/shop/orders')
    const j = await r.json()
    const d = j.data || j
    bought.value = d.bought || []
    sold.value = d.sold || []
    isSeller.value = (sold.value.length > 0) || false
    // 生成二维码
    for (const o of bought.value) {
      if (o.status === 'earned') {
        o.qr = await qrOf(o.code)
      }
    }
    if ((d.bought && d.bought.length) || (d.sold && d.sold.length)) { /* 加载成功 */ }
  } catch { /* ignore */ }
}

async function qrOf(code: string): Promise<string> {
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(code, { width: 160, margin: 1, errorCorrectionLevel: 'M' })
  } catch { return '' }
}

function fmtTs(ts: any): string {
  if (!ts) return ''
  const n = Number(ts)
  const d = n > 10000000000 ? new Date(n) : new Date(n * 1000)
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

// 扫码核销
async function startScan() {
  scanOk.value = false
  scanning.value = true
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (scanVideo.value) {
      scanVideo.value.srcObject = scanStream
      await scanVideo.value.play()
      pollScan()
    }
  } catch (e) {
    mobileToast('⚠ 无法开启相机，请使用核销码方式')
    scanning.value = false
  }
}
function pollScan() {
  const Detector: any = (window as any).BarcodeDetector
  if (!Detector) {
    mobileToast('本机不支持扫码，请用核销码')
    stopScan()
    return
  }
  const detector = new Detector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'datamatrix'] })
  scanTimer = setInterval(async () => {
    try {
      if (!scanVideo.value) return
      const codes = await detector.detect(scanVideo.value)
      if (codes && codes.length && codes[0].rawValue) {
        const raw = String(codes[0].rawValue).trim()
        stopScan()
        await doRedeemCode(raw)
      }
    } catch { /* 继续 */ }
  }, 400)
}
function stopScan() {
  scanning.value = false
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null }
  if (scanStream) { scanStream.getTracks().forEach((t: any) => t.stop()); scanStream = null }
}
async function doRedeem(rawCode: string) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!code) { mobileToast('请输入核销码'); return }
  redeeming.value = true
  try {
    const r = await mobileAuthFetch('/api/city/shop/order/redeem', { method: 'POST', body: JSON.stringify({ code }) })
    const j = await r.json()
    if (r.ok && j.success) { scanOk.value = true; redeemCode.value = ''; mobileToast('✅ 核销成功'); setTimeout(() => { scanOk.value = false }, 2000); load() }
    else mobileToast('❌ ' + (j.error || '核销失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { redeeming.value = false }
}
async function doRedeemCode(code: string) { await doRedeem(code) }

// 判断是否商家：通过 sold 列表非空（有城市商家店铺订单）或 /api/city/biz/me
async function loadBiz() {
  try {
    const r = await mobileAuthFetch('/api/city/biz/me?cityId=')
    const j = await r.json()
    if (j.success && j.data?.biz?.status === 'active') isSeller.value = true
  } catch { /* ignore */ }
}

onMounted(() => { load(); loadBiz() })
onBeforeUnmount(() => { stopScan() })
</script>

<style scoped>
.mt-tabs { display: flex; background: #fff; border-radius: 10px; padding: 4px; margin-bottom: 12px; gap: 4px; }
.mt-tab { flex: 1; padding: 8px 0; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-weight: 600; color: #666; }
.mt-tab.on { background: #6366f1; color: #fff; }
.mt-sec { font-size: 13px; font-weight: 700; color: #374151; margin: 12px 0 8px; }
.mt-empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 24px 0; }
.mt-tip { font-size: 12px; color: #6b7280; line-height: 1.6; margin-bottom: 10px; }
.mt-ticket { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #f59e0b; border-radius: 14px; padding: 14px; margin-bottom: 10px; position: relative; overflow: hidden; }
.mt-ticket.done { background: #f3f4f6; border-color: #d1d5db; opacity: .85; }
.mt-ticket-head { display: flex; justify-content: space-between; align-items: center; }
.mt-ticket-name { font-size: 15px; font-weight: 700; color: #92400e; }
.mt-ticket-status { font-size: 12px; padding: 2px 8px; border-radius: 8px; background: #fef3c7; color: #92400e; }
.mt-ticket-status.ok { background: #d1fae5; color: #059669; }
.mt-ticket-mid { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; }
.mt-ticket-code { font-size: 20px; font-weight: 800; letter-spacing: 3px; color: #111827; font-family: monospace; }
.mt-ticket-amt { font-size: 13px; color: #92400e; font-weight: 600; }
.mt-ticket-foot { display: flex; align-items: center; gap: 10px; }
.mt-ticket-qr { width: 88px; height: 88px; background: #fff; padding: 4px; border-radius: 8px; }
.mt-ticket-noqr { width: 88px; height: 88px; }
.mt-ticket-time { font-size: 11px; color: #b45309; }
.mt-btn { width: 100%; padding: 11px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 8px; }
.mt-btn.primary { background: linear-gradient(135deg, #38bdf8, #6366f1); color: #fff; }
.mt-btn.sm { width: auto; padding: 9px 16px; margin-top: 0; }
.mt-scanner { margin-top: 12px; background: #000; border-radius: 12px; overflow: hidden; position: relative; }
.mt-video { width: 100%; height: 240px; object-fit: cover; }
.mt-scan-hint { position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; color: #fff; font-size: 12px; }
.mt-code-row { display: flex; gap: 8px; margin-top: 8px; }
.mt-input { flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 16px; letter-spacing: 2px; font-family: monospace; }
.mt-scan-ok { margin-top: 12px; background: #d1fae5; color: #059669; padding: 10px; border-radius: 10px; text-align: center; font-weight: 600; }
.mt-order { background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
.mt-order-top { display: flex; justify-content: space-between; align-items: center; }
.mt-order-name { font-size: 15px; font-weight: 600; }
.mt-order-mid { font-size: 13px; color: #6b7280; margin: 6px 0; }
</style>
