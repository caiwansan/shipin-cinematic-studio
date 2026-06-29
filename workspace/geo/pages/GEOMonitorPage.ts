/**
 * GEOMonitorPage — Monitoring dashboard page (placeholder with complete layout).
 *
 * Tracks project health, performance metrics, and real-time alerts.
 *
 * @package workspace/geo/pages
 */

import { GEOTokens } from '../tokens/geo-tokens';

/**
 * Render the Monitor page.
 */
export function renderMonitor(): string {
  return `
    <div style="padding: 24px; height: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0;">
            📡 监控面板
          </h2>
          <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 4px 0 0;">
            项目健康度和性能指标实时监控
          </p>
        </div>
      </div>

      <!-- Health metrics cards -->
      <div style="
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 24px;
      ">
        ${[
          { label: '系统状态', value: '运行正常', icon: '✅', color: GEOTokens.colors.success },
          { label: '活跃项目', value: '0', icon: '📁', color: GEOTokens.colors.info },
          { label: '最近扫描', value: '暂无', icon: '🔍', color: GEOTokens.colors.textSecondary },
          { label: '待处理告警', value: '0', icon: '🔔', color: GEOTokens.colors.warning },
        ].map(stat => `
          <div style="
            background: ${GEOTokens.colors.surface};
            border-radius: ${GEOTokens.radius.lg};
            padding: 16px;
            border: 1px solid ${GEOTokens.colors.border};
            display: flex;
            align-items: center;
            gap: 12px;
          ">
            <span style="font-size: 24px;">${stat.icon}</span>
            <div>
              <span style="display: block; font-size: 18px; font-weight: 700; color: ${GEOTokens.colors.text};">${stat.value}</span>
              <span style="font-size: 11px; color: ${GEOTokens.colors.textSecondary};">${stat.label}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Charts placeholder -->
      <div style="
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 16px;
        margin-bottom: 24px;
      ">
        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          padding: 20px;
          border: 1px solid ${GEOTokens.colors.border};
          min-height: 250px;
        ">
          <h4 style="font-size: 14px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 16px;">
            📈 可见性趋势
          </h4>
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            height: 180px;
            color: ${GEOTokens.colors.textSecondary};
            font-size: 13px;
          ">
            <div style="text-align: center;">
              <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
              <p>趋势图将在此展示</p>
            </div>
          </div>
        </div>

        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          padding: 20px;
          border: 1px solid ${GEOTokens.colors.border};
        ">
          <h4 style="font-size: 14px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 16px;">
            🔔 最近告警
          </h4>
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            height: 180px;
            color: ${GEOTokens.colors.textSecondary};
            font-size: 13px;
          ">
            <div style="text-align: center;">
              <div style="font-size: 32px; margin-bottom: 8px;">🔕</div>
              <p>暂无告警</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Coming soon notice -->
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        padding: 24px;
        border: 1px dashed ${GEOTokens.colors.border};
        text-align: center;
      ">
        <div style="font-size: 48px; margin-bottom: 12px;">📡</div>
        <h3 style="font-size: 16px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 8px;">
          实时监控即将上线
        </h3>
        <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 0 0 16px; max-width: 480px; margin-left: auto; margin-right: auto;">
          监控面板将提供品牌可见性趋势、引用变化告警、竞品动态追踪等实时数据。
        </p>
        <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <span style="padding: 4px 12px; border-radius: 6px; background: #f1f5f9; font-size: 12px; color: #64748b;">
            👁️ 可见性趋势
          </span>
          <span style="padding: 4px 12px; border-radius: 6px; background: #f1f5f9; font-size: 12px; color: #64748b;">
            📝 引用变化
          </span>
          <span style="padding: 4px 12px; border-radius: 6px; background: #f1f5f9; font-size: 12px; color: #64748b;">
            🎯 竞品动态
          </span>
        </div>
      </div>
    </div>
  `;
}
