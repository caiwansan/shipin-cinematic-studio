<template>
  <div class="mcity">
    <!-- 顶部 tab（含自治管理） -->
    <div class="mc-tabs">
      <button v-for="t in tabs" :key="t.k" class="mc-tab" :class="{ on: tab === t.k }" @click="tab = t.k">
        {{ t.name }}
      </button>
    </div>


    <!-- ⑤ 自治管理（选举/罢免/关闭/邀请） -->
    <section v-if="tab === 'zizhi'">
      <div class="mc-citybar">
        <select v-model="cityId" class="mc-citysel" @change="onCityChange">
          <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}{{ c.myRole === 'agent' ? ' 👑' : c.myRole === 'admin' ? ' 🛡' : '' }}</option>
        </select>
      </div>
      <div class="mc-sec-title">🛡 自治管理 <span class="mc-zizhi-sub">城市治理：选举 · 罢免 · 关闭 · 邀请</span></div>
      <MCityAutonomy :city-id="cityId" :city-name="myCityName" :my-role="myRole" />
    </section>


    <!-- 城市代理申请入口 -->
    <button class="mc-agent-btn" @click="openAgentApply">🏙 申请城市代理</button>


    <!-- ① 群聊（城市总群） -->
    <section v-if="tab === 'grupao'">
      <div class="mc-citybar">
        <select v-model="cityId" class="mc-citysel" @change="onCityChange">
          <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}{{ c.myRole === 'agent' ? ' 👑' : c.myRole === 'admin' ? ' 🛡' : '' }}</option>
        </select>
      </div>
      <div class="mc-sec-title">城市总群</div>
      <div v-for="c in cities" :key="'pub' + c.id" class="mc-row" @click="openCityPub(c)">
        <div class="mc-avatar is-group">🏘️</div>
        <div class="mc-row-main">
          <div class="mc-row-name">{{ c.name }} · 总群</div>
          <div class="mc-row-sub">所有会员在此聊天</div>
        </div>
        <span class="mc-arrow">›</span>
      </div>
      <div v-if="!cities.length" class="mc-empty">暂无可聊城市，请先加入城市</div>
      <!-- 管理员：入城审核 -->
      <template v-if="isLeader">
        <div class="mc-sec-title">待审核入城申请（{{ cityApplies.length }}）</div>
        <div v-if="!cityApplies.length" class="mc-empty">暂无入城申请</div>
        <div v-for="ap in cityApplies" :key="'ca' + ap.uid" class="mc-row">
          <div class="mc-avatar is-public">{{ (ap.nickname || '茶').slice(0, 1) }}</div>
          <div class="mc-row-main">
            <div class="mc-row-name">{{ ap.nickname || ap.uid }}</div>
            <div class="mc-row-sub">{{ (ap.createdAt || '').slice(0, 16).replace('T', ' ') }} 申请入城</div>
          </div>
          <button class="mc-mini ok" @click="auditCity(ap, true)">通过</button>
          <button class="mc-mini no" @click="auditCity(ap, false)">拒绝</button>
        </div>
      </template>
    </section>


    <!-- ② 私域（用户申请的私域群） -->
    <section v-if="tab === 'siyu'">
      <div class="mc-citybar">
        <select v-model="cityId" class="mc-citysel" @change="onCityChange">
          <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}{{ c.myRole === 'agent' ? ' 👑' : c.myRole === 'admin' ? ' 🛡' : '' }}</option>
        </select>
      </div>
      <div class="mc-sec-title">私域群（{{ rooms.length }}）</div>
      <button class="mc-btn primary" @click="openClaim">＋ 申请开通私域群</button>
      <div v-if="!rooms.length" class="mc-empty">该城市还没有私域群，申请开通成为群主吧</div>
      <div v-for="r in rooms" :key="'r' + r.id" class="mc-row" @click="onRoom(r)">
        <div class="mc-avatar is-group">🔒</div>
        <div class="mc-row-main">
          <div class="mc-row-name">{{ r.name }}<span v-if="r.isOwner" class="mc-owner">群主</span></div>
          <div class="mc-row-sub">{{ r.memberCount }} 人·{{ r.myStatus === 'active' ? '已加入' : r.myStatus === 'pending' ? '待审核' : '未加入' }}</div>
        </div>
        <button v-if="r.myStatus !== 'active'" class="mc-mini" :disabled="r.myStatus === 'pending'" @click.stop="applyRoom(r)">
          {{ r.myStatus === 'pending' ? '待审核' : '申请加入' }}
        </button>
        <button v-else-if="r.isOwner || r.canManage" class="mc-mini" @click.stop="openManage(r)">管理</button>
        <span v-else class="mc-arrow">›</span>
      </div>
      <template v-if="isLeader">
        <div class="mc-sec-title">待审核开群申请（{{ claims.length }}）</div>
        <div v-if="!claims.length" class="mc-empty">暂无开群申请</div>
        <div v-for="cl in claims" :key="'cl' + cl.id" class="mc-row">
          <div class="mc-row-main">
            <div class="mc-row-name">{{ cl.name }}</div>
            <div class="mc-row-sub">申请开通 · {{ cl.nickname }}</div>
          </div>
          <button class="mc-mini ok" @click="auditClaim(cl, true)">通过</button>
          <button class="mc-mini no" @click="auditClaim(cl, false)">拒绝</button>
        </div>
      </template>
    </section>


    <!-- ③ 社区（会员发帖子） -->
    <section v-if="tab === 'shequ'">
      <div class="mc-citybar">
        <select v-model="cityId" class="mc-citysel" @change="onCityChange">
          <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <button class="mc-btn primary" @click="openPostNew">📝 发帖子</button>
      <div v-for="p in posts" :key="'p' + p.id" class="mc-post" @click="openPostDetail(p)">
        <div class="mc-post-head">
          <span class="mc-post-author">{{ p.nickname || p.authorName || p.uid || '茶友' }}</span>
          <span class="mc-post-time">{{ (p.createdAt || '').slice(0, 16).replace('T', ' ') }}</span>
        </div>
        <div class="mc-post-title">{{ p.title }}</div>
        <div class="mc-post-content mc-clamp3">
          <template v-for="(part, ix) in parsePostContent(p.content)" :key="ix">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
            <span v-else class="mc-post-link" @click.stop="navigateToLink(part)">🔗 {{ part.name }}</span>
          </template>
        </div>
        <div class="mc-post-imgs" v-if="p.images && p.images.length">
          <img v-for="(im, ix) in p.images" :key="ix" :src="im" class="mc-post-img" @click.stop="openPostDetail(p)" @error="hideImg" />
        </div>
        <div class="mc-post-foot" @click.stop>
          <button class="mc-mini" @click="likePost(p)">👍 {{ p.likes || p.likeCount || 0 }}</button>
          <button class="mc-mini" @click="openComment(p)">💬 {{ p.commentCount || p.comments || 0 }}</button>
          <button v-if="p.mine || p.isMine" class="mc-mini no" @click="delPost(p)">🗑 删除</button>
          <span class="mc-post-more">{{ p.content && p.content.length > 80 ? '查看全文 ›' : '' }}</span>
        </div>
      </div>
      <div v-if="!posts.length" class="mc-empty">该城市还没人发帖，来发第一帖吧</div>
    </section>


    <!-- ④ 商家（城市攻略 + 易货商城 + 我的店铺） -->
    <section v-if="tab === 'shangjia'">
      <div class="mc-citybar">
        <select v-model="cityId" class="mc-citysel" @change="onCityChange">
          <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="mc-btn-row">
        <button class="mc-btn primary" @click="openBizApply">🏪 商家入驻申请</button>
        <button class="mc-btn ghost" @click="openMyShop">🛍 我的店铺</button>
        <button class="mc-btn ghost" @click="$emit('open-tickets')">🎫 订单管理</button>
      </div>
      <!-- 商家列表（卡片式） -->
      <div class="mc-sec-title">🏪 入驻商家（{{ shopList.length }}）</div>
      <div v-if="!shopList.length" class="mc-empty">该城市暂无认证商家</div>
      <div class="mc-shop-grid">
        <div v-for="s in shopList" :key="'s' + s.id" class="mc-shop-card" @click="openShopDetail(s)">
          <div class="mc-shop-banner">
            <img v-if="s.banner" :src="absCover(s.banner)" class="mc-shop-banner-img" @error="hideImg" />
            <div v-else class="mc-shop-banner-ph">🏪</div>
          </div>
          <div class="mc-shop-card-body">
            <div class="mc-shop-card-name">{{ s.shopName || '未命名店铺' }}</div>
            <div class="mc-shop-card-addr" v-if="s.address">📍 {{ s.address }}</div>
            <div class="mc-shop-card-phone" v-if="s.phone">📞 {{ s.phone }}</div>
            <div class="mc-shop-card-stats">
              <span class="mc-shop-card-tag" v-if="s.productCount > 0">🎁 {{ s.productCount }}件商品</span>
              <span class="mc-shop-card-tag" v-if="s.good > 0">👍 {{ s.good }}</span>
              <span class="mc-shop-card-tag" v-if="s.bad > 0">👎 {{ s.bad }}</span>
              <span class="mc-shop-card-tag" v-if="s.heat > 0">🔥 {{ s.heat }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="mc-sec-title">城市攻略（{{ bizPosts.length }}）</div>
      <div v-if="!bizPosts.length" class="mc-empty">该城市暂无认证商家攻略</div>
      <div v-for="p in bizPosts" :key="'b' + p.id" class="mc-row" @click="openBizPost(p)">
        <div class="mc-avatar is-public">📝</div>
        <div class="mc-row-main">
          <div class="mc-row-name">{{ p.bizName || p.shopName || '商家' }}</div>
          <div class="mc-row-sub">{{ p.title }} · 👍{{ p.good || 0 }} 👎{{ p.bad || 0 }} 🔥{{ p.heat || 0 }}</div>
        </div>
        <span class="mc-arrow">›</span>
      </div>
    </section>


    <!-- 商家详情弹窗 -->
    <div v-if="shopDetail" class="mc-mask" @click.self="shopDetail = null">
      <div class="mc-modal mc-shop-detail mc-modal-scroll">
        <!-- 店招/横幅 -->
        <div class="mc-shop-banner">
          <img v-if="shopDetail.banner" :src="absCover(shopDetail.banner)" class="mc-shop-banner-img" @error="hideImg" />
          <div v-else class="mc-shop-banner-ph">🏪 {{ shopDetail.shopName || '店铺' }}</div>
        </div>
        <div class="mc-shop-detail-body">
          <div class="mc-modal-title" style="text-align:left;margin-bottom:4px">{{ shopDetail.shopName || '未命名店铺' }}</div>
          <!-- 联系方式 -->
          <div class="mc-shop-contact" v-if="shopDetail.address || shopDetail.phone">
            <div v-if="shopDetail.address" class="mc-shop-contact-row">📍 {{ shopDetail.address }}</div>
            <div v-if="shopDetail.phone" class="mc-shop-contact-row">📞 {{ shopDetail.phone }}</div>
          </div>
          <!-- 店铺介绍 -->
          <div v-if="shopDetail.intro" class="mc-shop-intro">{{ shopDetail.intro }}</div>
          <div v-if="shopDetail.bizDesc" class="mc-shop-bizdesc">{{ shopDetail.bizDesc }}</div>
          <!-- 评价 -->
          <div class="mc-shop-review-bar">
            <span v-if="shopDetail.good > 0" class="mc-shop-review good">👍 {{ shopDetail.good }}</span>
            <span v-if="shopDetail.bad > 0" class="mc-shop-review bad">👎 {{ shopDetail.bad }}</span>
            <span v-if="shopDetail.heat > 0" class="mc-shop-review">🔥 {{ shopDetail.heat }}</span>
            <span v-if="!shopDetail.good && !shopDetail.bad" class="mc-shop-review">暂无评价</span>
          </div>
          <!-- 分享链接 -->
          <button class="mc-btn ghost" style="margin-top:8px;font-size:12px;padding:6px 10px" @click="copyShopLink">🔗 复制店铺分享链接</button>
          <!-- 产品列表 -->
          <div class="mc-sec-title" style="margin-top:12px">🎁 店铺商品（{{ shopDetailProducts.length }}）</div>
          <div v-if="!shopDetailProducts.length" class="mc-empty">该店铺暂无在售商品</div>
          <div class="mc-prod-grid">
            <div v-for="p in shopDetailProducts" :key="'sd' + p.id" class="mc-prod-card" @click="openProductDetail(p, shopDetail.id)">
              <img v-if="p.cover" :src="absCover(p.cover)" class="mc-prod-thumb" @error="hideImg" />
              <div v-else class="mc-prod-thumb mc-prod-thumb-ph">🎁</div>
              <div class="mc-prod-card-name">{{ p.name }}</div>
              <div class="mc-prod-card-price">{{ p.priceTea }} 工分</div>
              <div v-if="p.commissionRate > 0" class="mc-prod-card-commission">返 {{ p.commissionRate }}%</div>
            </div>
          </div>
        </div>
        <button class="mc-btn ghost" @click="shopDetail = null" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- 产品详情弹窗 -->
    <div v-if="prodDetail" class="mc-mask" @click.self="prodDetail = null">
      <div class="mc-modal mc-prod-detail mc-modal-scroll">
        <!-- 图片画廊 -->
        <div class="mc-prod-gallery" v-if="prodDetailImages.length">
          <div class="mc-prod-gallery-track" :style="{ transform: 'translateX(-' + (galleryIdx * 100) + '%)' }">
            <div v-for="(im, ix) in prodDetailImages" :key="ix" class="mc-prod-gallery-slide">
              <img :src="absCover(im)" class="mc-prod-detail-img" @error="hideImg" @click="openImagePreview(prodDetailImages, ix)" />
            </div>
          </div>
          <div class="mc-prod-gallery-dots" v-if="prodDetailImages.length > 1">
            <span v-for="(im, ix) in prodDetailImages" :key="ix" class="mc-prod-gallery-dot" :class="{ on: galleryIdx === ix }" @click="galleryIdx = ix"></span>
          </div>
          <div class="mc-prod-gallery-counter">{{ galleryIdx + 1 }}/{{ prodDetailImages.length }}</div>
        </div>
        <img v-else-if="prodDetail.cover" :src="absCover(prodDetail.cover)" class="mc-prod-detail-img" @error="hideImg" @click="openImagePreview([prodDetail.cover], 0)" />
        <div v-else class="mc-prod-detail-img mc-prod-thumb-ph">🎁</div>
        <div class="mc-modal-title">{{ prodDetail.name }}</div>
        <div class="mc-prod-detail-shop">🏪 {{ prodDetail.shopName || '店铺' }}</div>
        <p class="mc-modal-tip">{{ prodDetail.prodDesc || '暂无描述' }}</p>
        <div class="mc-prod-detail-row">
          <span class="mc-prod-detail-price">{{ prodDetail.priceTea }} 工分</span>
          <span v-if="prodDetail.stock > 0" class="mc-prod-detail-stock">库存 {{ prodDetail.stock }}</span>
          <span v-else class="mc-prod-detail-stock off">已售罄</span>
        </div>
        <!-- 产品标准信息 -->
        <div class="mc-prod-detail-section" v-if="prodDetail.standard || prodDetail.licenseNo || prodDetail.manufacturer || prodDetail.barcode || prodDetail.origin || prodDetail.netWeight || prodDetail.shelfLife || prodDetail.storage">
          <div class="mc-prod-detail-section-title">📋 产品标准信息</div>
          <div class="mc-prod-specs">
            <div v-if="prodDetail.standard" class="mc-prod-spec-row"><span class="mc-prod-spec-key">执行标准</span><span class="mc-prod-spec-val">{{ prodDetail.standard }}</span></div>
            <div v-if="prodDetail.licenseNo" class="mc-prod-spec-row"><span class="mc-prod-spec-key">生产许可证号</span><span class="mc-prod-spec-val">{{ prodDetail.licenseNo }}</span></div>
            <div v-if="prodDetail.manufacturer" class="mc-prod-spec-row"><span class="mc-prod-spec-key">生产厂家</span><span class="mc-prod-spec-val">{{ prodDetail.manufacturer }}</span></div>
            <div v-if="prodDetail.barcode" class="mc-prod-spec-row"><span class="mc-prod-spec-key">产品条码</span><span class="mc-prod-spec-val">{{ prodDetail.barcode }}</span></div>
            <div v-if="prodDetail.origin" class="mc-prod-spec-row"><span class="mc-prod-spec-key">产地</span><span class="mc-prod-spec-val">{{ prodDetail.origin }}</span></div>
            <div v-if="prodDetail.netWeight" class="mc-prod-spec-row"><span class="mc-prod-spec-key">净含量</span><span class="mc-prod-spec-val">{{ prodDetail.netWeight }}</span></div>
            <div v-if="prodDetail.shelfLife" class="mc-prod-spec-row"><span class="mc-prod-spec-key">保质期</span><span class="mc-prod-spec-val">{{ prodDetail.shelfLife }}</span></div>
            <div v-if="prodDetail.storage" class="mc-prod-spec-row"><span class="mc-prod-spec-key">储存条件</span><span class="mc-prod-spec-val">{{ prodDetail.storage }}</span></div>
          </div>
        </div>
        <!-- 详情图 -->
        <div v-if="prodDetail.detailImages && prodDetail.detailImages.length" class="mc-prod-detail-section">
          <div class="mc-prod-detail-section-title">📋 商品详情</div>
          <div class="mc-prod-detail-images">
            <img v-for="(im, ix) in prodDetail.detailImages" :key="ix" :src="absCover(im)" class="mc-prod-detail-image" @error="hideImg" @click="openImagePreview(prodDetail.detailImages, ix)" />
          </div>
        </div>
        <button class="mc-btn primary" :disabled="prodDetail.buying || prodDetail.stock === 0" @click="buyProduct(prodDetail)">{{ prodDetail.buying ? '兑换中…' : '💠 用工分兑换' }}</button>
        <button class="mc-btn ghost" @click="prodDetail = null" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- 图片全屏预览 -->
    <div v-if="imagePreview.length" class="mc-mask mc-img-preview-mask" @click.self="imagePreview = []">
      <div class="mc-img-preview-track" :style="{ transform: 'translateX(-' + (imagePreviewIdx * 100) + '%)' }">
        <div v-for="(im, ix) in imagePreview" :key="ix" class="mc-img-preview-slide">
          <img :src="absCover(im)" class="mc-img-preview-img" @error="hideImg" />
        </div>
      </div>
      <div class="mc-img-preview-counter" v-if="imagePreview.length > 1">{{ imagePreviewIdx + 1 }}/{{ imagePreview.length }}</div>
      <button class="mc-img-preview-close" @click="imagePreview = []">✕</button>
      <button v-if="imagePreview.length > 1 && imagePreviewIdx > 0" class="mc-img-preview-nav prev" @click="imagePreviewIdx--">‹</button>
      <button v-if="imagePreview.length > 1 && imagePreviewIdx < imagePreview.length - 1" class="mc-img-preview-nav next" @click="imagePreviewIdx++">›</button>
    </div>


    <!-- 我的店铺管理弹窗 -->
    <div v-if="myShopOpen" class="mc-mask">
      <div class="mc-modal mc-modal-scroll">
        <div class="mc-modal-title">🛍 我的店铺{{ myShop.shopName ? ' · ' + myShop.shopName : '' }}</div>
        <div v-if="!myShop || !myShop.id" class="mc-empty">你当前还不是该城市的认证商家</div>
        <template v-else>
          <!-- 店铺资料设置 -->
          <div class="mc-sec-title">🏪 店铺资料</div>
          <div class="mc-form-group">
            <label class="mc-form-label">联系电话</label>
            <input v-model="myShop.phone" class="mc-input" placeholder="商家联系电话" />
          </div>
          <div class="mc-form-group">
            <label class="mc-form-label">店铺介绍</label>
            <input v-model="myShop.intro" class="mc-input" placeholder="店铺介绍、主营内容" />
          </div>
          <button class="mc-btn primary" @click="saveShopProfile">💾 保存店铺资料</button>
          <div class="mc-sec-title">商品管理（{{ myShop.products.length }}）</div>
          <div v-for="p in myShop.products" :key="'mp' + p.id" class="mc-prod">
            <img v-if="p.cover" :src="absCover(p.cover)" class="mc-myprod-thumb" @error="hideImg" />
            <div v-else class="mc-myprod-thumb mc-prod-thumb-ph">🎁</div>
            <div class="mc-prod-info">
              <div class="mc-prod-name">{{ p.name }}<span v-if="p.status !== 'active'" class="mc-owner" style="margin-left:6px">已下架</span></div>
              <div class="mc-prod-price">{{ p.priceTea }} 工分 · 库存 {{ p.stock }}</div>
              <div class="mc-prod-imgcount" v-if="p.images && p.images.length">📷 {{ p.images.length }}张商品图<span v-if="p.detailImages && p.detailImages.length"> · {{ p.detailImages.length }}张详情图</span></div>
            </div>
            <button class="mc-mini" @click="openProdEdit(p)">编辑</button>
            <button class="mc-mini no" @click="delMyProd(p)">删除</button>
          </div>
          <button class="mc-btn primary" @click="openProdEdit(null)">＋ 上架商品</button>
        </template>
        <button class="mc-btn ghost" @click="myShopOpen = false" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- 商品上架/编辑弹窗 -->
    <div v-if="prodEdit" class="mc-mask">
      <div class="mc-modal mc-modal-scroll">
        <div class="mc-modal-title">{{ prodEdit.id ? '编辑商品' : '上架商品' }}</div>
        <div class="mc-form-group">
          <label class="mc-form-label">商品名称 *</label>
          <input v-model="prodEdit.name" class="mc-input" placeholder="如：有机绿茶 500g" />
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">商品描述</label>
          <input v-model="prodEdit.prodDesc" class="mc-input" placeholder="商品简介、卖点" />
        </div>
        <div class="mc-form-row">
          <div class="mc-form-group">
            <label class="mc-form-label">价格（工分）*</label>
            <input v-model.number="prodEdit.priceTea" class="mc-input" type="number" placeholder="0" />
          </div>
          <div class="mc-form-group">
            <label class="mc-form-label">库存</label>
            <input v-model.number="prodEdit.stock" class="mc-input" type="number" placeholder="0" />
          </div>
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">执行标准</label>
          <input v-model="prodEdit.standard" class="mc-input" placeholder="如 GB/T 19001、GB 7718" />
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">生产许可证号</label>
          <input v-model="prodEdit.licenseNo" class="mc-input" placeholder="如 SC114XXXXXXXXX" />
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">生产厂家</label>
          <input v-model="prodEdit.manufacturer" class="mc-input" placeholder="厂家全称" />
        </div>
        <div class="mc-form-row">
          <div class="mc-form-group">
            <label class="mc-form-label">产品条码</label>
            <input v-model="prodEdit.barcode" class="mc-input" placeholder="69XXXXXXXXXXX" />
          </div>
          <div class="mc-form-group">
            <label class="mc-form-label">产地</label>
            <input v-model="prodEdit.origin" class="mc-input" placeholder="如：浙江杭州" />
          </div>
        </div>
        <div class="mc-form-row">
          <div class="mc-form-group">
            <label class="mc-form-label">净含量</label>
            <input v-model="prodEdit.netWeight" class="mc-input" placeholder="如：500g" />
          </div>
          <div class="mc-form-group">
            <label class="mc-form-label">保质期</label>
            <input v-model="prodEdit.shelfLife" class="mc-input" placeholder="如：18个月" />
          </div>
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">储存条件</label>
          <input v-model="prodEdit.storage" class="mc-input" placeholder="如：阴凉干燥处" />
        </div>
        <div class="mc-form-group">
          <label class="mc-form-label">推荐佣金比例（%）</label>
          <input v-model.number="prodEdit.commissionRate" class="mc-input" type="number" min="0" max="100" placeholder="0-100，其他用户分享你的商品链接被下单后按比例返佣" />
          <div class="mc-form-hint">其他用户在社区帖子中插入你的商品链接，用户兑换后你可设置佣金比例，线下核销后佣金到账给推荐人</div>
        </div>
        <!-- 封面图 -->
        <div class="mc-upload-row">
          <img v-if="prodEdit.cover" :src="absCover(prodEdit.cover)" class="mc-upload-thumb" @error="hideImg" />
          <div v-else class="mc-upload-thumb mc-prod-thumb-ph">📷</div>
          <button class="mc-mini" @click="pickCover">选择封面图片</button>
        </div>
        <!-- 商品图（多图） -->
        <div class="mc-multi-upload">
          <div class="mc-multi-upload-label">商品图片（最多9张）</div>
          <div class="mc-multi-upload-grid">
            <div v-for="(im, ix) in prodEdit.images" :key="'img' + ix" class="mc-multi-upload-item">
              <img :src="absCover(im)" class="mc-multi-upload-thumb" @error="hideImg" />
              <button class="mc-multi-upload-del" @click="prodEdit.images.splice(ix, 1)">✕</button>
            </div>
            <button v-if="prodEdit.images.length < 9" class="mc-multi-upload-add" @click="pickProdImage">＋</button>
          </div>
        </div>
        <!-- 详情图（多图） -->
        <div class="mc-multi-upload">
          <div class="mc-multi-upload-label">详情图片（最多20张）</div>
          <div class="mc-multi-upload-grid">
            <div v-for="(im, ix) in prodEdit.detailImages" :key="'dim' + ix" class="mc-multi-upload-item">
              <img :src="absCover(im)" class="mc-multi-upload-thumb" @error="hideImg" />
              <button class="mc-multi-upload-del" @click="prodEdit.detailImages.splice(ix, 1)">✕</button>
            </div>
            <button v-if="prodEdit.detailImages.length < 20" class="mc-multi-upload-add" @click="pickDetailImage">＋</button>
          </div>
        </div>
        <button class="mc-btn primary" :disabled="prodSaving" @click="saveProd">{{ prodSaving ? '保存中…' : '保存' }}</button>
        <button class="mc-btn ghost" @click="prodEdit = null" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- 城市代理申请弹窗 -->
    <div v-if="showAgent" class="mc-mask">
      <div class="mc-modal">
        <div class="mc-modal-title">🏙 城市代理申请</div>
        <p class="mc-modal-tip">提交后由平台管理员审核，尽快与您联系。已开通城市不可重复申请。</p>
        <input v-model="agent.companyName" class="mc-input" placeholder="公司名称 *" />
        <input v-model="agent.companyLocation" class="mc-input" placeholder="公司地点 *（省/市/区）" />
        <input v-model="agent.companyScale" class="mc-input" placeholder="人员规模 *（如：50-100 人）" />
        <select v-model="agent.cityName" class="mc-input mc-citysel">
          <option value="" disabled>选择申请开通的城市 *</option>
          <option v-for="cn in agentCities" :key="cn" :value="cn">{{ cn }}</option>
        </select>
        <input v-model="agent.contactName" class="mc-input" placeholder="联系人 *" />
        <input v-model="agent.contactPhone" class="mc-input" placeholder="联系电话 *" />
        <button class="mc-btn primary" :disabled="agentSubmitting" @click="submitAgentApply">{{ agentSubmitting ? '提交中…' : '提交申请' }}</button>
        <button class="mc-btn ghost" @click="showAgent = false" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- 开通私域群弹窗 -->
    <div v-if="showClaim" class="mc-mask">
      <div class="mc-modal">
        <div class="mc-modal-title">🔒 申请开通私域群</div>
        <p class="mc-modal-tip">提交后由总群管理员审核；通过后你即为群主，总群管理员自动成为本群管理员。</p>
        <input v-model="claimName" class="mc-input" maxlength="20" placeholder="群名称（≤20 字）" />
        <div class="mc-modal-btns">
          <button class="mc-btn ghost" @click="showClaim = false">取消</button>
          <button class="mc-btn primary" :disabled="claiming" @click="submitClaim">{{ claiming ? '提交中…' : '提交申请' }}</button>
        </div>
      </div>
    </div>


    <!-- 发帖弹窗 -->
    <div v-if="showPost" class="mc-mask">
      <div class="mc-modal">
        <div class="mc-modal-title">📝 发帖子</div>
        <input v-model="postTitle" class="mc-input" placeholder="标题" />
        <textarea v-model="postContent" class="mc-input mc-textarea" placeholder="正文（会员帖，VIP 可发更长）"></textarea>
        <button class="mc-btn ghost sm" @click="openLinkPicker">🔗 插入店铺/商品链接</button>
        <button class="mc-btn ghost sm" :disabled="aiBusy" @click="openAiPost">
          {{ aiBusy ? 'AI 生成中…' : (isVip ? '✨ AI 编写' : '🔒 AI 编写（需 VIP）') }}
        </button>
        <button class="mc-btn primary" :disabled="posting" @click="submitPost">{{ posting ? '发布中…' : '发布' }}</button>
        <button class="mc-btn ghost" @click="showPost = false" style="margin-top:8px">关闭</button>
      </div>
    </div>
    <!-- 链接选择弹窗 -->
    <div v-if="linkPickerOpen" class="mc-mask">
      <div class="mc-modal mc-modal-scroll">
        <div class="mc-modal-title">🔗 选择店铺或商品</div>
        <div class="mc-sec-title">入驻商家</div>
        <div v-if="!shopList.length" class="mc-empty">暂无商家</div>
        <div v-for="s in shopList" :key="'lp' + s.id" class="mc-row" @click="insertLink('shop', s.id, s.shopName)">
          <div class="mc-avatar is-public">🏪</div>
          <div class="mc-row-main">
            <div class="mc-row-name">{{ s.shopName || '未命名店铺' }}</div>
            <div class="mc-row-sub">店铺链接</div>
          </div>
          <span class="mc-arrow">›</span>
        </div>
        <div class="mc-sec-title">商品</div>
        <div v-if="!shopProductsGrid.length" class="mc-empty">暂无商品</div>
        <div v-for="p in shopProductsGrid" :key="'lpp' + p.id" class="mc-row" @click="insertLink('product', p.id, p.name)">
          <div class="mc-avatar is-public">🎁</div>
          <div class="mc-row-main">
            <div class="mc-row-name">{{ p.name }}</div>
            <div class="mc-row-sub">{{ p.priceTea }} 工分</div>
          </div>
          <span class="mc-arrow">›</span>
        </div>
        <button class="mc-btn ghost" @click="linkPickerOpen = false" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- AI 编写弹窗（VIP） -->
    <div v-if="aiOpen" class="mc-mask">
      <div class="mc-modal">
        <div class="mc-modal-title">✨ AI 编写</div>
        <div class="mc-ai-tabs">
          <button :class="['mc-ai-tab', { on: aiMode === 'create' }]" @click="aiMode = 'create'; aiPrompt = ''">✍️ 创作</button>
          <button :class="['mc-ai-tab', { on: aiMode === 'polish' }]" @click="aiMode = 'polish'; aiPrompt = postContent">🪄 润色</button>
        </div>
        <textarea v-model="aiPrompt" class="mc-input mc-textarea" :placeholder="aiMode === 'create' ? '输入想法，让 AI 写文案…' : '润色当前发帖内容…'"></textarea>
        <div v-if="aiResult" class="mc-ai-result">{{ aiResult }}</div>
        <div class="mc-modal-btns">
          <button class="mc-btn ghost" @click="aiOpen = false">关闭</button>
          <button class="mc-btn primary" :disabled="aiBusy" @click="genAi">⚡ 生成</button>
          <button class="mc-btn primary" :disabled="!aiResult" @click="useAi">📥 填入发帖框</button>
        </div>
      </div>
    </div>


    <!-- 帖子详情弹窗 -->
    <div v-if="postDetail" class="mc-mask" @click.self="postDetail = null">
      <div class="mc-modal mc-modal-scroll">
        <div class="mc-modal-title">{{ postDetail.title || '帖子' }}</div>
        <div class="mc-post-head">
          <span class="mc-post-author">{{ postDetail.nickname || postDetail.authorName || postDetail.uid || '茶友' }}</span>
          <span class="mc-post-time">{{ (postDetail.createdAt || '').slice(0, 16).replace('T', ' ') }}</span>
        </div>
        <div class="mc-post-content-full">{{ postDetail.content }}</div>
        <div class="mc-post-imgs" v-if="postDetail.images && postDetail.images.length">
          <img v-for="(im, ix) in postDetail.images" :key="ix" :src="im" class="mc-post-img" @error="hideImg" />
        </div>
        <div class="mc-post-foot">
          <button class="mc-mini" @click="likePost(postDetail)">👍 {{ postDetail.likes || postDetail.likeCount || 0 }}</button>
          <button class="mc-mini" @click="openComment(postDetail)">💬 评论</button>
        </div>
        <button class="mc-btn ghost" @click="postDetail = null" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- 评论弹窗 -->
    <div v-if="commentOn" class="mc-mask">
      <div class="mc-modal">
        <div class="mc-modal-title">💬 评论</div>
        <div class="mc-comment-list" v-if="commentOn.comments && commentOn.comments.length">
          <div v-for="(cm, i) in commentOn.comments" :key="i" class="mc-comment-item">
            <span class="mc-comment-auth">{{ cm.nickname || cm.authorName || cm.uid }}</span>：{{ cm.content || cm.text }}
          </div>
        </div>
        <div class="mc-like-users" v-if="commentOn.likeUsers && commentOn.likeUsers.length">
          👍 {{ commentOn.likeUsers.map((u: any) => u.nickname).join('、') }}
        </div>
        <textarea v-model="commentText" class="mc-input mc-textarea" placeholder="写下评论…"></textarea>
        <div class="mc-modal-btns">
          <button class="mc-btn ghost" @click="commentOn = null">关闭</button>
          <button class="mc-btn primary" :disabled="commenting" @click="submitComment">{{ commenting ? '发送中…' : '发送' }}</button>
        </div>
      </div>
    </div>


    <!-- 商家入驻申请弹窗 -->
    <div v-if="showBiz" class="mc-mask">
      <div class="mc-modal">
        <div class="mc-modal-title">🏪 商家入驻申请</div>
        <input v-model="bizName" class="mc-input" placeholder="商家/店铺名称" />
        <input v-model="bizDesc" class="mc-input" placeholder="服务简介" />
        <button class="mc-btn primary" :disabled="bizSubmitting" @click="submitBiz">{{ bizSubmitting ? '提交中…' : '提交认证' }}</button>
        <button class="mc-btn ghost" @click="showBiz = false" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- 私域群管理弹窗（群主） -->
    <div v-if="manage" class="mc-mask">
      <div class="mc-modal">
        <div class="mc-modal-title">🛡 管理「{{ manage.name }}」</div>
        <div class="mc-swrow"><span>全员禁言</span><button class="mc-mini" @click="toggleRoom(manage, 'allMuted')">{{ manage.allMuted ? '开' : '关' }}</button></div>
        <div class="mc-swrow"><span>允许发图片</span><button class="mc-mini" @click="toggleRoom(manage, 'allowImage')">{{ manage.allowImage ? '开' : '关' }}</button></div>
        <div class="mc-swrow"><span>允许发视频</span><button class="mc-mini" @click="toggleRoom(manage, 'allowVideo')">{{ manage.allowVideo ? '开' : '关' }}</button></div>
        <div class="mc-swrow"><span>允许发文件</span><button class="mc-mini" @click="toggleRoom(manage, 'allowFile')">{{ manage.allowFile ? '开' : '关' }}</button></div>
        <div class="mc-sec-title">待审核加群申请（{{ roomApplies.length }}）</div>
        <div v-if="!roomApplies.length" class="mc-empty">暂无加群申请</div>
        <div v-for="ra in roomApplies" :key="'ra' + ra.uid" class="mc-row">
          <div class="mc-row-main">
            <div class="mc-row-name">{{ ra.nickname || ra.uid }}</div>
            <div class="mc-row-sub">申请加入本群</div>
          </div>
          <button class="mc-mini ok" @click="auditRoom(ra, true)">通过</button>
          <button class="mc-mini no" @click="auditRoom(ra, false)">拒绝</button>
        </div>
        <input v-model="manageUid" class="mc-input" placeholder="输入用户 UID 禁言/踢人" />
        <div class="mc-modal-btns">
          <button class="mc-mini ok" :disabled="!manageUid" @click="banRoom(manage, true)">🔇 禁言</button>
          <button class="mc-mini no" :disabled="!manageUid" @click="kickRoom(manage)">👢 踢出</button>
        </div>
        <button class="mc-btn ghost" @click="manage = null" style="margin-top:8px">关闭</button>
      </div>
    </div>


    <!-- 商家详情弹窗 -->
    <div v-if="bizDetail" class="mc-mask" @click.self="bizDetail = null">
      <div class="mc-modal">
        <div class="mc-modal-title">🏪 {{ bizDetail.bizName || bizDetail.shopName }}</div>
        <p class="mc-modal-tip">{{ bizDetail.desc || bizDetail.content || '该商家暂未填写简介' }}</p>
        <p class="mc-modal-tip">👍 {{ bizDetail.good || 0 }} 👎 {{ bizDetail.bad || 0 }} 🔥 {{ bizDetail.heat || 0 }}</p>
        <button class="mc-btn ghost" @click="bizDetail = null">关闭</button>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast, mobileToken } from '~/composables/useMobileApi'
