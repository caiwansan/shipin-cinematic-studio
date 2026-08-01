<!--
  Sprint-MEDIA-UX-02 — 客户资产池
  分级框架: A级(购买意向强) / B级(持续关注) / C级(普通互动)
  纪律: 无真实客户数据 → 空态；AI 客服识别（Sprint-MEDIA-04）后自动填充
-->
<template>
  <MediaWorkspaceShell>
    <div class="cu">
      <div class="cu-head">
        <div>
          <h2 class="cu-title">👥 客户资产池</h2>
          <p class="cu-sub">AI 客服聊差不多后真人接管，并按用户价值分类沉淀</p>
        </div>
        <span class="cu-badge">识别待启动</span>
      </div>

      <!-- 分级漏斗 -->
      <div class="cu-funnel">
        <div v-for="tier in tiers" :key="tier.key" class="cu-tier" :class="'tier-' + tier.key">
          <div class="cu-tier-head">
            <span class="cu-tier-badge">{{ tier.badge }}</span>
            <span class="cu-tier-name">{{ tier.name }}</span>
            <span class="cu-tier-count">{{ tier.count }}</span>
          </div>
          <div class="cu-tier-desc">{{ tier.desc }}</div>
          <div v-if="tier.customers.length" class="cu-tier-list">
            <div v-for="c in tier.customers" :key="c.id" class="cu-cust">
              <span class="cu-cust-avatar">{{ c.avatar }}</span>
              <span class="cu-cust-name">{{ c.name }}</span>
              <span class="cu-cust-note">{{ c.note }}</span>
            </div>
          </div>
          <div v-else class="cu-tier-empty">{{ tier.empty }}</div>
        </div>
      </div>

      <div class="cu-rule">
        <h3 class="cu-rule-title">📐 分级规则（已冻结）</h3>
        <ul class="cu-rule-list">
          <li><b>A 级 · 购买意向强</b>：咨询购买/合作、明确留资 → 真人第一时间接管</li>
          <li><b>B 级 · 持续关注</b>：多次互动、收藏内容 → AI 持续跟进</li>
          <li><b>C 级 · 普通互动</b>：一般留言/点赞 → AI 标准回复</li>
        </ul>
      </div>
    </div>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import MediaWorkspaceShell from '~/components/media/MediaWorkspaceShell.vue'

// 真实数据源待接入（Sprint-MEDIA-04 微信消息 + AI 价值识别）
const tiers = ref([
  { key: 'a', badge: 'A', name: 'A级 · 购买意向强', count: 0, desc: '咨询购买/合作，真人第一时间接管', empty: '暂无 A 级客户', customers: [] as any[] },
  { key: 'b', badge: 'B', name: 'B级 · 持续关注', count: 0, desc: '多次互动/收藏内容，AI 持续跟进', empty: '暂无 B 级客户', customers: [] as any[] },
  { key: 'c', badge: 'C', name: 'C级 · 普通互动', count: 0, desc: '一般留言/点赞，AI 标准回复', empty: '暂无 C 级客户', customers: [] as any[] },
])
</script>

<style scoped>
.cu-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
}
.cu-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}
.cu-sub {
  font-size: 12px;
  color: #8a8a9e;
  margin: 4px 0 0;
}
.cu-badge {
  font-size: 11px;
  background: #f0f0f5;
  color: #9a9aad;
  border-radius: 20px;
  padding: 4px 12px;
  font-weight: 600;
}
.cu-funnel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}
.cu-tier {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 16px 18px;
  border-left-width: 4px;
}
.tier-a { border-left-color: #dc2626; }
.tier-b { border-left-color: #d97706; }
.tier-c { border-left-color: #6b7280; }
.cu-tier-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cu-tier-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  color: #fff;
}
.tier-a .cu-tier-badge { background: #dc2626; }
.tier-b .cu-tier-badge { background: #d97706; }
.tier-c .cu-tier-badge { background: #6b7280; }
.cu-tier-name {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a2e;
}
.cu-tier-count {
  margin-left: auto;
  font-size: 13px;
  font-weight: 800;
  color: #333;
  background: #f4f4f8;
  border-radius: 12px;
  padding: 2px 10px;
}
.cu-tier-desc {
  font-size: 12px;
  color: #8a8a9e;
  margin: 6px 0 0 38px;
}
.cu-tier-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cu-cust {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fafafc;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}
.cu-cust-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #eef2ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.cu-cust-name { font-weight: 600; color: #333; }
.cu-cust-note { margin-left: auto; font-size: 11px; color: #9a9aad; }
.cu-tier-empty {
  margin-top: 10px;
  font-size: 12px;
  color: #b0b0c0;
  text-align: center;
  padding: 16px;
  border: 1px dashed #e2e2ea;
  border-radius: 8px;
}
.cu-rule {
  background: #fff8e8;
  border: 1px solid #ffe2ae;
  border-radius: 12px;
  padding: 16px 18px;
}
.cu-rule-title {
  font-size: 13px;
  font-weight: 700;
  color: #b26a00;
  margin: 0 0 10px;
}
.cu-rule-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #7a5a1e;
  line-height: 2;
}
</style>
