openapi: 3.0.0
info:
  title: GEO Explain API — 统一 Explain 平台
  description: |
    GEO Explain API 是 GEO Workspace 的统一 Explain 平台入口。
    所有 Explain 内容（Mission/Verification/Knowledge/Discovery）都通过
    单一 endpoint 获取，返回统一 ExplainDocument 格式。
    
    基于 ADR-001（Explain 作为 GEO 横向平台能力），不再按资源拆分路由。
    
    Base URL: /api/geo
  version: v1
  contact:
    name: GEO Workspace Team
x-sprint: v1.1-sprint1
x-adr: ADR-001-explain-platform.md

servers:
  - url: /api/geo
    description: GEO Workspace API

paths:
  /explain:
    get:
      summary: 获取统一 Explain 数据
      description: |
        返回指定源数据的统一 Explain 数据（ExplainDocument 格式）。
        根据 type 参数路由到对应的 ExplainProvider。
        
        支持的 type 值:
        - mission: Mission 决策解释
        - verification: 验证结果解释
        - knowledge: 知识图谱解释
        - discovery: 发现扫描解释
        - presence: AI Presence 解释
        - recommendation: 优化建议解释
        
        （未来可扩展: timeline 等）
      operationId: getExplain
      tags:
        - Explain Platform
      parameters:
        - name: type
          in: query
          required: true
          description: Explain 类型（不区分业务知识，只用于路由）
          schema:
            type: string
            enum:
              - mission
              - verification
              - knowledge
              - discovery
              - presence
              - recommendation
          example: "mission"
        - name: id
          in: query
          required: true
          description: 源数据 ID（如 Mission ID / Verification ID 等）
          schema:
            type: string
            format: uuid
          example: "source-uuid-abc-123"
      responses:
        '200':
          description: 成功返回 ExplainDocument
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    description: 请求是否成功
                    example: true
                  data:
                    $ref: '#/components/schemas/ExplainDocument'
        '400':
          description: 参数错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: "type and id are required"
                code: "MISSING_PARAM"
        '404':
          description: 源数据或 Provider 未找到
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: "No ExplainProvider found for type: unknown_type"
                code: "NOT_FOUND"
        '500':
          description: 内部错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                error: "Explain Engine error"
                code: "EXPLAIN_ERROR"

components:
  schemas:
    ExplainDocument:
      type: object
      description: |
        统一 Explain Document，所有 Explain 类型共享此格式。
        前端按 sections[].type 渲染，不关心 metadata.type。
      required:
        - id
        - title
        - summary
        - sections
        - metadata
      properties:
        id:
          type: string
          description: Explain ID（每次生成唯一）
          example: "mission-explain-uuid-xxx"
        title:
          type: string
          description: 简短标题
          example: "补充 FAQ 页面 Schema"
        summary:
          type: string
          description: 1-3 句话说明核心结论
          example: "您的品牌在 AI 搜索结果中缺乏 FAQ Schema 标记，导致智能摘要展示效果不佳"
        sections:
          type: array
          description: 数据驱动的 Section 列表
          items:
            $ref: '#/components/schemas/ExplainSection'
        confidence:
          type: number
          nullable: true
          description: 置信度 (0-1)，由决策引擎提供，可为 null
          minimum: 0
          maximum: 1
          example: null
        metadata:
          $ref: '#/components/schemas/ExplainMetadata'

    ExplainSection:
      type: object
      description: 数据驱动的 Section
      required:
        - type
        - title
        - order
        - items
      properties:
        type:
          type: string
          description: Section 类型
          enum:
            - evidence
            - threshold
            - impact
            - rule
            - reasoning
            - recommendation
            - metric
            - timeline
          example: "evidence"
        title:
          type: string
          description: Section 标题
          example: "证据概览"
        order:
          type: integer
          description: 渲染顺序
          example: 0
        items:
          type: array
          description: 该 Section 的数据项列表
          items:
            $ref: '#/components/schemas/ExplainItem'

    ExplainItem:
      type: object
      description: 单条数据项
      required:
        - id
        - label
        - value
      properties:
        id:
          type: string
          description: 项唯一标识
          example: "evidence-impact-AI引用率"
        label:
          type: string
          description: 标签/名称
          example: "AI引用率"
        value:
          oneOf:
            - type: string
            - type: number
            - type: boolean
            - type: "null"
          description: 值
          example: "+18%"
        detail:
          type: string
          description: 展开详情
          example: "执行后可预期提升 18%"
        source:
          type: string
          description: 数据来源引用（必须指向真实数据 ID）
          example: "mission-uuid-xxx"
        confidence:
          type: number
          description: 该项的置信度 (0-1)
          minimum: 0
          maximum: 1
        status:
          type: string
          description: 状态标识
          enum:
            - positive
            - negative
            - neutral
            - action_required
          example: "positive"

    ExplainMetadata:
      type: object
      description: Explain 元数据
      required:
        - type
        - sourceId
        - sourceType
        - generatedAt
        - provider
        - version
      properties:
        type:
          type: string
          description: 业务类型（前端不使用，仅为可追溯性）
          enum:
            - mission
            - verification
            - knowledge
            - discovery
          example: "mission"
        sourceId:
          type: string
          description: 原始数据 ID
          example: "mission-uuid-xxx"
        sourceType:
          type: string
          description: Provider 类型
          example: "mission"
        generatedAt:
          type: string
          format: date-time
          description: 生成时间 (ISO 8601)
          example: "2026-01-16T10:30:00.000Z"
        provider:
          type: string
          description: Provider 名称
          example: "MissionExplainProvider"
        version:
          type: string
          description: Schema 版本
          example: "1.0"

    ErrorResponse:
      type: object
      description: 错误响应
      required:
        - success
        - error
      properties:
        success:
          type: boolean
          description: 请求是否成功（false）
          example: false
        error:
          type: string
          description: 错误消息
          example: "No ExplainProvider found for type: unknown_type"
        code:
          type: string
          description: 错误码
          example: "NOT_FOUND"
