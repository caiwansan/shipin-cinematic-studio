<!-- Admin: 求职招聘管理 — 工作台入口（Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 T02） -->
<!-- 定位：运营管理员管理招聘产品的入口 = 5 个商业管理页面，不是企业 SaaS 控制台 -->
<template>
  <RecruitmentPageShell>
    <template #title>💼 求职招聘管理</template>
    <template #subtitle>招聘产品商业管理后台 · 管理平台提供的招聘产品，不复制企业 SaaS 控制台</template>

    <!-- 5 入口卡片 -->
    <div class="km-mod-grid">
      <div v-for="mod in modules" :key="mod.to" class="km-mod-card" @click="goTo(mod.to)">
        <div class="km-mod-icon">{{ mod.icon }}</div>
        <div class="km-mod-body">
          <div class="km-mod-name">{{ mod.name }}</div>
          <div class="km-mod-desc">{{ mod.desc }}</div>
        </div>
        <div class="km-mod-arrow">→</div>
      </div>
    </div>

    <!-- 边界说明 -->
    <div class="km-boundary">
      <h3 class="km-boundary-title">🧭 后台边界（三入口原则）</h3>
      <div class="km-boundary-grid">
        <div class="km-boundary-item">
          <div class="km-boundary-head">📊 数据罗盘</div>
          <div class="km-boundary-body">AI员工使用次数 / Token / 成本 / 成功率 / 企业活跃 / 收入 / 续费</div>
        </div>
        <div class="km-boundary-item">
          <div class="km-boundary-head">🏢 企业招聘工作台</div>
          <div class="km-boundary-body">岗位 / 候选人 / 面试 / 招聘流程 / AI员工 / 日报（企业自己看）</div>
        </div>
        <div class="km-boundary-item">
          <div class="km-boundary-head">🔧 本后台（5 页）</div>
          <div class="km-boundary-body">Agent 产品配置 / 套餐订阅 / AI Agent / 企业用户 / 企业套餐授权</div>
        </div>
      </div>
    </div>
  </RecruitmentPageShell>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'
definePageMeta({ layout: 'admin-aigc' })

const router = useRouter()

const modules = [
  { icon: '🧠', name: '求职管家 Agent 配置', desc: 'Career Agent 产品定义：基础信息 / 能力 / Prompt 模板 / 版本', to: '/admin/recruitment/config' },
  { icon: '📦', name: '套餐订阅管理', desc: '商业商品：套餐 CRUD + 订阅生命周期', to: '/admin/recruitment/plans' },
  { icon: '🤖', name: 'AI Agent 管理', desc: '企业已部署的 AI 员工：查看 / 启用 / 停用 / 重新部署', to: '/admin/recruitment/agents' },
  { icon: '🏢', name: '企业用户管理', desc: '使用招聘 Workspace 的企业：订阅 / AI员工 / 使用情况', to: '/admin/recruitment/enterprises' },
  { icon: '🔑', name: '企业套餐授权', desc: '管理员运营入口：开通 / 升级 / 暂停 / 恢复 / 续期', to: '/admin/recruitment/authorization' },
]

function goTo(path: string) {
  router.push(path)
}
</script>

<style scoped>
.km-mod-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.km-mod-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: var(--radius-lg, 12px);
  padding: 18px;
  cursor: pointer;
  transition: all 0.15s;
}

.km-mod-card:hover {
  border-color: var(--color-decision, #3B82F6);
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.12);
  transform: translateY(-1px);
}

.km-mod-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(59, 130, 246, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.km-mod-body { flex: 1; min-width: 0; }

.km-mod-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
}

.km-mod-desc {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
  margin-top: 4px;
  line-height: 1.5;
}

.km-mod-arrow {
  color: var(--color-text-disabled, #475569);
  font-size: 16px;
  flex-shrink: 0;
}

.km-boundary {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: var(--radius-lg, 12px);
  padding: 18px;
}

.km-boundary-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #94A3B8);
  margin: 0 0 12px;
}

.km-boundary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.km-boundary-item {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 12px 14px;
}

.km-boundary-head {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-decision, #3B82F6);
  margin-bottom: 6px;
}

.km-boundary-body {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
  line-height: 1.6;
}
</style>
