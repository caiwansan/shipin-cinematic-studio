<!--
  Sprint-MEDIA-CHANNEL-EXPANSION-05 — 商品运营（我的线上生意 · 产品表达）
  定位：未来重要商业入口（商品/订单/销售）——当前为产品蓝图
  纪律：零假数据——店铺 0 已连接 / 订单·咨询·销售 全部「等待连接」；禁止商品表/订单表/店铺账号表
  未来真实接入：Kunlun Identity → 用户授权 → 渠道连接服务 → AI 员工 Runtime
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="我的线上生意"
      title="商品运营"
      :status="{ text: '等待连接', type: 'warn' }"
      desc="连接电商店铺与客户渠道后，AI 员工将帮你分析商品表现、制作商品内容、关注客户反馈、发现销售机会。"
    />

    <!-- 线上生意概览（诚实：等待连接） -->
    <div class="sp-biz-grid">
      <div class="sp-biz-card">
        <div class="sp-biz-ico">🛍️</div>
        <div class="sp-biz-meta">
          <span class="sp-biz-label">商品店铺</span>
          <span class="sp-biz-num">0 个已连接</span>
        </div>
        <span class="sp-biz-sub">连接电商店铺后显示</span>
      </div>
      <div class="sp-biz-card">
        <div class="sp-biz-ico">🧾</div>
        <div class="sp-biz-meta">
          <span class="sp-biz-label">今日订单</span>
          <span class="sp-biz-num sp-biz-num--text">等待连接</span>
        </div>
        <span class="sp-biz-sub">连接电商店铺后统计</span>
      </div>
      <div class="sp-biz-card">
        <div class="sp-biz-ico">💬</div>
        <div class="sp-biz-meta">
          <span class="sp-biz-label">客户咨询</span>
          <span class="sp-biz-num sp-biz-num--text">等待连接</span>
        </div>
        <span class="sp-biz-sub">连接客服渠道后统计</span>
      </div>
      <div class="sp-biz-card">
        <div class="sp-biz-ico">📈</div>
        <div class="sp-biz-meta">
          <span class="sp-biz-label">销售数据</span>
          <span class="sp-biz-num sp-biz-num--text">等待连接</span>
        </div>
        <span class="sp-biz-sub">连接数据渠道后统计</span>
      </div>
    </div>

    <!-- 即将开放说明 -->
    <div class="sp-soon">
      <div class="sp-soon-ico">🚧</div>
      <div class="sp-soon-meta">
        <b>商品运营即将开放</b>
        <span>连接电商店铺后，这里将展示你的真实商品与订单数据。当前不展示任何预估数据。</span>
      </div>
    </div>

    <!-- AI 员工将如何帮你运营商品 -->
    <div class="sp-sec">
      <div class="sp-sec-title">🤖 连接店铺后，AI 员工将帮你</div>
      <div class="sp-helps-grid">
        <div v-for="h in helps" :key="h.title" class="sp-help">
          <span class="sp-help-ico">{{ h.ico }}</span>
          <div>
            <b>{{ h.title }}</b>
            <span class="sp-help-desc">{{ h.desc }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 电商渠道入口 -->
    <div class="sp-sec">
      <div class="sp-sec-head">
        <div class="sp-sec-title">🛒 可连接的电商店铺</div>
        <NuxtLink to="/workspace/media/accounts" class="sp-sec-link">渠道中心 →</NuxtLink>
      </div>
      <div class="sp-shop-grid">
        <div v-for="s in shops" :key="s.name" class="sp-shop" @click="goChannels">
          <span class="sp-shop-ico">{{ s.icon }}</span>
          <div class="sp-shop-meta">
            <span class="sp-shop-name">{{ s.name }}</span>
            <span class="sp-shop-plan">{{ s.plan }}</span>
          </div>
          <span class="sp-shop-state">
            <span class="sp-shop-dot"></span>
            未连接
          </span>
        </div>
      </div>
    </div>

    <!-- 连接路径说明 -->
    <div class="sp-path">
      <div class="sp-path-title">🔐 连接方式</div>
      <div class="sp-path-steps">
        <div v-for="(s, i) in path" :key="i" class="sp-path-step">
          <span class="sp-path-num">{{ i + 1 }}</span>
          <b>{{ s }}</b>
        </div>
      </div>
      <p class="sp-path-note">你的店铺账号由你自己授权管理，昆仑镜不会保存你的平台账号密码——AI 员工只在你授权范围内工作。</p>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'

const router = useRouter()

function goChannels() {
  router.push('/workspace/media/accounts')
}

const helps = [
  { ico: '📊', title: '分析商品表现', desc: '销量、转化、评价，自动生成商品报告' },
  { ico: '🎨', title: '制作商品内容', desc: '商品图、详情页、宣传素材一键产出' },
  { ico: '👀', title: '关注客户反馈', desc: '评价与咨询自动汇总，差评及时提醒' },
  { ico: '💰', title: '发现销售机会', desc: '高意向客户识别，促销时机建议' },
]

const shops = [
  { icon: '🛒', name: '淘宝店', plan: '商品销售 · 店铺运营' },
  { icon: '🛒', name: '京东店', plan: '商品销售 · 店铺运营' },
  { icon: '🛒', name: '拼多多店', plan: '商品销售 · 店铺运营' },
  { icon: '🛒', name: '抖音商城', plan: '短视频电商 · 直播带货' },
  { icon: '🛒', name: '美团店铺', plan: '本地生活 · 门店运营' },
  { icon: '🛒', name: '小红书店铺', plan: '种草转化 · 商品销售' },
]

const path = ['用户授权', '渠道连接服务', 'AI 员工 Runtime']
</script>

<style scoped>
/* ═══ 线上生意概览 ═══ */
.sp-biz-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.sp-biz-card {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 18px;
  border-radius: 15px;
  background: rgba(22, 32, 51, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.sp-biz-ico { font-size: 20px; }
.sp-biz-meta { display: flex; flex-direction: column; flex: 1; }
.sp-biz-label { font-size: 11px; color: #94a3b8; }
.sp-biz-num { font-size: 20px; font-weight: 800; color: #F1F5F9; letter-spacing: -0.02em; }
.sp-biz-num--text { font-size: 14px; line-height: 1.6; }
.sp-biz-sub { font-size: 9.5px; color: #64748b; align-self: flex-end; }

/* ═══ 即将开放 ═══ */
.sp-soon {
  display: flex; gap: 12px; align-items: center;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.25);
  margin-bottom: 22px;
}
.sp-soon-ico { font-size: 20px; }
.sp-soon-meta { display: flex; flex-direction: column; gap: 2px; }
.sp-soon-meta b { font-size: 12.5px; color: #fbbf24; }
.sp-soon-meta span { font-size: 11px; color: #94a3b8; line-height: 1.6; }

/* ═══ 区块 ═══ */
.sp-sec { margin-bottom: 26px; }
.sp-sec-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.sp-sec-title { font-size: 14px; font-weight: 800; color: #F1F5F9; margin-bottom: 14px; }
.sp-sec-head .sp-sec-title { margin-bottom: 0; }
.sp-sec-link { font-size: 11.5px; font-weight: 600; color: #94a3b8; text-decoration: none; }
.sp-sec-link:hover { color: #a5b4fc; }

/* ═══ AI 帮助 ═══ */
.sp-helps-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.sp-help {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 13px 14px;
  border-radius: 13px;
  background: rgba(22, 32, 51, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.26);
}
.sp-help-ico { font-size: 17px; }
.sp-help b { display: block; font-size: 12px; color: #F1F5F9; margin-bottom: 3px; }
.sp-help-desc { font-size: 10px; color: #64748b; line-height: 1.6; }

/* ═══ 电商店铺 ═══ */
.sp-shop-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.sp-shop {
  display: flex; align-items: center; gap: 11px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(22, 32, 51, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.28);
  cursor: pointer;
  transition: border-color 0.18s, transform 0.15s;
}
.sp-shop:hover { transform: translateY(-2px); border-color: rgba(245, 158, 11, 0.5); }
.sp-shop-ico { font-size: 20px; }
.sp-shop-meta { display: flex; flex-direction: column; flex: 1; }
.sp-shop-name { font-size: 12.5px; font-weight: 700; color: #F1F5F9; }
.sp-shop-plan { font-size: 9.5px; color: #64748b; }
.sp-shop-state {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 9.5px; font-weight: 700;
  color: #64748b;
}
.sp-shop-dot { width: 6px; height: 6px; border-radius: 50%; background: #475569; }

/* ═══ 连接路径 ═══ */
.sp-path {
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(22, 32, 51, 0.6);
  border: 1px solid rgba(59, 130, 246, 0.2);
}
.sp-path-title { font-size: 13px; font-weight: 800; color: #F1F5F9; margin-bottom: 12px; }
.sp-path-steps { display: flex; gap: 10px; flex-wrap: wrap; }
.sp-path-step {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11.5px; font-weight: 600; color: #94a3b8;
  padding: 7px 13px;
  border-radius: 999px;
  background: rgba(5, 8, 22, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.25);
}
.sp-path-num {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  font-size: 9px; font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #3B82F6, #2563EB);
}
.sp-path-note {
  margin: 12px 0 0;
  font-size: 10.5px; color: #64748b; line-height: 1.7;
}

@media (max-width: 1180px) {
  .sp-biz-grid, .sp-helps-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .sp-shop-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
