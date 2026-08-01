<!--
  Sprint-MEDIA-CHANNEL-EXPANSION-05 + MEDIA-DATA-CENTER-01 — 渠道中心（连接你的线上运营渠道 · 纯产品语言）
  升级：账号管理 → 渠道管理 → 渠道中心；内容/电商/客户 三类 Tabs
  纪律: 未连接态真实展示；不出现 API/Webhook/Token/OAuth/SDK 等技术词；零假数据
  微信: 真实接入流程保留（授权绑定 → 勾选权限 → 授权 AI 员工 → 完成连接）
  电商/客户渠道: 即将开放（诚实展示，不造假连接）
-->
<template>
  <MediaWorkspaceShell>
    <MediaPageHeader
      kicker="我的运营渠道"
      title="渠道中心"
      :status="{ text: '未连接', type: 'warn' }"
      desc="连接你的线上运营渠道，AI 员工才能帮你运营——发布内容、运营店铺、回复客户、读取数据。"
    />

    <!-- 分类 Tabs -->
    <div class="ac-tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="ac-tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        <span class="ac-tab-ico">{{ t.icon }}</span>
        {{ t.label }}
        <span class="ac-tab-count">{{ t.count }}</span>
      </button>
    </div>

    <!-- 渠道卡片 -->
    <div class="ac-grid">
      <div
        v-for="p in visiblePlatforms"
        :key="p.name"
        class="ac-card"
        :class="{ 'ac-card--shop': p.category === 'shop' }"
        @click="onClick(p)"
      >
        <div class="ac-card-top">
          <span class="ac-ico">{{ p.icon }}</span>
          <span class="ac-state off">
            <span class="ac-dot off"></span>
            未连接
          </span>
        </div>
        <div class="ac-name">{{ p.name }}</div>
        <div class="ac-plan">{{ p.plan }}</div>

        <!-- 连接后 AI 可以帮助（产品表达） -->
        <div v-if="p.helps && p.helps.length" class="ac-helps">
          <div class="ac-helps-title">连接后 AI 可以帮助</div>
          <div v-for="h in p.helps" :key="h" class="ac-help">
            <span class="ac-help-check">✓</span>{{ h }}
          </div>
        </div>

        <button v-if="p.connectable" class="ac-cta">{{ p.connected ? '已接入 AI 员工' : '去连接' }}</button>
        <span v-else class="ac-soon">即将开放</span>
      </div>
    </div>

    <!-- 连接价值说明 -->
    <div class="ac-note">
      <span class="ac-note-ico">🔗</span>
      <span><b>连接渠道后，AI 员工才能帮你运营</b>——自动发布内容、运营店铺、回复客户消息、读取运营数据。微信公众号已支持，电商与客户渠道正在接入。</span>
    </div>

    <!-- 微信连接流程（真实接入） -->
    <div v-if="activeTab === 'all' || activeTab === 'content'" class="ac-flow">
      <div class="ac-flow-head">
        <span class="ac-flow-ico">💬</span>
        <div>
          <div class="ac-flow-title">连接微信公众号</div>
          <div class="ac-flow-sub">企业认证服务号 · 4 步完成连接</div>
        </div>
      </div>
      <div class="ac-steps">
        <div v-for="(s, i) in steps" :key="i" class="ac-step">
          <span class="ac-step-num">{{ i + 1 }}</span>
          <div>
            <b>{{ s.title }}</b>
            <span class="ac-step-desc">{{ s.desc }}</span>
          </div>
        </div>
      </div>
      <button class="ac-connect-btn" @click="connect">开始连接 →</button>
    </div>

    <!-- AI 权限说明 -->
    <div class="ac-perms">
      <div class="ac-perms-title">🤖 AI 员工获得的权限</div>
      <div class="ac-perms-grid">
        <div v-for="p in perms" :key="p.key" class="ac-perm">
          <span class="ac-perm-ico">{{ p.ico }}</span>
          <div>
            <b>{{ p.name }}</b>
            <span class="ac-perm-sub">{{ p.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">

definePageMeta({ middleware: 'auth' })
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'
import MediaPageHeader from '~/components/media/MediaPageHeader.vue'

const { $toast } = useNuxtApp() as any

const activeTab = ref('all')

const tabs = computed(() => [
  { key: 'all', icon: '◉', label: '全部', count: allPlatforms.length },
  { key: 'content', icon: '📱', label: '内容平台', count: contentPlatforms.length },
  { key: 'shop', icon: '🛒', label: '电商平台', count: shopPlatforms.length },
  { key: 'customer', icon: '💬', label: '客户平台', count: customerPlatforms.length },
])

// ① 内容平台（品牌曝光）
const contentPlatforms = [
  { icon: '📱', name: '抖音', plan: '短视频 · 直播', category: 'content', connectable: false, connected: false },
  { icon: '📱', name: '快手', plan: '短视频 · 直播', category: 'content', connectable: false, connected: false },
  { icon: '📕', name: '小红书', plan: '种草图文 · 视频', category: 'content', connectable: false, connected: false },
  { icon: '🎬', name: '视频号', plan: '微信生态分发', category: 'content', connectable: false, connected: false },
  { icon: '💬', name: '微信公众号', plan: '图文 · 菜单服务', category: 'content', connectable: true, connected: false },
  { icon: '🌐', name: '微博', plan: '话题 · 图文', category: 'content', connectable: false, connected: false },
  { icon: '📰', name: '百家号', plan: '图文 · 视频', category: 'content', connectable: false, connected: false },
  { icon: '📰', name: '今日头条', plan: '图文 · 视频', category: 'content', connectable: false, connected: false },
]

// ② 电商店铺（商品销售）——连接后 AI 可以帮助（产品表达）
const shopPlatforms = [
  { icon: '🛒', name: '淘宝店', plan: '商品销售 · 店铺运营', category: 'shop', connectable: false, connected: false, helps: ['分析商品表现', '辅助制作商品内容', '关注客户反馈'] },
  { icon: '🛒', name: '京东店', plan: '商品销售 · 店铺运营', category: 'shop', connectable: false, connected: false, helps: ['商品运营分析', '内容推广建议', '客户服务辅助'] },
  { icon: '🛒', name: '拼多多店', plan: '商品销售 · 店铺运营', category: 'shop', connectable: false, connected: false, helps: ['商品推广分析', '活动运营建议'] },
  { icon: '🛒', name: '抖音商城', plan: '短视频电商 · 直播带货', category: 'shop', connectable: false, connected: false, helps: ['商品表现分析', '直播内容辅助', '客户反馈关注'] },
  { icon: '🛒', name: '美团店铺', plan: '本地生活 · 门店运营', category: 'shop', connectable: false, connected: false, helps: ['门店运营分析', '用户评价分析', '营销活动建议'] },
  { icon: '🛒', name: '小红书店铺', plan: '种草转化 · 商品销售', category: 'shop', connectable: false, connected: false, helps: ['种草内容辅助', '商品表现分析', '客户反馈关注'] },
]

// ③ 客户运营（客户沟通）
const customerPlatforms = [
  { icon: '🏢', name: '企业微信', plan: '私域客户运营', category: 'customer', connectable: false, connected: false, helps: ['自动回复客户', '客户标签管理', '营销活动触达'] },
  { icon: '💬', name: '微信客户', plan: '客户沟通 · 跟进', category: 'customer', connectable: false, connected: false, helps: ['客户沟通记录', '跟进提醒', '购买机会发现'] },
  { icon: '📞', name: '客服渠道', plan: '咨询接待 · 售后', category: 'customer', connectable: false, connected: false, helps: ['咨询自动接待', '售后处理辅助', '反馈汇总'] },
]

const allPlatforms = [...contentPlatforms, ...shopPlatforms, ...customerPlatforms]

const visiblePlatforms = computed(() => {
  if (activeTab.value === 'all') return allPlatforms
  return allPlatforms.filter((p: any) => p.category === activeTab.value)
})

const perms = [
  { key: 'publish', ico: '📤', name: '发布内容', desc: 'AI 员工代发图文与视频' },
  { key: 'reply', ico: '💬', name: '回复客户', desc: 'AI 员工接待客户消息' },
  { key: 'data', ico: '📊', name: '读取数据', desc: '阅读量、订单、粉丝、互动统计' },
]

const steps = [
  { title: '授权绑定', desc: '填写公众号授权信息，完成账号绑定' },
  { title: '勾选权限', desc: '选择发布内容、回复客户、读取数据' },
  { title: '授权 AI 员工', desc: '你的 AI 团队开始接管对应工作' },
  { title: '完成连接', desc: '连接成功，账号状态点亮' },
]

function onClick(p: any) {
  if (p.connected) return
  if (p.connectable) {
    connect()
  } else {
    $toast?.info?.(`「${p.name}」接入即将开放，先连接微信公众号体验完整流程`)
  }
}

function connect() {
  $toast?.info?.('微信资产接入等待掌柜提供授权信息（Sprint-MEDIA-01 遗留）')
}
</script>

<style scoped>
/* ═══ 分类 Tabs ═══ */
.ac-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.ac-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(71, 85, 105, 0.3);
  cursor: pointer;
  transition: all 0.16s;
}
.ac-tab:hover { color: #e2e8f0; border-color: rgba(129, 140, 248, 0.4); }
.ac-tab.active {
  color: #fff;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(99, 102, 241, 0.95));
  border-color: transparent;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.3);
}
.ac-tab-ico { font-size: 12px; }
.ac-tab-count {
  font-size: 9.5px;
  font-weight: 800;
  background: rgba(71, 85, 105, 0.3);
  border-radius: 999px;
  padding: 1px 7px;
}
.ac-tab.active .ac-tab-count { background: rgba(255, 255, 255, 0.18); }

/* ═══ 渠道卡片网格 ═══ */
.ac-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.ac-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 17px 18px;
  border-radius: 15px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(71, 85, 105, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: transform 0.15s, border-color 0.18s;
}
.ac-card:hover { transform: translateY(-2px); border-color: rgba(129, 140, 248, 0.4); }
.ac-card--shop { border-color: rgba(245, 158, 11, 0.22); }
.ac-card--shop:hover { border-color: rgba(245, 158, 11, 0.5); }
.ac-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.ac-ico { font-size: 24px; }
.ac-state {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 9.5px; font-weight: 700;
  border-radius: 999px; padding: 2px 9px;
}
.ac-state.on { color: #34d399; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); }
.ac-state.off { color: #94a3b8; background: rgba(71, 85, 105, 0.12); border: 1px solid rgba(71, 85, 105, 0.3); }
.ac-dot { width: 6px; height: 6px; border-radius: 50%; }
.ac-dot.on { background: #34d399; box-shadow: 0 0 6px #34d399; }
.ac-dot.off { background: #64748b; }
.ac-name { font-size: 14px; font-weight: 800; color: #f1f5f9; }
.ac-plan { font-size: 10px; color: #64748b; }

/* 连接后 AI 可以帮助 */
.ac-helps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px dashed rgba(71, 85, 105, 0.28);
}
.ac-helps-title { font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 0.04em; }
.ac-help {
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; color: #94a3b8;
}
.ac-help-check { color: #34d399; font-weight: 800; }

.ac-cta {
  margin-top: 10px;
  font-size: 11px; font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  border: none; border-radius: 9px; padding: 7px 0;
  cursor: pointer;
}
.ac-card.connected .ac-cta { background: rgba(16, 185, 129, 0.15); color: #34d399; cursor: default; }
.ac-soon {
  margin-top: 10px;
  font-size: 10px; font-weight: 600;
  color: #64748b;
  text-align: center;
  border: 1px dashed rgba(71, 85, 105, 0.4);
  border-radius: 9px; padding: 6px 0;
}

/* ═══ 价值说明 ═══ */
.ac-note {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 13px 16px;
  border-radius: 13px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(99, 102, 241, 0.2);
  font-size: 11.5px; color: #94a3b8; line-height: 1.7;
  margin-bottom: 16px;
}
.ac-note b { color: #cbd5e1; }
.ac-note-ico { font-size: 14px; }

/* ═══ 微信连接流程 ═══ */
.ac-flow {
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(99, 102, 241, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  margin-bottom: 16px;
}
.ac-flow-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.ac-flow-ico { font-size: 22px; }
.ac-flow-title { font-size: 14px; font-weight: 800; color: #f1f5f9; }
.ac-flow-sub { font-size: 10px; color: #64748b; margin-top: 1px; }
.ac-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.ac-step {
  display: flex; gap: 9px; align-items: flex-start;
  padding: 11px 12px;
  border-radius: 12px;
  background: rgba(5, 8, 22, 0.5);
  border: 1px solid rgba(71, 85, 105, 0.22);
}
.ac-step-num {
  width: 20px; height: 20px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  font-size: 10px; font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
}
.ac-step b { display: block; font-size: 11.5px; color: #e2e8f0; margin-bottom: 2px; }
.ac-step-desc { font-size: 9.5px; color: #64748b; line-height: 1.55; }
.ac-connect-btn {
  width: 100%;
  font-size: 12.5px; font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #8b5cf6, #6366f1 55%, #3b82f6);
  border: none; border-radius: 11px; padding: 11px 0;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
}
.ac-connect-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(99, 102, 241, 0.45); }

/* ═══ AI 权限说明 ═══ */
.ac-perms {
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(71, 85, 105, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.ac-perms-title { font-size: 13px; font-weight: 800; color: #e2e8f0; margin-bottom: 12px; }
.ac-perms-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.ac-perm {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 11px 12px;
  border-radius: 12px;
  background: rgba(5, 8, 22, 0.5);
  border: 1px solid rgba(71, 85, 105, 0.22);
}
.ac-perm-ico { font-size: 16px; }
.ac-perm b { display: block; font-size: 11.5px; color: #e2e8f0; margin-bottom: 2px; }
.ac-perm-sub { font-size: 9.5px; color: #64748b; line-height: 1.55; }

@media (max-width: 900px) {
  .ac-grid, .ac-perms-grid { grid-template-columns: repeat(2, 1fr); }
  .ac-steps { grid-template-columns: repeat(2, 1fr); }
}
</style>
