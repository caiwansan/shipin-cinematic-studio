<template>
  <div class="mcomm">
    <!-- 四栏导航（微信朋友圈式） -->
    <div class="mcomm-tabs">
      <button v-for="t in tabs" :key="t.key" class="mcomm-tab" :class="{ on: activeTab === t.key }" @click="switchTab(t.key)">
        <span class="mcomm-tab-icon">{{ t.icon }}</span>
        <span>{{ t.label }}</span>
      </button>
    </div>

    <!-- 公共社区 / 朋友圈 共用发帖框 -->
    <!-- 发帖框（对齐电脑版公共社区：普通200字/VIP 5000 + AI + 表情 + 图片） -->
    <div v-if="activeTab === 'community' || activeTab === 'friends'" class="mcomm-composer">
      <div v-if="activeTab === 'friends'" class="mcomm-friend-tip">👥 好友世界 · 仅粉丝可见（自己和关注的人）</div>
      <textarea v-model="text" class="mcomm-ta" :placeholder="(activeTab === 'friends' ? '分享到好友世界（仅粉丝可见）…' : '分享到公共社区…') + (isVip ? '（VIP 可发长文）' : '（普通用户限 200 字）')" :maxlength="maxLen" rows="3"></textarea>
      <div class="mcomm-thumbs" v-if="imgs.length">
        <div v-for="(u, ix) in imgs" :key="ix" class="mcomm-thumb-wrap">
          <img :src="u" class="mcomm-thumb" />
          <span class="mcomm-thumb-del" @click="imgs.splice(ix, 1)">×</span>
        </div>
      </div>
      <input type="file" ref="fileInput" accept="image/*" multiple style="display:none" @change="onPickFiles" />
      <div class="mcomm-toolbar">
        <button class="mcomm-tool" @click="openAi">✨ AI</button>
        <button class="mcomm-tool" @click="toggleEmoji">😊</button>
        <button class="mcomm-tool" @click="($refs.fileInput as any)?.click()">📷 图片</button>
        <span class="mcomm-count">{{ text.length }}/{{ maxLen }}</span>
        <button class="mcomm-pub" :disabled="posting" @click="publish">{{ posting ? '发布中…' : (activeTab === 'friends' ? '发动态' : '发布') }}</button>
      </div>
    </div>

    <!-- 表情面板 -->
    <div v-if="emojiOpen" class="mcomm-emoji" @click.self="emojiOpen = false">
      <span v-for="ch in EMOJIS" :key="ch" class="mcomm-emoji-cell" @click="insertEmoji(ch)">{{ ch }}</span>
    </div>

    <!-- 帖子流（公共社区 / 朋友圈） -->
    <div v-if="activeTab === 'community' || activeTab === 'friends'" class="mcomm-feed">
      <div v-if="!posts.length && !loading" class="mcomm-empty">{{ loading ? '加载中…' : (activeTab === 'friends' ? '还没有好友动态，关注好友后可见他们的动态' : '还没有帖子，来发布第一条吧') }}</div>
      <div v-for="p in posts" :key="p.id" class="mcomm-post" @click="openDetail(p)">
        <div class="mcomm-post-top">
          <div class="mcomm-avatar">{{ (p.nickname || '?').slice(0, 1) }}</div>
          <div class="mcomm-info">
            <div class="mcomm-name">{{ p.nickname || p.uid }}<span v-if="activeTab === 'friends'" class="mcomm-tag">已关注</span></div>
            <div class="mcomm-time">{{ fmtTs(p.created_at) }}</div>
          </div>
          <button v-if="p.mine" class="mcomm-del" @click.stop="delPost(p)">🗑</button>
          <button v-else-if="isAdmin" class="mcomm-del" @click.stop="adminDel(p)">🗑 删</button>
        </div>
        <div class="mcomm-content" :class="{ clamp: !p._expanded }">{{ p.content }}</div>
        <div v-if="p.sigOk === true || p.sigOk === false || p.fingerprint" class="mcomm-sigrow">
          <span v-if="p.sigOk === true" class="mcomm-sig ok" title="身份密钥签名验证通过">🔏 签名有效</span>
          <span v-else-if="p.sigOk === false" class="mcomm-sig bad" title="内容与签名不匹配，可能被篡改">⚠️ 被篡改</span>
          <span v-if="p.fingerprint" class="mcomm-sig key" @click="copyFp(p.fingerprint)" title="内容签名专属密钥 · 点击复制">🔑 {{ p.fingerprint }}</span>
        </div>
        <button v-if="p.content && p.content.length > 80" class="mcomm-expand" @click.stop="p._expanded = !p._expanded">{{ p._expanded ? '收起' : '展开' }}</button>
        <div class="mcomm-imgs" v-if="p.images && p.images.length">
          <img v-for="(u, ix) in p.images" :key="ix" :src="u" class="mcomm-img" @click.stop="preview(u)" @error="hideImg" />
        </div>
        <div class="mcomm-actions">
          <button class="mcomm-act" :class="{ liked: p.liked }" @click.stop="likePost(p)">{{ p.liked ? '❤️' : '🤍' }} {{ p.likes || 0 }}</button>
          <button class="mcomm-act" @click.stop="openDetail(p)">💬 {{ p.comments || 0 }}</button>
          <button class="mcomm-act" @click.stop="openTip(p)">💎 {{ p.tips || 0 }}</button>
          <button v-if="p.mine" class="mcomm-act" @click.stop="delPost(p)">🗑</button>
        </div>
      </div>
    </div>

    <!-- AI 弹窗 -->
    <div v-if="aiOpen" class="mcomm-mask">
      <div class="mcomm-modal">
        <div class="mcomm-modal-title">✨ AI 创作</div>
        <div class="mcomm-ai-tabs">
          <button :class="['mcomm-ai-tab', { on: aiMode === 'create' }]" @click="aiMode = 'create'; aiPrompt = ''">✍️ 创作</button>
          <button :class="['mcomm-ai-tab', { on: aiMode === 'polish' }]" @click="aiMode = 'polish'; aiPrompt = text">🪄 润色</button>
        </div>
        <textarea v-model="aiPrompt" class="mcomm-ai-ta" placeholder="输入想法，让 AI 写文案…"></textarea>
        <div v-if="aiResult" class="mcomm-ai-result">{{ aiResult }}</div>
        <div class="mcomm-modal-btns">
          <button class="mcomm-btn ghost" @click="aiOpen = false">关闭</button>
          <button class="mcomm-btn primary" :disabled="aiBusy" @click="genAi">⚡ 生成</button>
          <button class="mcomm-btn primary" :disabled="!aiResult" @click="useAi">📥 填入</button>
        </div>
      </div>
    </div>

    <!-- 帖子详情弹窗（完整内容，可滚动下拉） -->
    <div v-if="postDetailOn" class="mcomm-mask">
      <div class="mcomm-modal mcomm-detail">
        <div class="mcomm-detail-head">
          <div class="mcomm-avatar big">{{ (postDetailOn.nickname || '?').slice(0, 1) }}</div>
          <div class="mcomm-info">
            <div class="mcomm-name">{{ postDetailOn.nickname || postDetailOn.uid }}</div>
            <div class="mcomm-time">{{ fmtTs(postDetailOn.created_at) }}</div>
          </div>
          <button v-if="postDetailOn.mine" class="mcomm-del" @click="delDetail">🗑</button>
          <button v-else-if="isAdmin" class="mcomm-del" @click="adminDelDetail">🗑 删</button>
        </div>
        <div class="mcomm-detail-body">{{ postDetailOn.content }}</div>
        <div v-if="postDetailOn.sigOk === true || postDetailOn.sigOk === false || postDetailOn.fingerprint" class="mcomm-sigrow">
          <span v-if="postDetailOn.sigOk === true" class="mcomm-sig ok">🔏 签名有效</span>
          <span v-else-if="postDetailOn.sigOk === false" class="mcomm-sig bad">⚠️ 内容被篡改</span>
          <span v-if="postDetailOn.fingerprint" class="mcomm-sig key" @click="copyFp(postDetailOn.fingerprint)">🔑 {{ postDetailOn.fingerprint }}</span>
        </div>
        <div class="mcomm-detail-imgs" v-if="postDetailOn.images && postDetailOn.images.length">
          <img v-for="(u, ix) in postDetailOn.images" :key="ix" :src="absCover(u)" class="mcomm-detail-img" @click="preview(u)" @error="hideImg" />
        </div>
        <div class="mcomm-actions">
          <button class="mcomm-act" :class="{ liked: postDetailOn.liked }" @click="likeDetail">{{ postDetailOn.liked ? '❤️' : '🤍' }} {{ postDetailOn.likes || 0 }}</button>
          <button class="mcomm-act" @click="openTipInDetail">💎 打赏</button>
        </div>
        <div class="mcomm-detail-cmt-title">💬 评论（{{ postDetailOn.comments || 0 }}）</div>
        <div class="mcomm-cmt-list" v-if="postDetailOn.commentsArr && postDetailOn.commentsArr.length">
          <div v-for="(cm, i) in postDetailOn.commentsArr" :key="i" class="mcomm-cmt"><span class="mcomm-cmt-auth">{{ cm.nickname || cm.uid }}</span>：{{ cm.text || cm.content }}</div>
        </div>
        <div v-if="!postDetailOn.commentsArr || !postDetailOn.commentsArr.length" class="mcomm-empty-sm">还没有评论，来抢沙发～</div>
        <textarea v-model="detailCmt" class="mcomm-ai-ta" placeholder="写下评论…"></textarea>
        <div class="mcomm-modal-btns">
          <button class="mcomm-btn ghost" @click="postDetailOn = null">关闭</button>
          <button class="mcomm-btn primary" :disabled="detailSending || !detailCmt.trim()" @click="sendDetailCmt">发送</button>
        </div>
      </div>
    </div>

    <!-- 评论弹窗 -->
    <div v-if="commentOn" class="mcomm-mask">
      <div class="mcomm-modal mcomm-scroll">
        <div class="mcomm-modal-title">💬 评论</div>
        <div class="mcomm-cmt-list" v-if="commentOn.commentsArr && commentOn.commentsArr.length">
          <div v-for="(cm, i) in commentOn.commentsArr" :key="i" class="mcomm-cmt"><span class="mcomm-cmt-auth">{{ cm.nickname || cm.uid }}</span>：{{ cm.text || cm.content }}</div>
        </div>
        <textarea v-model="cmtText" class="mcomm-ai-ta" placeholder="写下评论…"></textarea>
        <div class="mcomm-modal-btns">
          <button class="mcomm-btn ghost" @click="commentOn = null">关闭</button>
          <button class="mcomm-btn primary" :disabled="cmtSending" @click="sendCmt">发送</button>
        </div>
      </div>
    </div>

    <!-- 打赏弹窗 -->
    <div v-if="tipOn" class="mcomm-mask">
      <div class="mcomm-modal">
        <div class="mcomm-modal-title">💎 钻石打赏</div>
        <p class="mcomm-hint">选择打赏钻石数量（从你的钻石中扣除）</p>
        <div class="mcomm-tip-opts">
          <button v-for="n in [1, 5, 10, 20]" :key="n" class="mcomm-tip-opt" :class="{ on: tipAmt === n }" @click="tipAmt = n">💎 {{ n }}</button>
        </div>
        <button class="mcomm-btn primary" :disabled="tipSending" @click="sendTip">打赏</button>
        <button class="mcomm-btn ghost" @click="tipOn = null" style="margin-top:8px">关闭</button>
      </div>
    </div>

    <!-- 图片预览 -->
    <div v-if="previewImgUrl" class="mcomm-mask" @click.self="previewImgUrl = ''">
      <img :src="previewImgUrl" class="mcomm-preview" />
      <button class="mcomm-btn ghost" style="position:fixed;bottom:30px;left:50%;transform:translateX(-50%);width:200px" @click="previewImgUrl = ''">关闭</button>
    </div>

    <!-- 行业热点（AI 抓取）-->
    <div v-if="activeTab === 'hot'" class="mcomm-hot">
      <div class="mcomm-hot-hero">
        <div class="mcomm-hot-title">🔥 行业热点</div>
        <div class="mcomm-hot-sub">权威媒体新闻 + AI 热点简报</div>
      </div>
      <div class="mcomm-hot-pick">
        <button v-for="x in hotIndustries" :key="x" class="mcomm-hot-chip" :class="{ on: hotInd === x }" @click="switchHot(x)">{{ x }}</button>
      </div>
      <div class="mcomm-hot-toolrow">
        <span class="mcomm-hot-status">{{ hotLoading ? '加载中…' : hotNote }}</span>
        <button class="mcomm-hot-fetch" :disabled="hotFetching || hotLoading" @click="fetchHot">⚡ 获取热点</button>
      </div>
      <div v-if="hotHistory.length" class="mcomm-hot-histbar">
        <span class="mcomm-hot-hist-lbl">🕘 已抓取历史</span>
        <span class="mcomm-hot-hist-tag" :class="{ on: h.active }" v-for="h in hotHistory" :key="h.id" @click="pickHistory(h.id)">
          {{ h.industry.split('/')[0] }} {{ h.day.slice(5) }}{{ h.headline ? (':' + h.headline.slice(0, 8)) : '' }}
        </span>
      </div>
      <div v-if="hotBrief" class="mcomm-hot-brief">
        <div v-if="hotBrief.headline" class="mcomm-hot-brief-head">📌 {{ hotBrief.headline }}</div>
        <div v-if="hotBrief.summary" class="mcomm-hot-brief-sum">{{ hotBrief.summary }}</div>
        <div v-if="hotBrief.highlights && hotBrief.highlights.length" class="mcomm-hot-brief-sec"><div class="mcomm-hot-brief-sec-t">🔥 要点</div><div v-for="(h,i) in hotBrief.highlights" :key="'h'+i" class="mcomm-hot-brief-li">• {{ h }}</div></div>
        <div v-if="hotBrief.trends && hotBrief.trends.length" class="mcomm-hot-brief-sec"><div class="mcomm-hot-brief-sec-t">📈 趋势</div><div v-for="(t,i) in hotBrief.trends" :key="'t'+i" class="mcomm-hot-brief-li">• {{ t }}</div></div>
        <div v-if="hotBrief.risks && hotBrief.risks.length" class="mcomm-hot-brief-sec"><div class="mcomm-hot-brief-sec-t">⚠️ 风险</div><div v-for="(x,i) in hotBrief.risks" :key="'r'+i" class="mcomm-hot-brief-li">• {{ x }}</div></div>
        <div v-if="hotBrief.opportunities && hotBrief.opportunities.length" class="mcomm-hot-brief-sec"><div class="mcomm-hot-brief-sec-t">💡 机会</div><div v-for="(o,i) in hotBrief.opportunities" :key="'o'+i" class="mcomm-hot-brief-li">• {{ o }}</div></div>
      </div>
      <div v-if="!hotNews.length && !hotLoading" class="mcomm-hot-empty">{{ hotNote || '暂无热点，点「⚡ 获取热点」抓取当日新闻' }}</div>
      <div class="mcomm-hot-list">
        <a v-for="(n,i) in hotNews" :key="i" class="mcomm-hot-item" :href="n.url" target="_blank" rel="noopener">
          <div class="mcomm-hot-item-top"><span class="mcomm-hot-src">{{ n.source || '媒体' }}</span><span class="mcomm-hot-time">{{ n.fmt }}</span></div>
          <div class="mcomm-hot-title2">{{ n.title }}</div>
        </a>
      </div>
    </div>

    <!-- 商家（城市空间入驻商家）-->
    <div v-if="activeTab === 'shop'" class="mcomm-shop">
      <div class="mcomm-shop-title">🏪 入驻商家 <span class="mcomm-shop-count">{{ shops.length }} 家</span></div>
      <div v-if="!shops.length" class="mcomm-empty">暂无入驻商家</div>
      <div v-for="s in shops" :key="s.id" class="mcomm-shop-card" @click="openShop(s)">
        <div class="mcomm-shop-avatar">{{ (s.shopName || '?').slice(0, 1) }}</div>
        <div class="mcomm-shop-info">
          <div class="mcomm-shop-name">{{ s.shopName }}<span v-if="s.heat" class="mcomm-shop-heat">🔥 {{ s.heat }}</span></div>
          <div class="mcomm-shop-meta">{{ s.address || '暂无地址' }} · {{ s.productCount || 0 }} 件商品</div>
        </div>
        <span class="mcomm-shop-arrow">›</span>
      </div>
    </div>

    <!-- 店铺详情弹窗 -->
    <div v-if="shopDetail" class="mcomm-mask">
      <div class="mcomm-modal mcomm-shop-detail">
        <div v-if="shopDetail.shop.banner" class="mcomm-shop-detail-banner-wrap">
          <img :src="absCover(shopDetail.shop.banner)" class="mcomm-shop-detail-banner" @error="hideImg" />
        </div>
        <div class="mcomm-shop-detail-head">
          <div class="mcomm-avatar big">{{ (shopDetail.shop.shopName || '?').slice(0, 1) }}</div>
          <div class="mcomm-info">
            <div class="mcomm-name">{{ shopDetail.shop.shopName }}</div>
            <div class="mcomm-time">{{ shopDetail.shop.cityName }}{{ shopDetail.shop.address ? ' · ' + shopDetail.shop.address : '' }}</div>
          </div>
          <div class="mcomm-shop-detail-owner">👤 {{ shopDetail.shop.ownerName }}</div>
        </div>
        <div class="mcomm-shop-detail-stats">
          <span class="mcomm-shop-stat">🔥 {{ shopDetail.shop.heat }}</span>
          <span class="mcomm-shop-stat good">👍 {{ shopDetail.shop.good }}</span>
          <span class="mcomm-shop-stat bad">👎 {{ shopDetail.shop.bad }}</span>
        </div>
        <div v-if="shopDetail.shop.bizDesc" class="mcomm-shop-detail-desc">{{ shopDetail.shop.bizDesc }}</div>
        <div class="mcomm-shop-detail-prod-title">🛍 商品（{{ shopDetail.products.length }}）</div>
        <div v-if="!shopDetail.products.length" class="mcomm-empty-sm">该店铺暂无商品</div>
        <div class="mcomm-shop-detail-prods">
          <div v-for="pd in shopDetail.products" :key="pd.id" class="mcomm-shop-prod">
            <img v-if="pd.cover" :src="absCover(pd.cover)" class="mcomm-shop-prod-cover" @error="hideImg" />
            <div v-else class="mcomm-shop-prod-cover empty">{{ (pd.name || '?').slice(0, 1) }}</div>
            <div class="mcomm-shop-prod-info">
              <div class="mcomm-shop-prod-name">{{ pd.name }}</div>
              <div v-if="pd.prodDesc" class="mcomm-shop-prod-desc">{{ pd.prodDesc }}</div>
              <div class="mcomm-shop-prod-meta">
                <span class="mcomm-shop-prod-price">💴 {{ pd.priceTea || 0 }}</span>
                <span class="mcomm-shop-prod-stock">库存 {{ pd.stock || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="mcomm-modal-btns">
          <button class="mcomm-btn ghost" @click="shopDetail = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast, mobileToken } from '~/composables/useMobileApi'

const EMOJIS = '😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰😗😙😚🙂🤗🤩🤔🤨😐😑😶🙄😏😣😥😮🤐😯😪😫😴😌😛😜😝🤤😒😓😔😕🙃🤑😲☹️🙁😖😞😟😤😢😭😦😧😨😩🤯😬😰😱🥵🥶😳🤪😵😡😠🤬😷🤒🤕🤢🤮🥴😇🥳🥺🤠🤡🤥🤫🤭🧐🤓😈👿👹👺💀👻👽🤖💩😺😸😹😻😼😽🙀😿😾👋🤚🖐✋🖖👌🤌🤏✌🤞🤟🤘🤙👈👉👆👇☝✊👊👏🙌👐🤲🤝🙏✍💅🤳💪❤🧡💛💚💙💜🖤🤍🤎💔❣💕💞💓💗💖💘💝💟♥💯💢💥💫💦💨💬🗨💭💤🎉🎊🎈🎁🏆🥇🥈🥉🏅🎖🎫🎪🎭🎨🎬🎤🎧🎼🎹🎺🎸🎻🎲🎯🎳🎮🎰🧩🚀🛸✈️🚁⛵🚤🛳🚢🗺🗿⛱🏖🏝🏔⛰🌋🗻🏕🏠🏡🏢🏣🏤🏥🏦🏨🏩🏪🏫🏬🏭🏯🏰💒🗼🗽🏟🎡🎢🎠⛲🎑🌅🌄🌠🎇🎆🌇🌆🏙🌃🌌🌉🌁🌈☀️⛅🌦️🌧️⛈️🌩️🌨️❄️☃️⛄🌊💧☔️🍏🍎🍐🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥥🥝🍅🥑🍆🥔🥕🌽🌶️🥒🥬🥦🧄🧅🍄🥜🌰🍞🥐🥖🥨🥯🥞🧇🧀🥚🍳🥩🥓🍔🍟🍕🥪🌮🌯🥗🥘🥫🍝🍜🍲🍛🍣🍱🥟🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪☕️🍵🍶🍾🍷🍸🍹🍺🍻🥂🥃🥤🧃🏀⚽️🏈⚾️🎾🏐🏉🎱🏓🏸🏒🏑🥍🏏🎿🛷🥌⛸️🎣🏹🛹🛴🚴🚵🏇🧗⛷️🏂🏌️🏄🏊🏋️🤸🤺🤾🧘🛀🛌🏃🚶'

const text = ref('')
const isVip = ref(false)
const maxLen = computed(() => (isVip.value ? 5000 : 200))
// VIP 判定：与电脑版同步（Membership.tier 真源；非 free/basic 皆视为 VIP 权益）
function applyTier(d: any) {
  const tier = d?.memberTier || d?.membership?.tier || ''
  isVip.value = !!tier && !['free', 'basic'].includes(String(tier))
}
const activeTab = ref<'community' | 'friends' | 'hot' | 'shop'>('community')
const tabs = [
  { key: 'community', label: '公共社区', icon: '🌍' },
  { key: 'friends', label: '朋友圈', icon: '👥' },
  { key: 'hot', label: '行业热点', icon: '🔥' },
  { key: 'shop', label: '商家', icon: '🏪' },
]
const scopeNow = computed(() => (activeTab.value === 'friends' ? 'friend' : 'public'))
const shops = ref<any[]>([])
const shopDetail = ref<any>(null)
const shopLoading = ref(false)
const hotOn = ref(false)
const hotIndustries = ref<string[]>([])
const hotInd = ref('人工智能/科技')
const hotNews = ref<any[]>([])
const hotBrief = ref<any>(null)
const hotHistory = ref<any[]>([])
const hotLoading = ref(false)
const hotFetching = ref(false)
const hotNote = ref('')

// ═══ 身份签名（与桌面/身份密钥体系一致：ECDSA P-256 助记词派生私钥）═══
function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)))
  return btoa(bin)
}
function b64ToBuf(b64: string): Uint8Array {
  if (!b64) throw new Error('托管私钥为空')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) b64 = b64.replace(/\s/g, '')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function concatUint8(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0); out.set(b, a.length)
  return out
}
function pemToDer(pemBytes: Uint8Array): ArrayBuffer {
  let s = new TextDecoder().decode(pemBytes)
  s = s.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '')
  return b64ToBuf(s).buffer as ArrayBuffer
}
function idMnemonicKey(mnemonic: string): Promise<Uint8Array> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(mnemonic).trim().toLowerCase())).then(d => new Uint8Array(d))
}
function derInt(b: Uint8Array): number[] {
  let i = 0; while (i < b.length && b[i] === 0) i++
  let int = Array.from(b.slice(i)); if (int.length === 0) int = [0]
  if (int[0] & 0x80) int = [0, ...int]
  const L = int.length; let hdr: number[]
  if (L < 128) hdr = [L]
  else { const hb: number[] = []; let l = L; while (l > 0) { hb.unshift(l & 0xff); l >>= 8 } hdr = [0x80 | hb.length, ...hb] }
  return [0x02, ...hdr, ...int]
}
function ecdsaSigToB64(sigBytes: Uint8Array): string {
  if (sigBytes.length === 64) {
    const r = sigBytes.slice(0, 32), s = sigBytes.slice(32)
    const body = [...derInt(r), ...derInt(s)]
    const BL = body.length; let bhdr: number[]
    if (BL < 128) bhdr = [BL]
    else { const hb: number[] = []; let l = BL; while (l > 0) { hb.unshift(l & 0xff); l >>= 8 } bhdr = [0x80 | hb.length, ...hb] }
    return bufToB64(new Uint8Array([0x30, ...bhdr, ...body]))
  }
  return bufToB64(sigBytes)
}
async function ecdsaSignText(privPkcs8: ArrayBuffer, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', privPkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(text))
  return ecdsaSigToB64(new Uint8Array(sig))
}
// 用助记词派生私钥对文本签名（与手机身份验证同一套）
async function signTextWithMnemonic(mnemonic: string, text: string): Promise<string> {
  const r = await mobileAuthFetch('/api/auth/identity/key')
  const j = await r.json()
  if (!j.success || !j.data?.encKey) throw new Error('未找到托管私钥，请先创建身份密钥')
  const encKeyStr = String(j.data.encKey)
  const aesRaw = await crypto.subtle.importKey('raw', await idMnemonicKey(mnemonic), 'AES-GCM', false, ['decrypt'])
  let pkcs8: ArrayBuffer
  if (encKeyStr.trim().startsWith('{')) {
    const obj = JSON.parse(encKeyStr)
    const iv = b64ToBuf(obj.iv); const tag = b64ToBuf(obj.tag); const data = b64ToBuf(obj.data)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesRaw, concatUint8(data, tag))
    pkcs8 = pemToDer(pt as Uint8Array)
  } else {
    const raw = b64ToBuf(encKeyStr); const iv = raw.slice(0, 12); const ct = raw.slice(12)
    pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesRaw, ct)
  }
  return ecdsaSignText(pkcs8, text)
}
// 取当前身份公钥(PEM) —— /api/auth/identity/info 返回 pubKey
async function fetchMyPubKey(): Promise<string> {
  try {
    const r = await mobileAuthFetch('/api/auth/identity/info')
    const j = await r.json()
    return j.data?.pubKey || ''
  } catch { return '' }
}
function myMnemonic(): string {
  try { return (window.localStorage?.getItem('kunlun_idme') || '').trim() } catch { return '' }
}

