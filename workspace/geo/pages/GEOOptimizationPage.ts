/**
 * GEOOptimizationPage — SEO/visibility optimization page.
 *
 * Brand visibility analysis, keyword optimization, and SEO recommendations.
 *
 * @package workspace/geo/pages
 */

import { GEOTokens } from '../tokens/geo-tokens';

export interface VisibilityMetrics {
  overall: number;
  searchEngine: number;
  socialMedia: number;
  newsMentions: number;
  aiVisibility: number;
}

export interface SEORec {
  id: string;
  title: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  impact: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: GEOTokens.colors.error,
  high: GEOTokens.colors.warning,
  medium: GEOTokens.colors.info,
  low: GEOTokens.colors.textSecondary,
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  dismissed: '已忽略',
};

/**
 * Render the Optimization page.
 */
export function renderOptimization(
  activeTab: 'overview' | 'keywords' | 'recommendations' = 'overview',
  metrics?: VisibilityMetrics,
  recommendations?: SEORec[]
): string {
  const m = metrics || { overall: 0, searchEngine: 0, socialMedia: 0, newsMentions: 0, aiVisibility: 0 };
  const recs = recommendations || [];

  return `
    <div style="padding: 24px; height: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0;">
            📈 SEO 优化
          </h2>
          <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 4px 0 0;">
            可见性分析和搜索引擎优化建议
          </p>
        </div>
      </div>

      <!-- Tabs -->
      <div style="
        display: flex;
        gap: 0;
        margin-bottom: 24px;
        border-bottom: 2px solid ${GEOTokens.colors.border};
      ">
        ${[
          { id: 'overview' as const, label: '📊 总体概览' },
          { id: 'keywords' as const, label: '🔑 关键词' },
          { id: 'recommendations' as const, label: '💡 优化建议' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return `
            <div
              class="shell-nav-item"
              data-page-action="optimization-tab"
              data-tab-id="${tab.id}"
              style="
                padding: 10px 20px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid ${isActive ? GEOTokens.colors.brand : 'transparent'};
                color: ${isActive ? GEOTokens.colors.brand : GEOTokens.colors.textSecondary};
                margin-bottom: -2px;
                transition: all 0.15s;
              "
            >${tab.label}</div>
          `;
        }).join('')}
      </div>

      ${activeTab === 'overview' ? renderOverview(m) : ''}
      ${activeTab === 'keywords' ? renderKeywordsView() : ''}
      ${activeTab === 'recommendations' ? renderRecommendationsView(recs) : ''}
    </div>
  `;
}

