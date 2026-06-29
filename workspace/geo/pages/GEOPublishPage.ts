/**
 * GEOPublishPage — Publish workflow page (placeholder with complete layout).
 *
 * Manages content publishing across different channels.
 *
 * @package workspace/geo/pages
 */

import { GEOTokens } from '../tokens/geo-tokens';

/**
 * Render the Publish page.
 */
export function renderPublish(): string {
  return `
    <div style="padding: 24px; height: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0;">
            🚀 发布管理
          </h2>
          <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 4px 0 0;">
            将优化后的内容发布到多个渠道
          </p>
        </div>
      </div>

      <!-- Channel cards -->
      <div style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 24px;
      ">
        ${[
          { name: '网站', icon: '🌐', desc: '发布到企业官网', color: GEOTokens.colors.info },
          { name: '社交媒体', icon: '📱', desc: '同步到社交平台', color: GEOTokens.colors.success },
          { name: '知识图谱', icon: '🔗', desc: '更新 Schema 结构化数据', color: GEOTokens.colors.accent },
        ].map(ch => `
          <div style="
            background: ${GEOTokens.colors.surface};
            border-radius: ${GEOTokens.radius.lg};
            padding: 20px;
            border: 1px solid ${GEOTokens.colors.border};
            opacity: 0.8;
          ">
            <div style="
              width: 44px;
              height: 44px;
              border-radius: ${GEOTokens.radius.lg};
              background: ${ch.color}20;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 22px;
              margin-bottom: 12px;
            ">${ch.icon}</div>
            <h4 style="font-size: 15px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 4px;">
              ${ch.name}
            </h4>
            <p style="font-size: 12px; color: ${GEOTokens.colors.textSecondary}; margin: 0;">
              ${ch.desc}
            </p>
            <div style="
              margin-top: 12px;
              padding: 8px;
              border-radius: ${GEOTokens.radius.md};
              background: #f1f5f9;
              font-size: 12px;
              color: ${GEOTokens.colors.textSecondary};
              text-align: center;
            ">
              🔒 即将推出
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Coming soon section -->
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        padding: 32px;
        border: 1px solid ${GEOTokens.colors.border};
        text-align: center;
      ">
        <div style="font-size: 56px; margin-bottom: 16px;">🚀</div>
        <h3 style="font-size: 18px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 8px;">
          发布管理功能即将上线
        </h3>
        <p style="font-size: 14px; color: ${GEOTokens.colors.textSecondary}; margin: 0 0 16px; max-width: 480px; margin-left: auto; margin-right: auto;">
          发布管理模块支持将优化后的品牌内容一键发布到多个渠道，
          包括网站、社交媒体和知识图谱更新。后续版本将逐步开放。
        </p>
        <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <span style="
            padding: 6px 14px;
            border-radius: ${GEOTokens.radius.md};
            background: ${GEOTokens.colors.brandLight};
            color: ${GEOTokens.colors.brand};
            font-size: 13px;
          ">🌐 网站发布</span>
          <span style="
            padding: 6px 14px;
            border-radius: ${GEOTokens.radius.md};
            background: ${GEOTokens.colors.brandLight};
            color: ${GEOTokens.colors.brand};
            font-size: 13px;
          ">📱 社交媒体</span>
          <span style="
            padding: 6px 14px;
            border-radius: ${GEOTokens.radius.md};
            background: ${GEOTokens.colors.brandLight};
            color: ${GEOTokens.colors.brand};
            font-size: 13px;
          ">🔗 知识图谱</span>
          <span style="
            padding: 6px 14px;
            border-radius: ${GEOTokens.radius.md};
            background: ${GEOTokens.colors.brandLight};
            color: ${GEOTokens.colors.brand};
            font-size: 13px;
          ">📄 Schema 结构化</span>
        </div>
      </div>
    </div>
  `;
}