import MCityAutonomy from './MCityAutonomy.vue'


const emit = defineEmits<{ (e: 'open-group', g: any): void; (e: 'open-room', r: any): void; (e: 'open-tickets'): void }>()


const tabs = [
  { k: 'grupao', name: '群聊' },
  { k: 'siyu', name: '私域' },
  { k: 'shequ', name: '社区' },
  { k: 'shangjia', name: '商家' },
  { k: 'zizhi', name: '自治' },
]
const tab = ref('grupao')


// ── 城市 ──
const cities = ref<any[]>([])
const cityId = ref('')
const myCity = computed(() => cities.value.find((c) => c.id === cityId.value))
const myCityName = computed(() => myCity.value?.name || '')
const isLeader = computed(() => myCity.value && (myCity.value.myRole === 'agent' || myCity.value.myRole === 'admin'))
const myRole = computed(() => myCity.value?.myRole || '')
async function loadCities() {
  try {
    const r = await mobileAuthFetch('/api/city/list')
    const j = await r.json()
    const d = j.data || j
    cities.value = d.cities || []
    if (!cityId.value && cities.value.length) cityId.value = cities.value[0].id
  } catch { /* ignore */ }
}
function onCityChange() {
  loadRooms()
  loadPosts()
  loadBiz()
  loadShopList()
  loadShopProducts()
  loadCityApplies()
}
// 城市总群：所有会员聊天频道
function openCityPub(c: any) {
  emit('open-group', { id: 'city_' + c.id + '_pub', type: 4, name: c.name + ' · 总群', kind: 'public-city', cityId: c.id })
}


