/**
 * GEOKnowledgePage — Knowledge graph and semantic explorer page.
 *
 * Combines knowledge graph visualization and semantic entity management.
 * Migrated from KnowledgeGraphPage + SemanticExplorer (legacy).
 *
 * @package workspace/geo/pages
 */

import { GEOTokens } from '../tokens/geo-tokens';

export interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  description?: string;
}

export interface KnowledgeEdge {
  sourceId: string;
  targetId: string;
  type: string;
  label?: string;
}

export interface SemanticEntity {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  keywords: string[];
}

/**
 * Render the Knowledge page.
 */
export function renderKnowledge(
  activeTab: 'graph' | 'entities' | 'search' = 'graph',
  nodes?: KnowledgeNode[],
  edges?: KnowledgeEdge[],
  entities?: SemanticEntity[]
): string {
  const ns = nodes || [];
  const es = edges || [];
  const ents = entities || [];

  return `
    <div style="padding: 24px; height: 100%;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 20px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0;">
            🔗 知识图谱
          </h2>
          <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 4px 0 0;">
            构建品牌实体关系网络，管理语义知识
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
          { id: 'graph' as const, label: '🕸️ 图谱视图' },
          { id: 'entities' as const, label: '🏷️ 实体管理' },
          { id: 'search' as const, label: '🔎 语义搜索' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return `
            <div
              class="shell-nav-item"
              data-page-action="knowledge-tab"
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

      ${activeTab === 'graph' ? renderGraphView(ns, es) : ''}
      ${activeTab === 'entities' ? renderEntitiesView(ents) : ''}
      ${activeTab === 'search' ? renderSearchView() : ''}
    </div>
  `;
}

/**
 * Render graph visualization view.
 */
function renderGraphView(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): string {
  if (nodes.length === 0) {
    return `
      <div style="
        text-align: center;
        padding: 60px 20px;
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        border: 1px dashed ${GEOTokens.colors.border};
      ">
        <div style="font-size: 48px; margin-bottom: 12px;">🕸️</div>
        <h3 style="font-size: 16px; color: ${GEOTokens.colors.text}; margin: 0 0 8px;">知识图谱为空</h3>
        <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 0 0 16px;">
          扫描网站或添加实体后，知识图谱将在此展示
        </p>
        <div style="display: flex; justify-content: center; gap: 12px;">
          <button class="shell-nav-item" data-page-id="research" style="
            background: ${GEOTokens.colors.brand}; color: white; border: none;
            padding: 10px 24px; border-radius: ${GEOTokens.radius.md};
            font-size: 14px; font-weight: 500; cursor: pointer;
          ">前往品牌研究</button>
        </div>
      </div>
    `;
  }

  // Simple node-edge list view (canvas/force-graph would be a future enhancement)
  const entityTypes = [...new Set(nodes.map(n => n.type))];

  return `
    <div style="display: grid; grid-template-columns: 1fr 320px; gap: 16px;">
      <!-- Graph visualization placeholder -->
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        border: 1px solid ${GEOTokens.colors.border};
        padding: 24px;
        min-height: 400px;
        display: flex;
        flex-direction: column;
      ">
        <div style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin-bottom: 16px;">
          图谱包含 ${nodes.length} 个节点和 ${edges.length} 条关系
        </div>
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; color: ${GEOTokens.colors.textSecondary}; font-size: 13px; text-align: center;">
          <div>
            <div style="font-size: 64px; margin-bottom: 12px;">🕸️</div>
            <p>知识图谱可视化需要 Canvas 或 D3.js 支持</p>
            <p style="font-size: 12px; margin-top: 4px;">（将在下一阶段实现交互式图谱渲染）</p>
          </div>
        </div>
      </div>

      <!-- Node types sidebar -->
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        border: 1px solid ${GEOTokens.colors.border};
        padding: 20px;
      ">
        <h3 style="font-size: 14px; font-weight: 600; color: ${GEOTokens.colors.text}; margin: 0 0 12px;">
          实体类型
        </h3>
        ${entityTypes.map(type => `
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid ${GEOTokens.colors.border};
            font-size: 13px;
            color: ${GEOTokens.colors.text};
          ">
            <span>${getTypeIcon(type)} ${capitalize(type)}</span>
            <span style="
              background: ${GEOTokens.colors.brandLight};
              color: ${GEOTokens.colors.brand};
              padding: 1px 8px;
              border-radius: ${GEOTokens.radius.full};
              font-size: 11px;
            ">${nodes.filter(n => n.type === type).length}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Render entities management view.
 */
function renderEntitiesView(entities: SemanticEntity[]): string {
  if (entities.length === 0) {
    return `
      <div style="
        text-align: center;
        padding: 60px 20px;
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        border: 1px dashed ${GEOTokens.colors.border};
      ">
        <div style="font-size: 48px; margin-bottom: 12px;">🏷️</div>
        <h3 style="font-size: 16px; color: ${GEOTokens.colors.text}; margin: 0 0 8px;">暂无实体</h3>
        <p style="font-size: 13px; color: ${GEOTokens.colors.textSecondary}; margin: 0;">
          品牌相关的实体将在此显示
        </p>
      </div>
    `;
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${entities.map(entity => `
        <div
          class="shell-nav-item"
          data-entity-id="${entity.id}"
          style="
            background: ${GEOTokens.colors.surface};
            border-radius: ${GEOTokens.radius.md};
            padding: 14px 18px;
            border: 1px solid ${GEOTokens.colors.border};
            cursor: pointer;
          "
        >
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 20px;">${getTypeIcon(entity.type)}</span>
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 600; color: ${GEOTokens.colors.text};">
                ${entity.name}
              </div>
              <div style="display: flex; gap: 8px; margin-top: 4px;">
                <span style="font-size: 11px; color: ${GEOTokens.colors.textSecondary};">
                  别名: ${entity.aliases.length > 0 ? entity.aliases.join(', ') : '无'}
                </span>
                <span style="font-size: 11px; color: ${GEOTokens.colors.textSecondary};">
                  关键词: ${entity.keywords.length}
                </span>
              </div>
            </div>
            <span style="
              font-size: 11px;
              padding: 2px 8px;
              border-radius: 4px;
              background: ${GEOTokens.colors.brandLight};
              color: ${GEOTokens.colors.brand};
            ">${capitalize(entity.type)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render semantic search view.
 */
function renderSearchView(): string {
  return `
    <div style="max-width: 720px;">
      <div style="
        background: ${GEOTokens.colors.surface};
        border-radius: ${GEOTokens.radius.lg};
        padding: 24px;
        border: 1px solid ${GEOTokens.colors.border};
      ">
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <input id="semantic-search-input" type="text" placeholder="输入搜索关键词..."
            style="flex: 1; padding: 10px 14px; border: 1px solid ${GEOTokens.colors.border};
            border-radius: ${GEOTokens.radius.md}; font-size: 14px; outline: none;">
          <button class="shell-nav-item" data-page-action="semantic-search" style="
            background: ${GEOTokens.colors.brand}; color: white; border: none;
            padding: 10px 24px; border-radius: ${GEOTokens.radius.md};
            font-size: 14px; font-weight: 500; cursor: pointer;
          ">搜索</button>
        </div>
        <div style="
          background: #f8fafc;
          border-radius: ${GEOTokens.radius.md};
          padding: 16px;
          font-size: 13px;
          color: ${GEOTokens.colors.textSecondary};
        ">
          语义搜索能够理解关键词的上下文含义，不仅仅是关键词匹配。
          输入搜索内容后，系统将在知识图谱中查找最相关的实体和关系。
        </div>
      </div>
    </div>
  `;
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    brand: '🏷️',
    product: '📦',
    person: '👤',
    organization: '🏢',
    topic: '📌',
    concept: '💡',
    keyword: '🔑',
    location: '📍',
    event: '📅',
  };
  return icons[type] || '🔵';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