const imgs = ref<string[]>([])
const emojiOpen = ref(false)
const posting = ref(false)
const posts = ref<any[]>([])
const loading = ref(false)
const isAdmin = ref(false)

// AI
const aiOpen = ref(false)
const aiMode = ref('create')
const aiPrompt = ref('')
const aiResult = ref('')
const aiBusy = ref(false)

// 评论/打赏
const commentOn = ref<any>(null)
const cmtText = ref('')
const cmtSending = ref(false)
const postDetailOn = ref<any>(null)
const detailCmt = ref('')
const detailSending = ref(false)
const tipOn = ref<any>(null)
const tipAmt = ref(5)
const tipSending = ref(false)
const previewImgUrl = ref('')

async function loadMe() {
  try {
    const r = await mobileAuthFetch('/api/auth/me')
    const j = await r.json(); const d = j.data || j
    // ⭐ auth/me 返回结构: data.user.memberTier / data.user.membership.tier（不能只读顶层）
    const tier = d?.user?.memberTier || d?.user?.membership?.tier || d?.memberTier || d?.membership?.tier || ''
    isVip.value = !!tier && !['free', 'basic'].includes(String(tier))
  } catch { isVip.value = false }
}
async function load() {
  loading.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/posts?scope=' + scopeNow.value + '&limit=50')
    const j = await r.json(); const d = j.data || j
    posts.value = (d.posts || []).map((p: any) => ({ ...p, _expanded: false, mine: p.uid === myUid(), commentsArr: p.commentsArr || [] }))
    isAdmin.value = !!d.isAdmin
  } catch { posts.value = [] } finally { loading.value = false }
}
async function loadShops(force: boolean = false) {
  try {
    const r = await mobileAuthFetch('/api/city/biz/shops/all' + (force ? '?refresh=1' : ''), { method: 'GET' })
    const j = await r.json()
    const d = j.data || j
    shops.value = (Array.isArray(d) ? d : d.shops) || []
  } catch { shops.value = [] }
}
function switchTab(k: string) {
  activeTab.value = k as any
  if (k === 'community' || k === 'friends') { posts.value = []; load() }
  else if (k === 'shop') { shops.value = []; loadShops() }
  else if (k === 'hot') { hotOn.value = true; if (!hotIndustries.value.length) loadHot() }
}
function openShop(s: any) {
  shopLoading.value = true
  openDetailFetch(s.id)
}
async function openDetailFetch(id: any) {
  shopLoading.value = true
  try {
    const r = await mobileAuthFetch('/api/city/biz/shop/' + id + '/public', { method: 'GET' })
    const j = await r.json()
    if (r.ok && j.success) { shopDetail.value = j.data; shopLoading.value = false }
    else { mobileToast('❌ ' + (j.error || '店铺加载失败')); shopLoading.value = false }
  } catch { mobileToast('⚠ 网络错误'); shopLoading.value = false }
}
async function loadHot() {
  hotLoading.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/news?industry=' + encodeURIComponent(hotInd.value))
    const j = await r.json(); const d = j.data || j
    if (d.industries?.length) hotIndustries.value = d.industries
    hotNews.value = (d.news || []).map((n: any) => ({ ...n, fmt: fmtTs(n.published_at / 1000 || Date.now() / 1000) }))
    hotBrief.value = d.brief || null
    hotHistory.value = (d.history || [])
  } catch { hotNews.value = [] } finally { hotLoading.value = false }
}
async function switchHot(ind: string) { hotInd.value = ind; hotNews.value = []; hotBrief.value = null; hotHistory.value = []; loadHot() }
async function pickHistory(id: any) {
  hotLoading.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/news?historyId=' + id)
    const j = await r.json(); const d = j.data || j
    hotNews.value = (d.news || []).map((n: any) => ({ ...n, fmt: fmtTs(n.published_at / 1000 || Date.now() / 1000) }))
    hotBrief.value = d.brief || null
    hotHistory.value = (d.history || [])
  } catch { } finally { hotLoading.value = false }
}
async function fetchHot() {
  if (hotFetching.value) return
  hotFetching.value = true; hotNote.value = '采集中，请稍候…'
  try {
    const r = await mobileAuthFetch('/api/tea/news/fetch', { method: 'POST', body: JSON.stringify({ industry: hotInd.value }) })
    const j = await r.json(); const d = j.data || j
    hotNote.value = '✅ 已更新 ' + (d.news?.length || 0) + ' 条' + (d.brief ? '，AI简报已生成' : (d.briefNote ? '（' + d.briefNote + '）' : ''))
    hotNews.value = (d.news || []).map((n: any) => ({ ...n, fmt: fmtTs(n.published_at / 1000 || Date.now() / 1000) }))
    hotBrief.value = d.brief || null
    setTimeout(() => { hotNote.value = '' }, 4000)
    loadHot()
  } catch { hotNote.value = '⚠ 采集失败' } finally { hotFetching.value = false }
}
function myUid(): string {
  try { const u = JSON.parse(window.localStorage?.getItem('auth_user') || '{}'); return u.id || u.uid || '' } catch { return '' }
}