// ── 城市代理申请 ──
const showAgent = ref(false)
const agentCities = ref<string[]>([])
const agent = ref({ companyName: '', companyLocation: '', companyScale: '', cityName: '', contactName: '', contactPhone: '' })
const agentSubmitting = ref(false)
async function openAgentApply() {
  showAgent.value = true
  try { const r = await mobileAuthFetch('/api/tea/agent/cities'); const j = await r.json(); const d = j.data || j; agentCities.value = d.cities || [] } catch { agentCities.value = [] }
}
async function submitAgentApply() {
  const a = agent.value
  if (!a.companyName || !a.companyLocation || !a.companyScale || !a.cityName || !a.contactName || !a.contactPhone) { mobileToast('请完整填写申请表'); return }
  agentSubmitting.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/agent/apply', { method: 'POST', body: JSON.stringify(a) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 申请已提交，请保持电话畅通'); showAgent.value = false }
    else mobileToast('❌ ' + (j.error || '提交失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { agentSubmitting.value = false }
}


// ── 私域 ──
const rooms = ref<any[]>([])
const claims = ref<any[]>([])
const showClaim = ref(false)
const claimName = ref('')
const claiming = ref(false)
function uidSelf(): string {
  try { const u = JSON.parse(window.localStorage?.getItem('auth_user') || '{}'); return u.id || u.uid || '' } catch { return '' }
}
async function loadRooms() {
  if (!cityId.value) return
  try {
    const r = await mobileAuthFetch('/api/city/rooms?cityId=' + cityId.value)
    const j = await r.json()
    const d = j.data || j
    const myUid = uidSelf()
    rooms.value = (d.rooms || []).map((x: any) => ({ ...x, isOwner: x.ownerUid === myUid && myUid !== '', canManage: (x.ownerUid === myUid && myUid !== '') || isLeader.value }))
    if (isLeader.value) loadClaims()
  } catch { /* ignore */ }
}
async function loadClaims() {
  if (!cityId.value) return
  try {
    const r = await mobileAuthFetch('/api/city/room/claims?cityId=' + cityId.value)
    const j = await r.json()
    const d = j.data || j
    claims.value = d.claims || []
  } catch { claims.value = [] }
}
function openClaim() { showClaim.value = true }
async function submitClaim() {
  if (!claimName.value.trim()) { mobileToast('请输入群名称'); return }
  claiming.value = true
  try {
    const r = await mobileAuthFetch('/api/city/room/claim', { method: 'POST', body: JSON.stringify({ cityId: cityId.value, name: claimName.value.trim() }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已提交开群申请，等待总群管理员审核'); showClaim.value = false; claimName.value = ''; loadRooms() }
    else mobileToast('❌ ' + (j.error || '提交失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { claiming.value = false }
}
async function auditClaim(cl: any, approve: boolean) {
  try {
    const r = await mobileAuthFetch('/api/city/room/claims/' + cl.id, { method: 'POST', body: JSON.stringify({ approve }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast(approve ? '✅ 已通过，私域群已创建' : '已拒绝'); loadClaims(); loadRooms() }
    else mobileToast('❌ ' + (j.error || '操作失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
async function applyRoom(r: any) {
  try {
    const rr = await mobileAuthFetch('/api/city/room/apply', { method: 'POST', body: JSON.stringify({ roomId: r.id }) })
    const j = await rr.json()
    if (rr.ok && j.success) { mobileToast('✅ 已提交入群申请'); r.myStatus = 'pending' }
    else mobileToast('❌ ' + (j.error || '申请失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
function onRoom(r: any) {
  if (r.myStatus === 'active') emit('open-room', r)
  else if (r.myStatus === 'pending') mobileToast('⏳ 申请审核中')
  else applyRoom(r)
}
// 群主管理
const manage = ref<any>(null)
const manageUid = ref('')
const roomApplies = ref<any[]>([])
function openManage(r: any) { manage.value = { ...r }; manageUid.value = ''; loadRoomApplies(r) }
async function loadRoomApplies(r: any) {
  roomApplies.value = []
  if (!r || !r.id) return
  try {
    const rr = await mobileAuthFetch('/api/city/room/applies?roomId=' + r.id)
    const j = await rr.json()
    const d = j.data || j
    roomApplies.value = d.applies || []
  } catch { roomApplies.value = [] }
}
async function auditRoom(ra: any, approve: boolean) {
  if (!manage.value?.id) return
  try {
    const rr = await mobileAuthFetch('/api/city/room/applies/' + ra.uid, { method: 'POST', body: JSON.stringify({ roomId: manage.value.id, approve }) })
    const j = await rr.json()
    if (rr.ok && j.success) { mobileToast(approve ? '✅ 已通过加入' : '已拒绝'); loadRoomApplies(manage.value) }
    else mobileToast('❌ ' + (j.error || '操作失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
// 城市入城审核
const cityApplies = ref<any[]>([])
async function loadCityApplies() {
  cityApplies.value = []
  if (!cityId.value || !isLeader.value) return
  try {
    const rr = await mobileAuthFetch('/api/city/applies?cityId=' + cityId.value)
    const j = await rr.json()
    const d = j.data || j
    cityApplies.value = d.applies || []
  } catch { cityApplies.value = [] }
}
async function auditCity(ap: any, approve: boolean) {
  try {
    const rr = await mobileAuthFetch('/api/city/applies/' + ap.uid, { method: 'POST', body: JSON.stringify({ cityId: cityId.value, approve }) })
    const j = await rr.json()
    if (rr.ok && j.success) { mobileToast(approve ? '✅ 已通过入城' : '已拒绝'); loadCityApplies() }
    else mobileToast('❌ ' + (j.error || '操作失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
async function toggleRoom(r: any, key: string) {
  const body: any = {}; body[key] = !r[key]
  try {
    const rr = await mobileAuthFetch('/api/city/room/' + r.id + '/settings', { method: 'POST', body: JSON.stringify(body) })
    const j = await rr.json()
    if (rr.ok && j.success) { mobileToast('已更新'); r[key] = !r[key]; if (manage.value) manage.value[key] = !manage.value[key] }
    else mobileToast('❌ ' + (j.error || '失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
async function banRoom(r: any, muted: boolean) {
  if (!manageUid.value.trim()) return
  try { const rr = await mobileAuthFetch('/api/city/room/' + r.id + '/ban', { method: 'POST', body: JSON.stringify({ targetUid: manageUid.value.trim(), muted }) }); const j = await rr.json(); rr.ok && j.success ? mobileToast('✅ 已禁言') : mobileToast('❌ ' + (j.error || '失败')) } catch { mobileToast('⚠ 网络错误') }
}
async function kickRoom(r: any) {
  if (!manageUid.value.trim()) return
  try { const rr = await mobileAuthFetch('/api/city/room/' + r.id + '/kick', { method: 'POST', body: JSON.stringify({ targetUid: manageUid.value.trim() }) }); const j = await rr.json(); rr.ok && j.success ? (mobileToast('👢 已踢出'), loadRooms()) : mobileToast('❌ ' + (j.error || '失败')) } catch { mobileToast('⚠ 网络错误') }
}


// ── 社区（会员发帖）──
const posts = ref<any[]>([])
const showPost = ref(false)
const postTitle = ref('')
const postContent = ref('')
const posting = ref(false)
const commentOn = ref<any>(null)
const commentText = ref('')
const commenting = ref(false)
async function loadPosts() {
  if (!cityId.value) return
  try {
    const r = await mobileAuthFetch('/api/city/posts?cityId=' + cityId.value)
    const j = await r.json()
    const d = j.data || j
    posts.value = d.posts || d.list || []
  } catch { posts.value = [] }
}
function openPostNew() { showPost.value = true; postTitle.value = ''; postContent.value = '' }
const linkPickerOpen = ref(false)
function openLinkPicker() { linkPickerOpen.value = true }
function insertLink(type: string, id: string, name: string) {
  const tag = `[${type}:${id}:${name}]`
  postContent.value = (postContent.value || '') + tag
  linkPickerOpen.value = false
  mobileToast('✅ 链接已插入')
}
function parsePostContent(content: string) {
  if (!content) return []
  const parts: Array<{ type: 'text'; text: string } | { type: 'link'; linkType: string; id: string; name: string }> = []
  const regex = /\[(\w+):([\w-]+):([^\]]+)\]/g
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIdx) parts.push({ type: 'text', text: content.slice(lastIdx, match.index) })
    parts.push({ type: 'link', linkType: match[1], id: match[2], name: match[3] })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < content.length) parts.push({ type: 'text', text: content.slice(lastIdx) })
  return parts
}

function navigateToLink(part: any) {
  if (part.linkType === 'shop') {
    // Navigate to shop detail
    const s = { id: part.id, shopName: part.name }
    openShopDetail(s)
  } else if (part.linkType === 'product') {
    // Navigate to product detail
    const p = { id: part.id, name: part.name }
    openProductDetail(p)
  }
}

async function submitPost() {
  if (!postContent.value.trim()) { mobileToast('请输入内容'); return }
  posting.value = true
  try {
    const r = await mobileAuthFetch('/api/city/post', { method: 'POST', body: JSON.stringify({ cityId: cityId.value, title: postTitle.value.trim(), content: postContent.value.trim() }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已发布'); showPost.value = false; loadPosts() }
    else mobileToast('❌ ' + (j.error || '发布失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { posting.value = false }
}
async function likePost(p: any) {
  try {
    const r = await mobileAuthFetch('/api/city/post/' + p.id + '/like', { method: 'POST' })
    const j = await r.json()
    if (r.ok && j.success) { p.likes = (p.likes || p.likeCount || 0) + 1; mobileToast('👍 已点赞') }
    else mobileToast('❌ ' + (j.error || '操作失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
async function openComment(p: any) {
  commentOn.value = { ...p, comments: p.comments || p.commentList || [] }
  commentText.value = ''
}
// 帖子详情（3行截断点开看全文）
const postDetail = ref<any>(null)
function openPostDetail(p: any) { postDetail.value = { ...p } }
// AI 编写（VIP）
const isVip = ref(false)
const aiOpen = ref(false)
const aiMode = ref('create')
const aiPrompt = ref('')
const aiResult = ref('')
const aiBusy = ref(false)
function openAiPost() {
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
function useAi() {
  if (aiResult.value) { postContent.value = aiResult.value; aiOpen.value = false; mobileToast('✅ 已填入发帖框') }
}
async function submitComment() {
  if (!commentText.value.trim() || !commentOn.value) return
  commenting.value = true
  try {
    const r = await mobileAuthFetch('/api/city/post/' + commentOn.value.id + '/comment', { method: 'POST', body: JSON.stringify({ content: commentText.value.trim() }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已评论'); commentOn.value = null; loadPosts() }
    else mobileToast('❌ ' + (j.error || '评论失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { commenting.value = false }
}
async function delPost(p: any) {
  if (!confirm('确定删除该帖子？')) return
  try {
    const r = await mobileAuthFetch('/api/city/post/' + p.id + '/delete', { method: 'POST' })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('🗑 已删除'); loadPosts() } else mobileToast('❌ ' + (j.error || '删除失败'))
  } catch { mobileToast('⚠ 网络错误') }
}


// ── 商家（城市攻略）──
const bizPosts = ref<any[]>([])
const showBiz = ref(false)
const bizName = ref('')
const bizDesc = ref('')
const bizSubmitting = ref(false)
const bizDetail = ref<any>(null)
async function loadBiz() {
  if (!cityId.value) return
  try {
    const r = await mobileAuthFetch('/api/city/biz/posts?cityId=' + cityId.value)
    const j = await r.json()
    const d = j.data || j
    bizPosts.value = d.posts || d.list || []
  } catch { bizPosts.value = [] }
}


// ── 商家列表 + 店铺详情 ──
const shopList = ref<any[]>([])
const shopDetail = ref<any>(null)
const shopDetailProducts = ref<any[]>([])
async function loadShopList() {
  if (!cityId.value) return
  try {
    const r = await mobileAuthFetch('/api/city/biz/shops?cityId=' + cityId.value)
    const j = await r.json(); const d = j.data || j
    shopList.value = d.shops || []
  } catch { shopList.value = [] }
}
async function openShopDetail(s: any) {
  shopDetail.value = s
  shopDetailProducts.value = []
  try {
    const r = await mobileAuthFetch('/api/city/biz/shop/' + s.id + '?cityId=' + cityId.value)
    const j = await r.json(); const d = j.data || j
    if (d.shop) shopDetail.value = d.shop
    if (d.products) shopDetailProducts.value = d.products
  } catch { /* ignore */ }
}
function copyShopLink() {
  if (!shopDetail.value) return
  const link = location.origin + '/shop/' + shopDetail.value.id
  navigator.clipboard.writeText(link).then(() => mobileToast('✅ 店铺链接已复制')).catch(() => mobileToast('⚠ 复制失败'))
}
function copyProductLink(p: any) {
  const link = location.origin + '/product/' + p.id
  navigator.clipboard.writeText(link).then(() => mobileToast('✅ 商品链接已复制')).catch(() => mobileToast('⚠ 复制失败'))
}


// ── 易货商城(商品缩略图网格 + 详情 + 兑换) ──
const shopProductsGrid = ref<any[]>([])
async function loadShopProducts() {
  if (!cityId.value) return
  try { const r = await mobileAuthFetch('/api/city/biz/products?cityId=' + cityId.value); const j = await r.json(); const d = j.data || j; shopProductsGrid.value = d.products || [] } catch { shopProductsGrid.value = [] }
}
const prodDetail = ref<any>(null)
const prodRefShopId = ref<string>('')
const galleryIdx = ref(0)
const imagePreview = ref<string[]>([])
const imagePreviewIdx = ref(0)


const prodDetailImages = computed(() => {
  if (!prodDetail.value) return []
  const imgs = prodDetail.value.images
  if (Array.isArray(imgs) && imgs.length) return imgs
  const cover = prodDetail.value.cover
  return cover ? [cover] : []
})


function openProductDetail(p: any, shopId?: string) {
  prodDetail.value = { ...p, buying: false }
  prodRefShopId.value = shopId || ''
  galleryIdx.value = 0
}


function openImagePreview(images: string[], idx: number) {
  imagePreview.value = images
  imagePreviewIdx.value = idx
}
async function buyProduct(p: any) {
  if (p.buying) return
  if (!confirm('用工分 ' + p.priceTea + ' 兑换「' + p.name + '」？\n工分将冻结平台托管，获得银票核销券（我的空间→银票），线下到店核销提货。')) return
  p.buying = true
  try {
    const body: any = { cityId: cityId.value, productId: p.id }
    if (p.ref) body.ref = p.ref
    const r = await mobileAuthFetch('/api/city/shop/order/create', { method: 'POST', body: JSON.stringify(body) })
    const j = await r.json()
    if (r.ok && j.success) {
      mobileToast('✅ 兑换成功，银票已放入卡包「我的空间→银票」')
      prodDetail.value = null
      loadShopProducts()
      // 如果来自店铺详情，刷新店铺产品
      if (shopDetail.value) {
        const sr = await mobileAuthFetch('/api/city/biz/shop/' + shopDetail.value.id + '?cityId=' + cityId.value)
        const sj = await sr.json(); const sd = sj.data || sj
        if (sd.products) shopDetailProducts.value = sd.products
      }
    }
    else mobileToast('❌ ' + (j.error || '兑换失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { p.buying = false }
}


// ---- 我的店铺(商家上架/编辑/删除) ----
const myShopOpen = ref(false)
const myShop = ref<any>({ shopName: '', id: '', products: [] })
function openBizApply() {
  showBiz.value = true
}
async function submitBiz() {
  if (!bizName.value.trim()) { mobileToast('请输入商家/店铺名称'); return }
  bizSubmitting.value = true
  try {
    const r = await mobileAuthFetch('/api/city/biz/apply', {
      method: 'POST',
      body: JSON.stringify({ cityId: cityId.value, shopName: bizName.value.trim(), bizDesc: bizDesc.value.trim(), licensePic: '', venuePic: '', banner: '', lat: 0, lng: 0, address: '' })
    })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 入驻申请已提交，等待审核'); showBiz.value = false; bizName.value = ''; bizDesc.value = '' }
    else mobileToast('❌ ' + (j.error || '提交失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { bizSubmitting.value = false }
}

async function openMyShop() {
  myShopOpen.value = true
  try {
    const r = await mobileAuthFetch('/api/city/biz/shop/me?cityId=' + cityId.value)
    const j = await r.json(); const d = j.data || j
    if (d.shop) myShop.value = { ...d.shop, products: d.products || [] }
    else myShop.value = { shopName: '', id: '', products: [] }
  } catch { myShop.value = { shopName: '', id: '', products: [] } }
}
async function saveShopProfile() {
  try {
    const r = await mobileAuthFetch('/api/city/biz/shop/update', { method: 'POST', body: JSON.stringify({ cityId: cityId.value, phone: myShop.value.phone || '', intro: myShop.value.intro || '' }) })
    const j = await r.json()
    if (r.ok && j.success) mobileToast('✅ 店铺资料已保存')
    else mobileToast('❌ ' + (j.error || '保存失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
const prodEdit = ref<any>(null)
const prodSaving = ref(false)
const prodImageTarget = ref<'product' | 'detail'>('product')
function openProdEdit(p: any) {
  if (p) {
    prodEdit.value = { ...p, images: Array.isArray(p.images) ? [...p.images] : [], detailImages: Array.isArray(p.detailImages) ? [...p.detailImages] : [], commissionRate: p.commissionRate || 0 }
  } else {
    prodEdit.value = { id: '', cityId: cityId.value, name: '', cover: '', images: [], detailImages: [], prodDesc: '', priceTea: '', stock: '', standard: '', licenseNo: '', manufacturer: '', barcode: '', origin: '', netWeight: '', shelfLife: '', storage: '', commissionRate: 0 }
  }
}
function pickCover() {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'image/*'
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return
    try {
      const fd = new FormData(); fd.append('file', f)
      const up = await fetch('/api/im/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + mobileToken() }, body: fd })
      const j = await up.json()
      if (j.success && j.data?.url) { prodEdit.value.cover = j.data.url; mobileToast('✅ 封面上传成功') }
      else mobileToast('❌ ' + (j.error || '上传失败'))
    } catch { mobileToast('⚠ 上传失败') }
  }
  inp.click()
}
function pickProdImage() {
  prodImageTarget.value = 'product'
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true
  inp.onchange = async () => {
    const files = inp.files; if (!files || !files.length) return
    for (let i = 0; i < Math.min(files.length, 9 - prodEdit.value.images.length); i++) {
      const f = files[i]
      try {
        const fd = new FormData(); fd.append('file', f)
        const up = await fetch('/api/im/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + mobileToken() }, body: fd })
        const j = await up.json()
        if (j.success && j.data?.url) { prodEdit.value.images.push(j.data.url); mobileToast('✅ 已添加') }
      } catch { mobileToast('⚠ 上传失败') }
    }
  }
  inp.click()
}
function pickDetailImage() {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true
  inp.onchange = async () => {
    const files = inp.files; if (!files || !files.length) return
    for (let i = 0; i < Math.min(files.length, 20 - prodEdit.value.detailImages.length); i++) {
      const f = files[i]
      try {
        const fd = new FormData(); fd.append('file', f)
        const up = await fetch('/api/im/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + mobileToken() }, body: fd })
        const j = await up.json()
        if (j.success && j.data?.url) { prodEdit.value.detailImages.push(j.data.url); mobileToast('✅ 已添加') }
      } catch { mobileToast('⚠ 上传失败') }
    }
  }
  inp.click()
}
async function saveProd() {
  const e = prodEdit.value; if (!e) return
  if (!e.name?.trim()) { mobileToast('请输入商品名称'); return }
  const price = Math.floor(Number(e.priceTea) || 0)
  if (price < 1) { mobileToast('价格至少 1 工分'); return }
  prodSaving.value = true
  try {
    const isEdit = !!e.id
    const common = { name: e.name.trim(), cover: e.cover, images: e.images, detailImages: e.detailImages, prodDesc: e.prodDesc || '', priceTea: price, stock: Math.floor(Number(e.stock) || 0), standard: e.standard || '', licenseNo: e.licenseNo || '', manufacturer: e.manufacturer || '', barcode: e.barcode || '', origin: e.origin || '', netWeight: e.netWeight || '', shelfLife: e.shelfLife || '', storage: e.storage || '', commissionRate: Math.min(100, Math.max(0, Math.floor(Number(e.commissionRate) || 0))) }
    const body = isEdit ? { productId: e.id, ...common } : { cityId: cityId.value, ...common }
    const r = await mobileAuthFetch('/api/city/biz/product/' + (isEdit ? 'update' : 'add'), { method: 'POST', body: JSON.stringify(body) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast(isEdit ? '✅ 已保存' : '✅ 已上架'); prodEdit.value = null; openMyShop(); loadShopProducts() }
    else mobileToast('❌ ' + (j.error || '保存失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { prodSaving.value = false }
}
async function delMyProd(p: any) {
  if (!confirm('确定删除商品「' + p.name + '」？')) return
  try {
    const r = await mobileAuthFetch('/api/city/biz/product/delete', { method: 'POST', body: JSON.stringify({ productId: p.id }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('🗑 已删除'); openMyShop(); loadShopProducts() } else mobileToast('❌ ' + (j.error || '删除失败'))
  } catch { mobileToast('⚠ 网络错误') }
}
function absCover(u: string) {
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  return 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u)
}


function roleLabel(r: string) { return ({ agent: '代理商', admin: '管理员', member: '会员', pending: '待审核', none: '未加入' } as any)[r] || r || '' }
function hideImg(e: any) { try { e.target.style.display = 'none' } catch { /* ignore */ } }


onMounted(() => {
  loadCities().then(() => {
    loadRooms(); loadPosts(); loadBiz(); loadShopList(); loadShopProducts(); loadCityApplies()
    // URL 路由：处理 /shop/{id} 和 /product/{id} 分享链接
    const path = location.pathname
    const shopMatch = path.match(/^\/shop\/([\w-]+)$/)
    const prodMatch = path.match(/^\/product\/([\w-]+)$/)
    if (shopMatch) {
      const bizId = shopMatch[1]
      // 切换到商家 tab 并加载店铺详情
      tab.value = 'shangjia'
      setTimeout(() => {
        loadShopList()
        const s = { id: bizId, shopName: '店铺' }
        openShopDetail(s)
      }, 500)
    } else if (prodMatch) {
      const prodId = prodMatch[1]
      tab.value = 'shangjia'
      setTimeout(() => {
        loadShopProducts()
        const p = { id: prodId, name: '商品' }
        openProductDetail(p)
      }, 500)
    }
  })
  loadVip()
})
async function loadVip() {
  try {
    const r = await mobileAuthFetch('/api/auth/me')
    const j = await r.json(); const d = j.data || j
    // ⭐ auth/me: data.user.memberTier / data.user.membership.tier
    const tier = d?.user?.memberTier || d?.user?.membership?.tier || d?.memberTier || d?.membership?.tier || ''
    isVip.value = !!tier && !['free', 'basic'].includes(String(tier))
  } catch { isVip.value = false }
}
</script>


<style scoped>
.mc-tabs { display: flex; background: #fff; border-radius: 10px; padding: 4px; margin-bottom: 12px; gap: 4px; }
.mc-tab { flex: 1; padding: 8px 0; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-weight: 600; color: #666; }
.mc-tab.on { background: #6366f1; color: #fff; }
.mc-agent-btn { width: 100%; padding: 9px; border: 1px dashed #c7d2fe; background: #eef2ff; color: #6366f1; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 10px; cursor: pointer; }
.mc-sec-title { font-size: 13px; font-weight: 700; color: #374151; margin: 12px 0 8px; }
.mc-zizhi-sub { font-size: 11px; font-weight: 500; color: #9ca3af; margin-left: 6px; }
.mc-empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 24px 0; }
.mc-row { display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
.mc-avatar { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; background: #eef2ff; flex-shrink: 0; }
.mc-avatar.is-group { background: #eef2ff; }
.mc-avatar.is-public { background: #fef3c7; }
.mc-row-main { flex: 1; min-width: 0; }
.mc-row-name { font-size: 15px; font-weight: 600; color: #111827; }
.mc-row-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.mc-arrow { color: #c0c4cc; font-size: 18px; }
.mc-owner { display: inline-block; margin-left: 6px; font-size: 11px; color: #6366f1; background: #eef2ff; padding: 1px 6px; border-radius: 6px; }
.mc-btn { width: 100%; padding: 11px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 8px; }
.mc-btn.primary { background: linear-gradient(135deg, #38bdf8, #6366f1); color: #fff; }
.mc-btn.ghost { background: #fff; color: #6366f1; border: 1px solid #c7d2fe; }
.mc-mini { font-size: 12px; padding: 5px 10px; border-radius: 8px; border: none; background: #eef2ff; color: #6366f1; flex-shrink: 0; font-weight: 600; }
.mc-mini.ok { background: #d1fae5; color: #059669; }
.mc-mini.no { background: #fee2e2; color: #dc2626; }
.mc-mini:disabled { opacity: .5; }
.mc-citybar { margin-bottom: 8px; }
.mc-citysel { width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: #fff; }
.mc-post { background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
.mc-post-head { display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; margin-bottom: 6px; }
.mc-post-author { color: #6366f1; font-weight: 600; }
.mc-post-title { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px; }
.mc-post-content { font-size: 13px; color: #374151; line-height: 1.7; word-break: break-word; }
.mc-post-imgs { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.mc-post-img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; }
.mc-post { cursor: pointer; }
.mc-clamp3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mc-post-more { margin-left: auto; font-size: 12px; color: #6366f1; }
.mc-post-content-full { font-size: 14px; color: #374151; line-height: 1.8; word-break: break-word; white-space: pre-wrap; }
.mc-ai-tabs { display: flex; gap: 8px; margin-bottom: 8px; }
.mc-ai-tab { flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; font-size: 13px; }
.mc-ai-tab.on { border-color: #6366f1; background: #eef2ff; color: #6366f1; font-weight: 600; }
.mc-ai-result { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; font-size: 13px; color: #374151; line-height: 1.7; margin-bottom: 8px; max-height: 160px; overflow-y: auto; white-space: pre-wrap; }
.mc-btn.sm { width: auto; padding: 9px 14px; }
.mc-post-foot { display: flex; gap: 8px; margin-top: 10px; }
.mc-input { width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; box-sizing: border-box; }
.mc-form-group { margin-bottom: 8px; }
.mc-form-label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
.mc-form-row { display: flex; gap: 8px; }
.mc-form-row .mc-form-group { flex: 1; }
.mc-textarea { min-height: 90px; resize: none; }
.mc-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 70; display: flex; align-items: center; justify-content: center; padding: 20px; }
.mc-modal { background: #fff; border-radius: 14px; padding: 18px; width: 100%; max-width: 340px; }
.mc-modal-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
.mc-modal-tip { font-size: 12px; color: #6b7280; margin: 4px 0 10px; line-height: 1.6; }
.mc-modal.mc-modal-scroll { max-height: 82vh; overflow-y: auto; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; }
.mc-modal-btns { display: flex; gap: 8px; margin-top: 4px; }
.mc-modal-btns .mc-btn { margin-top: 0; }
.mc-swrow { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
.mc-comment-list { max-height: 180px; overflow-y: auto; margin-bottom: 8px; }
.mc-comment-item { font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
.mc-comment-auth { color: #6366f1; font-weight: 600; }
.mc-like-users { font-size: 12px; color: #8a7a5c; margin: 8px 0 4px; line-height: 1.6; }
.mc-btn-row { display: flex; gap: 8px; }
.mc-btn-row .mc-btn { flex: 1; margin-top: 8px; }
.mc-prod { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
.mc-prod-info { flex: 1; min-width: 0; }
.mc-prod-name { font-size: 14px; font-weight: 600; }
.mc-prod-desc { font-size: 12px; color: #6b7280; margin-top: 2px; }
.mc-prod-price { font-size: 13px; color: #92400e; font-weight: 600; margin-top: 4px; }
.mc-prod-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mc-prod-card { background: #fff; border-radius: 10px; overflow: hidden; position: relative; }
.mc-prod-card-imgcount { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,.5); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 8px; }
.mc-prod-thumb { width: 100%; height: 90px; object-fit: cover; }
.mc-prod-thumb-ph { display: flex; align-items: center; justify-content: center; font-size: 28px; background: #f3f4f6; }
.mc-prod-card-name { font-size: 12px; padding: 6px 6px 0; color: #111827; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mc-prod-card-price { font-size: 12px; color: #92400e; font-weight: 700; padding: 2px 6px 8px; }
.mc-prod-detail-img { width: 100%; height: 180px; object-fit: cover; border-radius: 10px; margin-bottom: 8px; }
.mc-prod-detail-shop { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
.mc-prod-detail-row { display: flex; align-items: center; gap: 10px; margin: 6px 0 4px; }
.mc-prod-detail-price { font-size: 20px; font-weight: 800; color: #92400e; }
.mc-prod-detail-stock { font-size: 12px; color: #059669; }
.mc-prod-detail-stock.off { color: #dc2626; }
.mc-upload-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.mc-upload-thumb { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
.mc-prod-imgcount { font-size: 11px; color: #6b7280; margin-top: 2px; }
/* 商品详情画廊 */
.mc-prod-gallery { position: relative; overflow: hidden; border-radius: 10px; margin-bottom: 8px; background: #f3f4f6; }
.mc-prod-gallery-track { display: flex; transition: transform .3s ease; }
.mc-prod-gallery-slide { min-width: 100%; box-sizing: border-box; }
.mc-prod-gallery-slide .mc-prod-detail-img { width: 100%; height: 220px; object-fit: cover; border-radius: 0; margin-bottom: 0; cursor: pointer; }
.mc-prod-gallery-dots { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; }
.mc-prod-gallery-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.5); }
.mc-prod-gallery-dot.on { background: #fff; }
.mc-prod-gallery-counter { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,.5); color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 10px; }
/* 商品详情图 */
.mc-prod-detail-section { margin: 12px 0; }
.mc-prod-detail-section-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.mc-prod-detail-images { display: flex; flex-direction: column; gap: 4px; }
.mc-prod-detail-image { width: 100%; border-radius: 6px; cursor: pointer; }
.mc-prod-specs { background: #f9fafb; border-radius: 8px; padding: 10px 12px; }
.mc-prod-spec-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
.mc-prod-spec-row:last-child { border-bottom: none; }
.mc-prod-spec-key { color: #6b7280; flex-shrink: 0; }
.mc-prod-spec-val { color: #111827; text-align: right; word-break: break-all; }
/* 图片全屏预览 */
.mc-img-preview-mask { background: rgba(0,0,0,.9); z-index: 1000; }
.mc-img-preview-track { display: flex; height: 100%; transition: transform .3s ease; }
.mc-img-preview-slide { min-width: 100%; display: flex; align-items: center; justify-content: center; }
.mc-img-preview-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.mc-img-preview-counter { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); color: #fff; font-size: 14px; }
.mc-img-preview-close { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,.2); border: none; color: #fff; font-size: 18px; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; }
.mc-img-preview-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,.2); border: none; color: #fff; font-size: 28px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; }
.mc-img-preview-nav.prev { left: 12px; }
.mc-img-preview-nav.next { right: 12px; }
/* 多图上传 */
.mc-multi-upload { margin-bottom: 8px; }
.mc-multi-upload-label { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
.mc-multi-upload-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.mc-multi-upload-item { position: relative; aspect-ratio: 1; }
.mc-multi-upload-thumb { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }
.mc-multi-upload-del { position: absolute; top: -4px; right: -4px; width: 18px; height: 18px; border-radius: 50%; background: #dc2626; color: #fff; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.mc-multi-upload-add { aspect-ratio: 1; border: 2px dashed #d1d5db; border-radius: 6px; background: #f9fafb; font-size: 24px; color: #9ca3af; cursor: pointer; }
.mc-myprod-thumb { width: 42px; height: 42px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }

/* 商家列表卡片 */
.mc-shop-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; }
.mc-shop-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); cursor: pointer; transition: transform .2s, box-shadow .2s; }
.mc-shop-card:active { transform: scale(.98); box-shadow: 0 1px 4px rgba(0,0,0,.1); }
.mc-shop-banner { width: 100%; height: 100px; overflow: hidden; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.mc-shop-banner-img { width: 100%; height: 100%; object-fit: cover; }
.mc-shop-banner-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff; }
.mc-shop-card-body { padding: 10px 12px; }
.mc-shop-card-name { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; line-height: 1.3; }
.mc-shop-card-addr { font-size: 11px; color: #6b7280; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-shop-card-phone { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
.mc-shop-card-stats { display: flex; gap: 6px; flex-wrap: wrap; }
.mc-shop-card-tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #f3f4f6; color: #374151; }
.mc-shop-detail .mc-shop-banner { height: 160px; }
.mc-shop-detail-body { padding: 16px; }
.mc-shop-contact { margin: 8px 0; padding: 8px 12px; background: #f9fafb; border-radius: 8px; }
.mc-shop-contact-row { font-size: 13px; color: #374151; padding: 3px 0; }
.mc-shop-intro { font-size: 13px; color: #374151; margin: 8px 0; line-height: 1.6; background: #fffbeb; padding: 8px 12px; border-radius: 8px; border-left: 3px solid #f59e0b; }
.mc-shop-bizdesc { font-size: 12px; color: #6b7280; margin: 8px 0; line-height: 1.6; }
.mc-shop-review-bar { display: flex; gap: 8px; margin: 8px 0; }
.mc-shop-review { font-size: 12px; padding: 3px 8px; border-radius: 4px; background: #f3f4f6; color: #374151; }
.mc-shop-review.good { background: #d1fae5; color: #065f46; }
.mc-shop-review.bad { background: #fee2e2; color: #991b1b; }
.mc-prod-card-commission { font-size: 10px; color: #fff; background: #f59e0b; border-radius: 4px; padding: 2px 6px; display: inline-block; margin-top: 4px; }
.mc-form-hint { font-size: 11px; color: #6b7280; margin-top: 4px; }


/* 帖子内嵌链接 */
.mc-post-link { color: #6366f1; font-weight: 600; text-decoration: underline; cursor: pointer; }



</style>
