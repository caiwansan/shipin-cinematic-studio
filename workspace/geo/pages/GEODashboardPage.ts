/**
 * GEODashboardPage — Dashboard overview with stats and feature cards.
 *
 * Main landing page after login, showing project stats and quick actions.
 *
 * @package workspace/geo/pages
 */

import { GEOTokens } from '../tokens/geo-tokens';

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  pendingTasks: number;
  averageVisibility: number;
  totalMentions: number;
  positiveSentiment: number;
}

export interface DashboardCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  pageId: string;
  color: string;
}

/**
 * Default dashboard feature cards.
 */
export const DASHBOARD_FEATURE_CARDS: DashboardCard[] = [
  { id: 'research', title: '品牌研究', description: '品牌档案管理与网站扫描分析', icon: '🔍', pageId: 'research', color: GEOTokens.colors.brand },
  { id: 'knowledge', title: '知识图谱', description: '构建品牌知识关联网络', icon: '🔗', pageId: 'knowledge', color: GEOTokens.colors.accent },
  { id: 'optimization', title: 'SEO优化', description: '搜索引擎优化与可见性分析', icon: '📈', pageId: 'optimization', color: GEOTokens.colors.success },
  { id: 'publish', title: '发布管理', description: '多渠道内容发布与监控', icon: '🚀', pageId: 'publish', color: GEOTokens.colors.info },
];

/**
 * Coming soon feature cards.
 */
export const COMING_SOON_CARDS: DashboardCard[] = [
  { id: 'ai-visibility', title: 'AI 可见性', description: 'AI 搜索引擎排名监控', icon: '🤖', pageId: 'monitor', color: GEOTokens.colors.warning },
  { id: 'citations', title: '引用追踪', description: '全网品牌提及追踪', icon: '📝', pageId: 'monitor', color: '#ec4899' },
  { id: 'competitors', title: '竞品分析', description: '竞品策略与市场定位分析', icon: '🎯', pageId: 'research', color: GEOTokens.colors.error },
  { id: 'content', title: '内容策略', description: 'AI 驱动内容优化建议', icon: '✍️', pageId: 'optimization', color: '#f97316' },
];

/**
 * Render the Dashboard page HTML.
 */