// 发帖
function toggleEmoji() { emojiOpen.value = !emojiOpen.value }
function insertEmoji(ch: string) {
  text.value += ch
  emojiOpen.value = false
}
async function onPickFiles(e: any) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  for (const f of files) {
    if (imgs.value.length >= 9) break
    try {
      const fd = new FormData(); fd.append('file', f)
      const up = await fetch('/api/im/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + mobileToken() }, body: fd })
      const j = await up.json()
      if (j.success && j.data?.url) {
        const u = j.data.url
        imgs.value.push(/^https?:\/\//i.test(u) ? u : 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u))
      }
    } catch { mobileToast('⚠ 图片上传失败') }
  }
}
async function publish() {
  const content = text.value.trim()
  if (!content && !imgs.value.length) { mobileToast('请输入内容或选择图片'); return }
  if (content.length > maxLen.value) { mobileToast(isVip.value ? '内容超过 5000 字' : '普通用户限 200 字，升级 VIP 可发长文'); return }
  posting.value = true
  // 身份签名（内容可追溯）：用助记词派生私钥签名内容 → sig + pubKey + fingerprint
  let sig = '', pubKey = '', fingerprint = ''
  const mn = myMnemonic()
  if (mn) {
    try {
      sig = await signTextWithMnemonic(mn, content)
      pubKey = await fetchMyPubKey()
    } catch (e: any) {
      mobileToast('⚠ ' + (e?.message || '签名失败，本次未签名'))
    }
  }
  try {
    const body: any = { scope: scopeNow.value, content, images: imgs.value }
    if (sig) body.sig = sig
    if (pubKey) body.pubKey = pubKey
    const r = await mobileAuthFetch('/api/tea/posts', { method: 'POST', body: JSON.stringify(body) })
    const j = await r.json()
    if (r.ok && j.success) {
      mobileToast(sig ? '✅ 已发布（签名有效）' : (myMnemonic() ? '✅ 已发布' : '✅ 已发布（⚠ 未创建身份，无法签名）'))
      text.value = ''; imgs.value = []; load()
    } else mobileToast('❌ ' + (j.error || '发布失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { posting.value = false }
}

// 帖子操作
async function likePost(p: any) {
  try {
    const r = await mobileAuthFetch('/api/tea/posts/like', { method: 'POST', body: JSON.stringify({ postId: p.id }) })
    const j = await r.json()
    if (r.ok && j.success) { p.liked = !p.liked; p.likes = (p.likes || 0) + (p.liked ? 1 : -1) }
  } catch { mobileToast('⚠ 网络错误') }
}
function openComment(p: any) { commentOn.value = { ...p, commentsArr: p.commentsArr || [] }; cmtText.value = '' }
async function sendCmt() {
  if (!cmtText.value.trim() || !commentOn.value) return
  cmtSending.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/posts/comment', { method: 'POST', body: JSON.stringify({ postId: commentOn.value.id, text: cmtText.value.trim() }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已评论'); commentOn.value = null; load() } else mobileToast('❌ ' + (j.error || '评论失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { cmtSending.value = false }
}
function openTip(p: any) { tipOn.value = p; tipAmt.value = 5 }
async function sendTip() {
  if (!tipOn.value) return
  tipSending.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/posts/tip', { method: 'POST', body: JSON.stringify({ postId: tipOn.value.id, diamonds: tipAmt.value }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('💎 打赏成功'); tipOn.value = null; load() } else mobileToast('❌ ' + (j.error || '打赏失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { tipSending.value = false }
}
async function delPost(p: any) {
  if (!confirm('删除这条帖子？')) return
  try { const r = await mobileAuthFetch('/api/tea/posts/delete', { method: 'POST', body: JSON.stringify({ postId: p.id }) }); const j = await r.json(); if (r.ok && j.success) { mobileToast('🗑 已删除'); load() } else mobileToast('❌ ' + (j.error || '删除失败')) } catch { mobileToast('⚠ 网络错误') }
}
async function adminDel(p: any) {
  if (!confirm('管理员删除这条帖子？')) return
  try { const r = await mobileAuthFetch('/api/tea/admin/delete', { method: 'POST', body: JSON.stringify({ postId: String(p.id).replace(/^cloud_/, '') }) }); const j = await r.json(); if (r.ok && j.success) { mobileToast('✅ 已删除'); load() } else mobileToast('❌ ' + (j.error || '')) } catch { }
}

// AI
function openAi() {
  if (!isVip.value) { mobileToast('🔒 AI 编写仅限 VIP 会员使用'); return }
  aiMode.value = 'create'; aiPrompt.value = ''; aiResult.value = ''; aiOpen.value = true
}
async function genAi() {
  const v = aiPrompt.value.trim()
  if (!v) { mobileToast('请输入内容'); return }
  aiBusy.value = true; aiResult.value = ''
  try {
    const msgs = aiMode.value === 'create'
      ? [{ role: 'system', content: '你是社区文案创作助手。根据用户想法创作一段适合发布在社交社区的中文文案，语气自然有温度，可用 emoji，一般 100-300 字（用户有要求按用户要求）。只输出文案本身。' }, { role: 'user', content: v }]
      : [{ role: 'system', content: '你是文案润色助手。润色以下内容：更通顺、更有吸引力、结构更清晰，保持原意和关键信息，可用 emoji 点缀。只输出润色后的文案。' }, { role: 'user', content: v }]
    const r = await mobileAuthFetch('/api/tea/llm/chat', { method: 'POST', body: JSON.stringify({ messages: msgs }) })
    const j = await r.json()
    const txt = (j.text || j.data?.text || j.data?.content || '').trim()
    if (!txt) throw new Error(j.error || '生成失败')
    aiResult.value = txt
  } catch (e: any) { mobileToast('❌ ' + (e.message || '生成失败')) } finally { aiBusy.value = false }
}
function useAi() { if (aiResult.value) { text.value = aiResult.value.slice(0, maxLen.value); aiOpen.value = false; mobileToast('✅ 已填入发帖框') } }

function copyFp(fp: string) {
  try { navigator.clipboard.writeText(fp); mobileToast('🔑 密钥已复制：' + fp) } catch { mobileToast('🔑 ' + fp) }
}
function preview(u: string) { previewImgUrl.value = absCover(u) }
function absCover(u: string) { if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; return 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u) }
function hideImg(e: any) { try { e.target.style.display = 'none' } catch { } }
function fmtTs(t: any) { if (!t) return ''; const n = Number(t); const d = n > 10000000000 ? new Date(n) : new Date(n * 1000); return d.toISOString().slice(0, 16).replace('T', ' ') }
function openDetail(p: any) {
  postDetailOn.value = { ...p, _expanded: true, commentsArr: p.commentsArr || [] }
  detailCmt.value = ''
}
function likeDetail() {
  if (!postDetailOn.value) return
  likePost(postDetailOn.value)
}
async function sendDetailCmt() {
  if (!detailCmt.value.trim() || !postDetailOn.value) return
  detailSending.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/posts/comment', { method: 'POST', body: JSON.stringify({ postId: postDetailOn.value.id, text: detailCmt.value.trim() }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已评论'); postDetailOn.value = null; load() } else mobileToast('❌ ' + (j.error || '评论失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { detailSending.value = false }
}
function openTipInDetail() { if (postDetailOn.value) { tipOn.value = postDetailOn.value; tipAmt.value = 5 } }
function delDetail() { if (postDetailOn.value) { delPost(postDetailOn.value) } }
function adminDelDetail() { if (postDetailOn.value) { adminDel(postDetailOn.value) } }

onMounted(() => { loadMe(); load() })
</script>

<style scoped>
.mcomm { padding-bottom: 60px; }
.mcomm-composer { background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 12px; }
.mcomm-ta { width: 100%; border: none; outline: none; font-size: 14px; resize: none; color: #111827; min-height: 60px; font-family: inherit; }
.mcomm-toolbar { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.mcomm-tool { font-size: 13px; border: 1px solid #e5e7eb; background: #fff; padding: 5px 9px; border-radius: 8px; color: #6366f1; cursor: pointer; }
.mcomm-count { margin-left: auto; font-size: 12px; color: #9ca3af; }
.mcomm-pub { background: linear-gradient(135deg, #38bdf8, #6366f1); color: #fff; border: none; padding: 7px 16px; border-radius: 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
.mcomm-thumbs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.mcomm-thumb-wrap { position: relative; }
.mcomm-thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 8px; }
.mcomm-thumb-del { position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.mcomm-emoji { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 70; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 3px; padding: 16px; overflow-y: auto; }
.mcomm-emoji-cell { font-size: 24px; padding: 4px; cursor: pointer; }
.mcomm-feed { }
.mcomm-post { background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
.mcomm-post-top { display: flex; align-items: center; gap: 8px; }
.mcomm-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #38bdf8, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.mcomm-info { flex: 1; }
.mcomm-name { font-size: 14px; font-weight: 600; }
.mcomm-time { font-size: 11px; color: #9ca3af; }
.mcomm-del { border: none; background: none; color: #9ca3af; font-size: 13px; }
.mcomm-content { font-size: 14px; color: #111827; line-height: 1.7; margin-top: 8px; white-space: pre-wrap; word-break: break-word; }
.mcomm-content.clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mcomm-expand { border: none; background: none; color: #6366f1; font-size: 12px; margin-top: 4px; }
.mcomm-sigrow { display: flex; align-items: center; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
.mcomm-sig { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.mcomm-sig.ok { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
.mcomm-sig.bad { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.mcomm-sig.key { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
.mcomm-imgs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.mcomm-img { width: 100px; height: 100px; object-fit: cover; border-radius: 8px; }
.mcomm-actions { display: flex; gap: 14px; margin-top: 10px; }
.mcomm-act { border: none; background: none; font-size: 13px; color: #6b7280; }
.mcomm-act.liked { color: #ef4444; }
.mcomm-empty { text-align: center; color: #9ca3af; padding: 40px 0; }
.mcomm-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 70; display: flex; align-items: center; justify-content: center; padding: 20px; }
.mcomm-modal { background: #fff; border-radius: 14px; padding: 18px; width: 100%; max-width: 340px; }
.mcomm-scroll { max-height: 82vh; overflow-y: auto; }
.mcomm-detail { max-height: 86vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.mcomm-avatar.big { width: 44px; height: 44px; font-size: 18px; }
.mcomm-detail-body { font-size: 15px; color: #111827; line-height: 1.8; white-space: pre-wrap; word-break: break-word; margin: 10px 0; }
.mcomm-detail-imgs { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
.mcomm-detail-img { width: 100%; max-height: 60vh; object-fit: contain; border-radius: 10px; background: #f3f4f6; }
.mcomm-detail-cmt-title { font-size: 14px; font-weight: 700; margin: 12px 0 6px; color: #374151; }
.mcomm-empty-sm { font-size: 13px; color: #9ca3af; padding: 12px 0; text-align: center; }
.mcomm-modal-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
.mcomm-ai-tabs { display: flex; gap: 8px; margin-bottom: 8px; }
.mcomm-ai-tab { flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; font-size: 13px; }
.mcomm-ai-tab.on { border-color: #6366f1; background: #eef2ff; color: #6366f1; font-weight: 600; }
.mcomm-ai-ta { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px; font-size: 14px; min-height: 80px; resize: none; box-sizing: border-box; font-family: inherit; }
.mcomm-ai-result { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; font-size: 13px; margin: 8px 0; max-height: 160px; overflow-y: auto; white-space: pre-wrap; }
.mcomm-modal-btns { display: flex; gap: 8px; margin-top: 8px; }
.mcomm-btn { flex: 1; padding: 11px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; }
.mcomm-btn.primary { background: linear-gradient(135deg, #38bdf8, #6366f1); color: #fff; }
.mcomm-btn.ghost { background: #f3f4f6; color: #374151; }
.mcomm-cmt-list { max-height: 160px; overflow-y: auto; margin-bottom: 8px; }
.mcomm-cmt { font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
.mcomm-cmt-auth { color: #6366f1; font-weight: 600; }
.mcomm-hint { font-size: 12px; color: #6b7280; margin-bottom: 10px; }
.mcomm-tip-opts { display: flex; gap: 8px; margin-bottom: 10px; }
.mcomm-tip-opt { flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; font-size: 14px; }
.mcomm-tip-opt.on { border-color: #6366f1; background: #eef2ff; color: #6366f1; }
.mcomm-preview { max-width: 90vw; max-height: 80vh; border-radius: 10px; }

/* 四栏导航 */
.mcomm-tabs { display: flex; background: #fff; border-radius: 12px; padding: 6px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.mcomm-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 2px; border: none; background: none; border-radius: 9px; font-size: 12px; color: #6b7280; font-weight: 600; }
.mcomm-tab-icon { font-size: 18px; }
.mcomm-tab.on { background: #eef2ff; color: #4f46e5; }
.mcomm-friend-tip { font-size: 12px; color: #4f46e5; background: #eef2ff; border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; }
.mcomm-tag { font-size: 10px; color: #fff; background: #6366f1; border-radius: 8px; padding: 1px 6px; margin-left: 6px; vertical-align: middle; }

/* 行业热点 */
.mcomm-hot-hero { background: linear-gradient(135deg,#f97316,#ef4444); color: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; text-align: center; }
.mcomm-hot-title { font-size: 20px; font-weight: 800; }
.mcomm-hot-sub { font-size: 12px; opacity: .9; margin-top: 4px; }
.mcomm-hot-pick { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.mcomm-hot-chip { padding: 6px 12px; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; font-size: 12px; color: #374151; }
.mcomm-hot-chip.on { border-color: #f97316; background: #fff7ed; color: #f97316; font-weight: 700; }
.mcomm-hot-toolrow { display: flex; align-items: center; justify-content: space-between; margin: 10px 0; }
.mcomm-hot-status { font-size: 12px; color: #6b7280; }
.mcomm-hot-fetch { padding: 8px 16px; border: none; border-radius: 20px; background: linear-gradient(135deg,#f97316,#ef4444); color: #fff; font-weight: 700; font-size: 13px; }
.mcomm-hot-fetch:disabled { opacity: .5; }
.mcomm-hot-brief { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.mcomm-hot-brief-head { font-weight: 800; font-size: 15px; color: #b45309; margin-bottom: 6px; }
.mcomm-hot-brief-sum { font-size: 13px; color: #374151; line-height: 1.7; margin-bottom: 10px; }
.mcomm-hot-brief-sec { margin: 8px 0; }
.mcomm-hot-brief-sec-t { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 4px; }
.mcomm-hot-brief-li { font-size: 13px; color: #4b5563; line-height: 1.6; }
.mcomm-hot-empty { font-size: 13px; color: #9ca3af; text-align: center; padding: 24px 0; }
.mcomm-hot-list { display: flex; flex-direction: column; gap: 10px; }
.mcomm-hot-histbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; align-items: center; }
.mcomm-hot-hist-lbl { font-size: 12px; color: #6b7280; font-weight: 600; }
.mcomm-hot-hist-tag { font-size: 12px; padding: 4px 10px; border-radius: 12px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
.mcomm-hot-hist-tag.on { background: #fff7ed; border-color: #f97316; color: #f97316; font-weight: 700; }
.mcomm-hot-item { text-decoration: none; background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.06); display: block; }
.mcomm-hot-item-top { display: flex; justify-content: space-between; margin-bottom: 5px; }
.mcomm-hot-src { font-size: 11px; color: #f97316; font-weight: 700; }
.mcomm-hot-time { font-size: 11px; color: #9ca3af; }
.mcomm-hot-title2 { font-size: 14px; color: #111827; line-height: 1.5; font-weight: 500; }

/* 商家 */
.mcomm-shop-title { font-size: 16px; font-weight: 800; color: #111827; margin-bottom: 10px; }
.mcomm-shop-count { font-size: 12px; color: #9ca3af; font-weight: 500; }
.mcomm-shop-card { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 12px; padding: 12px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.mcomm-shop-avatar { width: 46px; height: 46px; border-radius: 10px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; flex: none; }
.mcomm-shop-info { flex: 1; min-width: 0; }
.mcomm-shop-name { font-size: 15px; font-weight: 700; color: #111827; }
.mcomm-shop-heat { font-size: 11px; color: #f97316; margin-left: 6px; }
.mcomm-shop-meta { font-size: 12px; color: #6b7280; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mcomm-shop-arrow { font-size: 22px; color: #9ca3af; flex: none; }
/* 店铺详情 */
.mcomm-shop-detail { max-height: 88vh; overflow-y: auto; }
.mcomm-shop-detail-banner-wrap { width: 100%; margin: -12px -12px 0; width: calc(100% + 24px); border-radius: 12px 12px 0 0; overflow: hidden; }
.mcomm-shop-detail-banner { width: 100%; height: 110px; object-fit: cover; display: block; }
.mcomm-shop-detail-head { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
.mcomm-shop-detail-owner { font-size: 12px; color: #9ca3af; }
.mcomm-shop-detail-stats { display: flex; gap: 8px; margin: 8px 0; }
.mcomm-shop-stat { font-size: 12px; padding: 3px 10px; border-radius: 12px; background: #f3f4f6; color: #374151; }
.mcomm-shop-stat.good { background: #ecfdf5; color: #059669; }
.mcomm-shop-stat.bad { background: #fef2f2; color: #dc2626; }
.mcomm-shop-detail-desc { font-size: 13px; color: #4b5563; line-height: 1.6; background: #f9fafb; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
.mcomm-shop-detail-prod-title { font-size: 14px; font-weight: 700; margin: 10px 0 6px; }
.mcomm-shop-detail-prods { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mcomm-shop-prod { background: #f9fafb; border-radius: 10px; padding: 8px; }
.mcomm-shop-prod-cover { width: 100%; height: 90px; object-fit: cover; border-radius: 8px; margin-bottom: 6px; background: #e5e7eb; }
.mcomm-shop-prod-cover.empty { display: flex; align-items: center; justify-content: center; font-size: 26px; color: #9ca3af; }
.mcomm-shop-prod-name { font-size: 13px; font-weight: 600; color: #111827; }
.mcomm-shop-prod-desc { font-size: 11px; color: #6b7280; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mcomm-shop-prod-meta { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
.mcomm-shop-prod-price { font-size: 13px; color: #f97316; font-weight: 700; }
.mcomm-shop-prod-stock { font-size: 11px; color: #9ca3af; }
</style>
