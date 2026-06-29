/**
 * GEOSettingsPage — Settings page (placeholder with complete layout).
 *
 * Workspace configuration and preferences.
 *
 * @package workspace/geo/pages
 */

import { GEOTokens } from '../tokens/geo-tokens';

/**
 * Render the Settings page.
 */
export function renderSettings(): string {
  return `
    <div style="padding: 24px; height: 100%; max-width: 640px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0;">
            ⚙️ 设置
          </h2>
          <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 4px 0 0;">
            工作台偏好与配置
          </p>
        </div>
      </div>

      <!-- Settings sections -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- General -->
        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          padding: 20px;
          border: 1px solid ${GEOTokens.colors.border};
        ">
          <h3 style="font-size: 15px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 16px;">
            🎨 显示设置
          </h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 13px; color: ${GEOTokens.colors.text};">语言</span>
              <span style="font-size: 13px; color: ${GEOTokens.colors.textSecondary};">简体中文</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 13px; color: ${GEOTokens.colors.text};">主题</span>
              <span style="font-size: 13px; color: ${GEOTokens.colors.textSecondary};">浅色</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 13px; color: ${GEOTokens.colors.text};">侧边栏行为</span>
              <span style="font-size: 13px; color: ${GEOTokens.colors.textSecondary};">固定</span>
            </div>
          </div>
        </div>

        <!-- Notifications -->
        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          padding: 20px;
          border: 1px solid ${GEOTokens.colors.border};
        ">
          <h3 style="font-size: 15px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 16px;">
            🔔 通知设置
          </h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 13px; color: ${GEOTokens.colors.text};">分析完成通知</span>
              <span style="
                width: 40px;
                height: 22px;
                border-radius: 11px;
                background: ${GEOTokens.colors.brand};
                position: relative;
                cursor: pointer;
              ">
                <span style="
                  position: absolute;
                  right: 2px;
                  top: 2px;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: white;
                "></span>
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 13px; color: ${GEOTokens.colors.text};">告警通知</span>
              <span style="
                width: 40px;
                height: 22px;
                border-radius: 11px;
                background: ${GEOTokens.colors.brand};
                position: relative;
                cursor: pointer;
              ">
                <span style="
                  position: absolute;
                  right: 2px;
                  top: 2px;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: white;
                "></span>
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 13px; color: ${GEOTokens.colors.text};">邮件摘要</span>
              <span style="
                width: 40px;
                height: 22px;
                border-radius: 11px;
                background: #e2e8f0;
                position: relative;
                cursor: pointer;
              ">
                <span style="
                  position: absolute;
                  left: 2px;
                  top: 2px;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: white;
                "></span>
              </span>
            </div>
          </div>
        </div>

        <!-- API -->
        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          padding: 20px;
          border: 1px solid ${GEOTokens.colors.border};
        ">
          <h3 style="font-size: 15px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 16px;">
            🔌 API 配置
          </h3>
          <div style="font-size: 13px; color: ${GEOTokens.colors.textSecondary};">
            <p style="margin: 0 0 8px;">API 密钥管理和其他集成配置将在后续版本中提供。</p>
          </div>
        </div>

        <!-- About -->
        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          padding: 20px;
          border: 1px solid ${GEOTokens.colors.border};
        ">
          <h3 style="font-size: 15px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 16px;">
            ℹ️ 关于
          </h3>
          <div style="font-size: 13px; color: ${GEOTokens.colors.textSecondary};">
            <p style="margin: 0 0 4px;">GEO 工作台 v1.0.0</p>
            <p style="margin: 0;">品牌搜索引擎优化平台</p>
          </div>
        </div>
      </div>
    </div>
  `;
}