function renderOverview(metrics: VisibilityMetrics): string {
  return `
    <div>
      <!-- Overall score -->
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        padding: 24px;
        border: 1px solid ${GEOTokens.colors.border};
        margin-bottom: 16px;
        text-align: center;
      ">
        <div style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin-bottom: 8px;">
          综合可见性评分
        </div>
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: conic-gradient(${GEOTokens.colors.brand} ${metrics.overall}%, #e2e8f0 ${metrics.overall}%);
          margin-bottom: 8px;
        ">
          <span style="
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 700;
            color: ${GEOTokens.colors.text};
          ">${metrics.overall}</span>
        </div>
        <div style="font-size: 13px; color: ${getScoreColor(metrics.overall)}; font-weight: 500;">
          ${getScoreLabel(metrics.overall)}
        </div>
      </div>

      <!-- Detail metrics -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        ${[
          { label: '搜索引擎', value: metrics.searchEngine, color: GEOTokens.colors.info },
          { label: '社交媒体', value: metrics.socialMedia, color: GEOTokens.colors.success },
          { label: '新闻提及', value: metrics.newsMentions, color: GEOTokens.colors.accent },
          { label: 'AI 可见性', value: metrics.aiVisibility, color: GEOTokens.colors.warning },
        ].map(metric => `
          <div style="
            background: ${GEOTokens.colors.surface};
            border-radius: ${GEOTokens.radius.md};
            padding: 16px;
            border: 1px solid ${GEOTokens.colors.border};
          ">
            <div style="font-size: 12px; color: ${GEOTokens.colors.textSecondary}; margin-bottom: 8px;">
              ${metric.label}
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="
                flex: 1;
                height: 8px;
                background: ${GEOTokens.colors.border};
                border-radius: 4px;
                overflow: hidden;
              ">
                <div style="
                  height: 100%;
                  width: ${metric.value}%;
                  background: ${metric.color};
                  border-radius: 4px;
                  transition: width 0.5s;
                "></div>
              </div>
              <span style="font-size: 16px; font-weight: 600; color: ${GEOTokens.colors.text};">
                ${metric.value}
              </span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Run analysis button -->
      <div style="margin-top: 16px; text-align: center;">
        <button class="shell-nav-item" data-page-action="run-visibility-analysis" style="
          background: ${GEOTokens.colors.brand}; color: white; border: none;
          padding: 12px 32px; border-radius: ${GEOTokens.radius.md};
          font-size: 14px; font-weight: 500; cursor: pointer;
        ">🔄 运行可见性分析</button>
      </div>
    </div>
  `;
}

function renderKeywordsView(): string {
  return `
    <div style="
      text-align: center;
      padding: 60px 20px;
      background: ${GEOTokens.colors.surface};
      border-radius: ${GEOTokens.radius.lg};
      border: 1px dashed ${GEOTokens.colors.border};
    ">
      <div style="font-size: 48px; margin-bottom: 12px;">🔑</div>
      <h3 style="font-size: 16px; color: ${GEOTokens.colors.text}; margin: 0 0 8px;">关键词分析</h3>
      <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 0 0 16px;">
        运行可见性分析以获取关键词排名和优化建议
      </p>
      <button class="shell-nav-item" data-page-action="run-visibility-analysis" style="
        background: ${GEOTokens.colors.brand}; color: white; border: none;
        padding: 10px 24px; border-radius: ${GEOTokens.radius.md};
        font-size: 14px; font-weight: 500; cursor: pointer;
      ">运行分析</button>
    </div>
  `;
}

function renderRecommendationsView(recommendations: SEORec[]): string {
  if (recommendations.length === 0) {
    return `
      <div style="
        text-align: center;
        padding: 60px 20px;
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        border: 1px dashed ${GEOTokens.colors.border};
      ">
        <div style="font-size: 48px; margin-bottom: 12px;">💡</div>
        <h3 style="font-size: 16px; color: ${GEOTokens.colors.text}; margin: 0 0 8px;">暂无优化建议</h3>
        <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 0;">
          运行可见性分析后，将生成个性化的优化建议
        </p>
      </div>
    `;
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${recommendations.map(rec => `
        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.md};
          padding: 14px 18px;
          border: 1px solid ${GEOTokens.colors.border};
          border-left: 3px solid ${PRIORITY_COLORS[rec.priority] || GEOTokens.colors.textSecondary};
        ">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px; font-weight: 600; color: ${GEOTokens.colors.text};">${rec.title}</span>
                <span style="
                  font-size: 10px;
                  padding: 1px 6px;
                  border-radius: 4px;
                  background: ${PRIORITY_COLORS[rec.priority]}20;
                  color: ${PRIORITY_COLORS[rec.priority]};
                  font-weight: 500;
                ">${PRIORITY_LABELS[rec.priority] || rec.priority}</span>
              </div>
              <div style="font-size: 12px; color: ${GEOTokens.colors.textSecondary}; margin-top: 4px;">
                类型: ${rec.type} · 影响: ${rec.impact}%
              </div>
            </div>
            <span style="
              font-size: 11px;
              padding: 2px 8px;
              border-radius: 4px;
              color: white;
              background: ${rec.status === 'completed' ? GEOTokens.colors.success : rec.status === 'in_progress' ? GEOTokens.colors.info : GEOTokens.colors.textSecondary};
            ">${STATUS_LABELS[rec.status] || rec.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function getScoreColor(score: number): string {
  if (score >= 80) return GEOTokens.colors.success;
  if (score >= 60) return GEOTokens.colors.warning;
  return GEOTokens.colors.error;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '需要改善';
}
