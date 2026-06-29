/**
 * GEOResearchPage — Brand research and website scanning page.
 *
 * Combines brand profile management and website scanning functionality.
 * Migrated from BrandProfilePage + WebsiteScannerPage (legacy).
 *
 * @package workspace/geo/pages
 */

import { GEOTokens } from '../tokens/geo-tokens';

export interface BrandProfileData {
  brandName: string;
  description: string;
  website: string;
  industry: string;
  targetMarket: string;
  keywords: string[];
  competitors: string[];
}

export interface WebsiteScanResult {
  url: string;
  title: string;
  description: string;
  pages: number;
  issues: number;
  status: string;
}

/**
 * Render the Research page with brand profile tab and website scanner tab.
 */
export function renderResearch(
  activeTab: 'profile' | 'scanner' = 'profile',
  brandData?: BrandProfileData,
  scanData?: WebsiteScanResult
): string {
  const bd = brandData || { brandName: '', description: '', website: '', industry: '', targetMarket: '', keywords: [], competitors: [] };
  const sd = scanData || { url: '', title: '', description: '', pages: 0, issues: 0, status: 'pending' };

  return `
    <div style="padding: 24px; height: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0;">
            🔍 品牌研究
          </h2>
          <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 4px 0 0;">
            管理品牌档案和扫描网站数据
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
          { id: 'profile' as const, label: '📋 品牌档案' },
          { id: 'scanner' as const, label: '🔍 网站扫描' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return `
            <div
              class="shell-nav-item"
              data-page-action="research-tab"
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

      ${activeTab === 'profile' ? renderBrandProfileForm(bd) : renderWebsiteScanner(sd)}
    </div>
  `;
}

/**
 * Render the brand profile form.
 */
function renderBrandProfileForm(data: BrandProfileData): string {
  return `
    <div style="max-width: 720px;">
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        padding: 24px;
        border: 1px solid ${GEOTokens.colors.border};
      ">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
                品牌名称 <span style="color: ${GEOTokens.colors.error};">*</span>
              </label>
              <input type="text" value="${data.brandName}" placeholder="品牌名称" style="
                width: 100%; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
                border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none; box-sizing: border-box;
              ">
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
                所属行业
              </label>
              <input type="text" value="${data.industry}" placeholder="例如：科技、零售" style="
                width: 100%; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
                border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none; box-sizing: border-box;
              ">
            </div>
          </div>

          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              品牌描述
            </label>
            <textarea placeholder="品牌简介..." style="
              width: 100%; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none;
              resize: vertical; min-height: 80px; box-sizing: border-box; font-family: inherit;
            ">${data.description}</textarea>
          </div>

          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              官方网站
            </label>
            <input type="text" value="${data.website}" placeholder="https://example.com" style="
              width: 100%; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none; box-sizing: border-box;
            ">
          </div>

          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              目标市场
            </label>
            <input type="text" value="${data.targetMarket}" placeholder="例如：中国、全球" style="
              width: 100%; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none; box-sizing: border-box;
            ">
          </div>

          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              核心关键词（逗号分隔）
            </label>
            <input type="text" value="${data.keywords.join(', ')}" placeholder="关键词1, 关键词2" style="
              width: 100%; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none; box-sizing: border-box;
            ">
          </div>

          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              竞品网站（逗号分隔）
            </label>
            <input type="text" value="${data.competitors.join(', ')}" placeholder="https://competitor1.com, https://competitor2.com" style="
              width: 100%; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none; box-sizing: border-box;
            ">
          </div>

          <div style="margin-top: 8px;">
            <button class="shell-nav-item" data-page-action="save-brand-profile" style="
              background: ${GEOTokens.colors.brand}; color: white; border: none;
              padding: 12px 24px; border-radius: ${GEOTokens.radius.md};
              font-size: 14px; font-weight: 500; cursor: pointer;
            ">保存品牌档案</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the website scanner view.
 */
function renderWebsiteScanner(data: WebsiteScanResult): string {
  const isScanned = data.status === 'completed' || data.status === 'error';

  return `
    <div style="max-width: 720px;">
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        padding: 24px;
        border: 1px solid ${GEOTokens.colors.border};
        margin-bottom: 16px;
      ">
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <input id="scan-url-input" type="text" value="${data.url || ''}" placeholder="输入网站 URL..."
            style="flex: 1; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
            border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none;">
          <button class="shell-nav-item" data-page-action="start-scan" style="
            background: ${GEOTokens.colors.brand}; color: white; border: none;
            padding: 10px 24px; border-radius: ${GEOTokens.radius.md};
            font-size: 14px; font-weight: 500; cursor: pointer;
            white-space: nowrap;
          ">开始扫描</button>
        </div>

        <div style="
          background: #f8fafc;
          border-radius: ${GEOTokens.radius.md};
          padding: 16px;
          font-size: 13px;
          color: ${GEOTokens.colors.textSecondary};
        ">
          输入需要分析的网站 URL，系统将自动扫描并提取结构化数据，包括页面结构、元数据、关键词分布等信息。
        </div>
      </div>

      ${isScanned ? `
        <div style="
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          padding: 24px;
          border: 1px solid ${GEOTokens.colors.border};
        ">
          <h3 style="font-size: 16px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 16px;">
            📸 扫描结果
          </h3>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 12px; font-size: 13px;">
              <span style="color: ${GEOTokens.colors.textSecondary}; min-width: 80px;">URL</span>
              <span style="color: ${GEOTokens.colors.text};">${data.url}</span>
            </div>
            <div style="display: flex; gap: 12px; font-size: 13px;">
              <span style="color: ${GEOTokens.colors.textSecondary}; min-width: 80px;">标题</span>
              <span style="color: ${GEOTokens.colors.text};">${data.title || '—'}</span>
            </div>
            <div style="display: flex; gap: 12px; font-size: 13px;">
              <span style="color: ${GEOTokens.colors.textSecondary}; min-width: 80px;">描述</span>
              <span style="color: ${GEOTokens.colors.text};">${data.description || '—'}</span>
            </div>
            <div style="display: flex; gap: 12px; font-size: 13px;">
              <span style="color: ${GEOTokens.colors.textSecondary}; min-width: 80px;">页面数</span>
              <span style="color: ${GEOTokens.colors.text};">${data.pages}</span>
            </div>
            <div style="display: flex; gap: 12px; font-size: 13px;">
              <span style="color: ${GEOTokens.colors.textSecondary}; min-width: 80px;">问题</span>
              <span style="color: ${data.issues > 0 ? GEOTokens.colors.warning : GEOTokens.colors.success};">${data.issues > 0 ? `发现 ${data.issues} 个问题` : '无'}</span>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
