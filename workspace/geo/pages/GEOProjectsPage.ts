/**
 * GEOProjectsPage — Project list and creation page.
 *
 * Migrated from ProjectSelectPage + ProjectCreatePage (legacy).
 * Displays all GEO projects and provides project creation functionality.
 *
 * @package workspace/geo/pages
 */

import { GEOTokens } from '../tokens/geo-tokens';

export interface GEOProjectItem {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  brandName?: string;
  targetUrl?: string;
}

export interface ProjectCreateForm {
  name: string;
  description: string;
  brandName: string;
  targetUrl: string;
  industry: string;
  targetMarket: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  paused: '已暂停',
  completed: '已完成',
  archived: '已归档',
};

const STATUS_COLORS: Record<string, string> = {
  draft: GEOTokens.colors.textSecondary,
  active: GEOTokens.colors.success,
  paused: GEOTokens.colors.warning,
  completed: GEOTokens.colors.info,
  archived: '#94a3b8',
};

/**
 * Render the Projects page with list view.
 */
export function renderProjectsList(
  projects: GEOProjectItem[],
  onCreateClick: boolean = false,
  showCreateForm: boolean = false
): string {
  if (showCreateForm) {
    return renderCreateForm();
  }

  return `
    <div style="padding: 24px; height: 100%;">
      <!-- Header -->
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      ">
        <div>
          <h2 style="font-size: 20px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0;">
            📁 项目管理
          </h2>
          <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 4px 0 0;">
            管理和创建 GEO 优化项目
          </p>
        </div>
        <button
          class="shell-nav-item"
          data-page-action="show-create-form"
          style="
            background: ${GEOTokens.colors.brand};
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: ${GEOTokens.radius.md};
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: opacity 0.15s;
          "
          onmouseover="this.style.opacity='0.9'"
          onmouseout="this.style.opacity='1'"
        >
          + 新建项目
        </button>
      </div>

      <!-- Search -->
      <div style="margin-bottom: 16px;">
        <input
          id="project-search-input"
          type="text"
          placeholder="搜索项目..."
          style="
            width: 100%;
            padding: 10px 14px;
            border: 1px solid ${GEOTokens.colors.border};
            border-radius: ${GEOTokens.radius.md};
            font-size: 14px;
            outline: none;
            box-sizing: border-box;
          "
        >
      </div>

      <!-- Project List -->
      ${projects.length === 0 ? `
        <div style="
          text-align: center;
          padding: 60px 20px;
          background: ${GEOTokens.colors.surface};
          border-radius: ${GEOTokens.radius.lg};
          border: 1px dashed ${GEOTokens.colors.border};
        ">
          <div style="font-size: 48px; margin-bottom: 12px;">📂</div>
          <h3 style="font-size: 16px; color: ${GEOTokens.colors.text}; margin: 0 0 8px;">暂无项目</h3>
          <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 0 0 16px;">
            创建您的第一个 GEO 项目，开始品牌优化之旅
          </p>
          <button
            class="shell-nav-item"
            data-page-action="show-create-form"
            style="
              background: ${GEOTokens.colors.brand};
              color: white;
              border: none;
              padding: 10px 24px;
              border-radius: ${GEOTokens.radius.md};
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            + 创建项目
          </button>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${projects.map(project => `
            <div
              class="shell-nav-item"
              data-page-id="research"
              data-project-id="${project.id}"
              style="
                background: ${GEOTokens.colors.surface};
                border-radius: ${GEOTokens.radius.md};
                padding: 16px 20px;
                border: 1px solid ${GEOTokens.colors.border};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: all 0.15s;
              "
              onmouseover="this.style.borderColor='${GEOTokens.colors.brand}'"
              onmouseout="this.style.borderColor='${GEOTokens.colors.border}'"
            >
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">📦</span>
                <div>
                  <div style="font-size: 15px; font-weight: 600; color: ${GEOTokens.colors.text};">
                    ${project.name}
                  </div>
                  <div style="font-size: 12px; color: ${GEOTokens.colors.textSecondary}; margin-top: 2px;">
                    ${project.brandName ? `🏷️ ${project.brandName}` : ''}
                    ${project.targetUrl ? ` · 🔗 ${project.targetUrl}` : ''}
                  </div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="
                  font-size: 11px;
                  padding: 2px 8px;
                  border-radius: 4px;
                  color: white;
                  background: ${STATUS_COLORS[project.status] || '#94a3b8'};
                ">${STATUS_LABELS[project.status] || project.status}</span>
                <span style="font-size: 12px; color: ${GEOTokens.colors.textSecondary};">${formatDate(project.updatedAt)}</span>
                <span style="color: ${GEOTokens.colors.border};">→</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

/**
 * Render the project creation form.
 */
function renderCreateForm(): string {
  return `
    <div style="padding: 24px; max-width: 640px; margin: 0 auto;">
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        padding: 32px;
        border: 1px solid ${GEOTokens.colors.border};
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0;">
            + 新建项目
          </h2>
          <button
            class="shell-nav-item"
            data-page-action="back-to-list"
            style="
              background: none;
              border: 1px solid ${GEOTokens.colors.border};
              padding: 6px 14px;
              border-radius: ${GEOTokens.radius.md};
              font-size: 13px;
              color: ${GEOTokens.colors.textSecondary};
              cursor: pointer;
            "
          >取消</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              项目名称 <span style="color: ${GEOTokens.colors.error};">*</span>
            </label>
            <input id="create-project-name" type="text" placeholder="例如：某品牌 GEO 优化" style="
              width: 100%;
              padding: 10px 14px;
              border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md};
              font-size: 14px;
              outline: none;
              box-sizing: border-box;
            ">
          </div>

          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              项目描述
            </label>
            <textarea id="create-project-desc" placeholder="项目简介..." style="
              width: 100%;
              padding: 10px 14px;
              border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md};
              font-size: 14px;
              outline: none;
              resize: vertical;
              min-height: 80px;
              box-sizing: border-box;
              font-family: inherit;
            "></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
                品牌名称
              </label>
              <input id="create-project-brand" type="text" placeholder="品牌名" style="
                width: 100%;
                padding: 10px 14px;
                border: 1px solid ${GEOTokens.colors.border};
                border-radius: ${GEOTokens.radius.md};
                font-size: 14px;
                outline: none;
                box-sizing: border-box;
              ">
            </div>
            <div>
              <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
                所属行业
              </label>
              <input id="create-project-industry" type="text" placeholder="例如：科技、零售" style="
                width: 100%;
                padding: 10px 14px;
                border: 1px solid ${GEOTokens.colors.border};
                border-radius: ${GEOTokens.radius.md};
                font-size: 14px;
                outline: none;
                box-sizing: border-box;
              ">
            </div>
          </div>

          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              目标网站 URL
            </label>
            <input id="create-project-url" type="text" placeholder="https://example.com" style="
              width: 100%;
              padding: 10px 14px;
              border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md};
              font-size: 14px;
              outline: none;
              box-sizing: border-box;
            ">
          </div>

          <div>
            <label style="font-size: 13px; font-weight: 500; color: ${GEOTokens.colors.text}; display: block; margin-bottom: 4px;">
              目标市场
            </label>
            <input id="create-project-market" type="text" placeholder="例如：中国、全球" style="
              width: 100%;
              padding: 10px 14px;
              border: 1px solid ${GEOTokens.colors.border};
              border-radius: ${GEOTokens.radius.md};
              font-size: 14px;
              outline: none;
              box-sizing: border-box;
            ">
          </div>

          <div style="margin-top: 8px;">
            <button
              class="shell-nav-item"
              data-page-action="create-project"
              style="
                width: 100%;
                background: ${GEOTokens.colors.brand};
                color: white;
                border: none;
                padding: 12px;
                border-radius: ${GEOTokens.radius.md};
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
              "
            >
              创建项目
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}