export function renderDashboard(stats?: DashboardStats): string {
  const s = stats || {
    totalProjects: 0,
    activeProjects: 0,
    pendingTasks: 0,
    averageVisibility: 0,
    totalMentions: 0,
    positiveSentiment: 0,
  };

  return `
    <div style="padding: 24px; height: 100%;">
      <!-- Welcome -->
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding: 24px;
        background: linear-gradient(135deg, ${GEOTokens.colors.brand}08, ${GEOTokens.colors.accent}05);
        border-radius: ${GEOTokens.radius.lg};
        border: 1px solid ${GEOTokens.colors.brand}20;
      ">
        <div>
          <h1 style="font-size: 24px; font-weight: 700; color: ${GEOTokens.colors.text}; margin: 0 0 6px;">
            GEO 工作台
          </h1>
          <p style="font-size: 14px; color: ${GEOTokens.colors.textSecondary}; margin: 0;">
            品牌搜索引擎优化 — 提升品牌在全网的可见性与影响力
          </p>
        </div>
        <div style="display: flex; gap: 20px;">
          ${[
            { label: '项目', value: s.totalProjects },
            { label: '活跃', value: s.activeProjects },
            { label: '待办', value: s.pendingTasks },
          ].map(stat => `
            <div style="text-align: center;">
              <span style="display: block; font-size: 22px; font-weight: 700; color: ${GEOTokens.colors.brand};">${stat.value}</span>
              <span style="font-size: 12px; color: ${GEOTokens.colors.textSecondary};">${stat.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Stats Row -->
      <div style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 24px;
      ">
        ${[
          { icon: '👁️', label: '平均可见性', value: s.averageVisibility.toFixed(0) + '%', color: GEOTokens.colors.info },
          { icon: '📝', label: '全网提及', value: s.totalMentions.toLocaleString(), color: GEOTokens.colors.success },
          { icon: '😊', label: '正面舆情', value: s.positiveSentiment.toFixed(0) + '%', color: GEOTokens.colors.warning },
        ].map(stat => `
          <div style="
            background: ${GEOTokens.colors.surface};
            border-radius: ${GEOTokens.radius.lg};
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-left: 3px solid ${stat.color};
            box-shadow: ${GEOTokens.shadow.sm};
          ">
            <span style="font-size: 24px;">${stat.icon}</span>
            <div>
              <span style="display: block; font-size: 20px; font-weight: 700; color: ${GEOTokens.colors.text};">${stat.value}</span>
              <span style="font-size: 12px; color: ${GEOTokens.colors.textSecondary};">${stat.label}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Feature Cards -->
      <div style="margin-bottom: 24px;">
        <h3 style="
          font-size: 15px;
          font-weight: 600;
          color: ${GEOTokens.colors.text};
          margin: 0 0 12px;
        ">核心功能</h3>
        <div style="
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        ">
          ${DASHBOARD_FEATURE_CARDS.map(card => `
            <div
              class="shell-nav-item"
              data-page-id="${card.pageId}"
              style="
                background: ${GEOTokens.colors.surface};
                border-radius: ${GEOTokens.radius.lg};
                padding: 20px;
                cursor: pointer;
                border: 1px solid ${GEOTokens.colors.border};
                box-shadow: ${GEOTokens.shadow.sm};
                transition: all 0.2s;
              "
              onmouseover="this.style.borderColor='${card.color}';this.style.transform='translateY(-2px)'"
              onmouseout="this.style.borderColor='${GEOTokens.colors.border}';this.style.transform='translateY(0)'"
            >
              <div style="
                width: 44px;
                height: 44px;
                border-radius: ${GEOTokens.radius.lg};
                background: ${card.color}20;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                margin-bottom: 12px;
              ">${card.icon}</div>
              <h4 style="font-size: 15px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 4px;">
                ${card.title}
              </h4>
              <p style="font-size: 12px; color: ${GEOTokens.colors.textSecondary}; margin: 0; line-height: 1.4;">
                ${card.description}
              </p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Coming Soon -->
      <div style="margin-bottom: 24px;">
        <h3 style="
          font-size: 15px;
          font-weight: 600;
          color: ${GEOTokens.colors.text};
          margin: 0 0 12px;
        ">扩展能力</h3>
        <div style="
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        ">
          ${COMING_SOON_CARDS.map(card => `
            <div style="
              background: ${GEOTokens.colors.surface};
              border-radius: ${GEOTokens.radius.lg};
              padding: 20px;
              border: 1px solid ${GEOTokens.colors.border};
              opacity: 0.7;
            ">
              <div style="
                width: 44px;
                height: 44px;
                border-radius: ${GEOTokens.radius.lg};
                background: ${card.color}20;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                margin-bottom: 12px;
              ">${card.icon}</div>
              <h4 style="font-size: 15px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 4px;">
                ${card.title}
                <span style="
                  font-size: 9px;
                  color: ${GEOTokens.colors.warning};
                  background: ${GEOTokens.colors.warning}15;
                  padding: 1px 6px;
                  border-radius: 4px;
                  margin-left: 6px;
                  font-weight: 500;
                ">即将推出</span>
              </h4>
              <p style="font-size: 12px; color: ${GEOTokens.colors.textSecondary}; margin: 0; line-height: 1.4;">
                ${card.description}
              </p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Bottom Panels -->
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      ">
        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          border: 1px solid ${GEOTokens.colors.border};
          overflow: hidden;
        ">
          <div style="
            padding: 12px 16px;
            border-bottom: 1px solid ${GEOTokens.colors.border};
            font-size: 14px;
            font-weight: 600;
            color: ${GEOTokens.colors.text};
          ">📌 快速开始</div>
          <div style="padding: 16px;">
            <div style="color: ${GEOTokens.colors.textSecondary}; font-size: 13px; line-height: 1.6;">
              <p>1. 📁 创建或选择一个项目</p>
              <p>2. 🔍 扫描网站并建立品牌档案</p>
              <p>3. 🔗 构建实体知识图谱</p>
              <p>4. 📈 运行可见性分析并获取优化建议</p>
            </div>
          </div>
        </div>

        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          border: 1px solid ${GEOTokens.colors.border};
          overflow: hidden;
        ">
          <div style="
            padding: 12px 16px;
            border-bottom: 1px solid ${GEOTokens.colors.border};
            font-size: 14px;
            font-weight: 600;
            color: ${GEOTokens.colors.text};
          ">📋 系统状态</div>
          <div style="padding: 16px;">
            <div style="color: ${GEOTokens.colors.textSecondary}; font-size: 13px; line-height: 1.6;">
              <p>系统运行正常 ✓</p>
              <p>项目数量：${s.totalProjects}</p>
              <p>活跃项目：${s.activeProjects}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * GEODashboardPage as a page component.
 */
export function createDashboardPage(stats?: DashboardStats) {
  return {
    id: 'dashboard',
    label: '仪表盘',
    render: () => renderDashboard(stats),
  };
}
