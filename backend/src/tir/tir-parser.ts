/**
 * TIR — Parser (Token Stream → DirectorIRGraph)
 * TIR 语法分析器 — 将 Token 流编译成 DirectorIRGraph
 *
 * 编译管道：
 *   TIR TEXT → Tokenizer → AST Builder → Graph Linker → DirectorIRGraph
 *
 * 设计原则：
 *   - 确定性解析（无歧义语法）
 *   - loss-minimized（所有信息保留）
 *   - parse-time 不做任何优化
 */

import { TIRTokenizer, Token, TokenKind, TokenizerError } from './tir-tokenizer.js'
import {
  DirectorIRGraph,
  DirectorIRNode,
  DirectorIREdge,
  DirectorIRNodeType,
  DirectorIREdgeType,
  CompilePass,
  createEmptyIR,
  createIRNode,
} from '../director-ir/director-ir-types.js'

// ── Intermediate AST Types ──

export interface TIRSceneAST {
  name: string
  shots: TIRShotAST[]
  edges: TIREDGEAST[]
  constraints: TIRConstraintAST[]
  annotations: Map<string, string | number | string[]>
  tensionCurve?: number[]
  arcType?: string
}

export interface TIRShotAST {
  id: string
  text: string
  annotations: Map<string, any>
  constraints: TIRConstraintAST[]
}

export interface TIREDGEAST {
  from: string
  to: string
  weight: number
  type: string
  hard: boolean
  ruleId?: string
}

export interface TIRConstraintAST {
  scope: 'scene' | 'shot' | 'global'
  target: string
  rules: string[]
}

export interface TIRDocumentAST {
  scenes: TIRSceneAST[]
  globalConstraints: TIRConstraintAST[]
  globalAnnotations: Map<string, any>
  arcType?: string
  maxTensionCurve?: number[]
}

// ── Parse Error ──

export class ParseError extends Error {
  constructor(message: string, public token?: Token) {
    const loc = token ? `[TIR:${token.line}:${token.col}]` : '[TIR]'
    super(`${loc} ${message}`)
    this.name = 'ParseError'
  }
}

// ── Parser ──

export class TIRParser {
  private pos = 0
  private tokens: Token[] = []
  private warnings: string[] = []

  parse(input: string): { graph: DirectorIRGraph; warnings: string[] } {
    const tokenizer = new TIRTokenizer(input)
    this.tokens = tokenizer.tokenize()
    this.pos = 0
    this.warnings = []

    try {
      const ast = this.parseDocument()
      const graph = this.buildGraph(ast)
      return { graph, warnings: this.warnings }
    } catch (e) {
      if (e instanceof ParseError) throw e
      if (e instanceof TokenizerError) throw e
      throw new ParseError(`Unexpected error: ${e}`)
    }
  }

  // ── Document ──

  private parseDocument(): TIRDocumentAST {
    const doc: TIRDocumentAST = {
      scenes: [],
      globalConstraints: [],
      globalAnnotations: new Map(),
    }

    while (this.peek().kind !== TokenKind.EOF) {
      const tok = this.peek()

      switch (tok.kind) {
        case TokenKind.AT_ARC:
          this.advance()
          doc.arcType = this.expect(TokenKind.IDENTIFIER).value
          break

        case TokenKind.AT_MAX_TENSION:
          this.advance()
          this.expect(TokenKind.LBRACKET)
          doc.maxTensionCurve = this.parseNumberList()
          this.expect(TokenKind.RBRACKET)
          break

        case TokenKind.SCENE:
          doc.scenes.push(this.parseScene())
          break

        case TokenKind.CONSTRAIN:
          doc.globalConstraints.push(this.parseConstraint('global'))
          break

        case TokenKind.ANNOTATION:
          {
            const ann = this.advance()
            const value = this.parseAnnotationValue()
            doc.globalAnnotations.set(ann.value, value)
          }
          break

        default:
          // 跳过无法识别的 token 并记录警告
          this.warnings.push(`[${tok.line}:${tok.col}] Unexpected token '${tok.value}'`)
          this.advance()
      }
    }

    return doc
  }

  // ── Scene ──

  private parseScene(): TIRSceneAST {
    this.expect(TokenKind.SCENE)
    const name = this.expect(TokenKind.STRING).value
    this.expect(TokenKind.LBRACE)

    const scene: TIRSceneAST = {
      name,
      shots: [],
      edges: [],
      constraints: [],
      annotations: new Map(),
    }

    while (this.peek().kind !== TokenKind.RBRACE && this.peek().kind !== TokenKind.EOF) {
      const tok = this.peek()

      switch (tok.kind) {
        case TokenKind.SHOT:
          scene.shots.push(this.parseShot())
          break

        case TokenKind.IDENTIFIER:
          scene.edges.push(this.parseEdge())
          break

        case TokenKind.CONSTRAIN:
          scene.constraints.push(this.parseConstraint('scene'))
          break

        case TokenKind.ANNOTATION:
          {
            const ann = this.advance()
            const value = this.parseAnnotationValue()
            scene.annotations.set(ann.value, value)
          }
          break

        default:
          this.warnings.push(`[${tok.line}:${tok.col}] Unexpected token '${tok.value}' in scene`)
          this.advance()
      }
    }

    this.expect(TokenKind.RBRACE)
    return scene
  }

  // ── Shot ──

  private parseShot(): TIRShotAST {
    this.expect(TokenKind.SHOT)
    const id = this.expect(TokenKind.IDENTIFIER).value
    const text = this.expect(TokenKind.STRING).value
    this.expect(TokenKind.LBRACE)

    const shot: TIRShotAST = {
      id,
      text,
      annotations: new Map(),
      constraints: [],
    }

    while (this.peek().kind !== TokenKind.RBRACE && this.peek().kind !== TokenKind.EOF) {
      const tok = this.peek()

      switch (tok.kind) {
        case TokenKind.ANNOTATION:
          {
            const ann = this.advance()
            const value = this.parseAnnotationValue()
            shot.annotations.set(ann.value, value)
          }
          break

        case TokenKind.CONSTRAIN:
          shot.constraints.push(this.parseConstraint('shot'))
          break

        default:
          this.warnings.push(`[${tok.line}:${tok.col}] Unexpected token '${tok.value}' in shot`)
          this.advance()
      }
    }

    this.expect(TokenKind.RBRACE)
    return shot
  }

  // ── Edge ──

  private parseEdge(): TIREDGEAST {
    const from = this.expect(TokenKind.IDENTIFIER).value

    const arrowTok = this.peek()
    let edgeType: string
    if (arrowTok.kind === TokenKind.ARROW_SEMANTIC) {
      this.advance()
      edgeType = 'semantic'
    } else if (arrowTok.kind === TokenKind.ARROW) {
      this.advance()
      edgeType = 'temporal'
    } else {
      throw new ParseError(`Expected '->' or '->>' after identifier '${from}'`, arrowTok)
    }

    const to = this.expect(TokenKind.IDENTIFIER).value

    const edge: TIREDGEAST = {
      from,
      to,
      weight: 1.0,
      type: edgeType,
      hard: false,
    }

    // 可选：{ ... }
    if (this.peek().kind === TokenKind.LBRACE) {
      this.advance() // {
      while (this.peek().kind !== TokenKind.RBRACE && this.peek().kind !== TokenKind.EOF) {
        const optTok = this.advance()

        switch (optTok.value) {
          case 'weight':
            edge.weight = parseFloat(this.expect(TokenKind.NUMBER).value)
            break
          case 'causal':
            edge.type = 'causal'
            break
          case 'semantic':
            edge.type = 'semantic'
            break
          case 'temporal':
            edge.type = 'temporal'
            break
          case 'derivation':
            edge.type = 'derivation'
            break
          case 'constraint':
            edge.type = 'narrative_constraint'
            break
          case 'hard':
            edge.hard = true
            break
          case 'rule_id':
            this.expect(TokenKind.EQUALS)
            edge.ruleId = this.expect(TokenKind.STRING).value
            break
          default:
            this.warnings.push(`[${optTok.line}:${optTok.col}] Unknown edge option '${optTok.value}'`)
        }
      }
      this.expect(TokenKind.RBRACE)
    }

    return edge
  }

  // ── Constraint ──

  private parseConstraint(scope: 'scene' | 'shot' | 'global'): TIRConstraintAST {
    this.expect(TokenKind.CONSTRAIN)
    const target = this.expect(TokenKind.IDENTIFIER).value
    this.expect(TokenKind.LBRACE)

    const constraint: TIRConstraintAST = { scope, target, rules: [] }

    while (this.peek().kind !== TokenKind.RBRACE && this.peek().kind !== TokenKind.EOF) {
      const tok = this.advance()
      let rule = ''

      switch (tok.kind) {
        case TokenKind.FORBID:
          rule = 'forbid ' + this.expect(TokenKind.IDENTIFIER).value
          break
        case TokenKind.MUST:
          rule = 'must ' + this.expect(TokenKind.IDENTIFIER).value
          if (this.peek().kind === TokenKind.EQUALS) {
            this.advance() // =
            rule += '=' + this.expect(TokenKind.IDENTIFIER).value
          }
          if (this.peek().kind === TokenKind.IN) {
            this.advance()
            this.expect(TokenKind.LBRACKET)
            rule += '∈[' + this.expect(TokenKind.NUMBER).value
            rule += ',' + this.expect(TokenKind.NUMBER).value
            this.expect(TokenKind.RBRACKET)
            rule += ']'
          }
          break
        default:
          this.warnings.push(`[${tok.line}:${tok.col}] Unexpected token in constraint: '${tok.value}'`)
      }

      if (rule) constraint.rules.push(rule)
    }

    this.expect(TokenKind.RBRACE)
    return constraint
  }

  // ── Annotation Value ──

  private parseAnnotationValue(): any {
    const tok = this.peek()

    switch (tok.kind) {
      case TokenKind.NUMBER:
        this.advance()
        return tok.value.includes('.') ? parseFloat(tok.value) : parseInt(tok.value, 10)

      case TokenKind.STRING:
        this.advance()
        return tok.value

      case TokenKind.IDENTIFIER:
        this.advance()
        return tok.value

      case TokenKind.LBRACKET:
        return this.parseAnnotationArray()

      case TokenKind.LBRACE:
        return this.parseAnnotationObject()

      default:
        this.warnings.push(`[${tok.line}:${tok.col}] Expected annotation value, got '${tok.value}'`)
        this.advance()
        return tok.value
    }
  }

  private parseAnnotationArray(): any[] {
    this.expect(TokenKind.LBRACKET)
    const values: any[] = []

    if (this.peek().kind !== TokenKind.RBRACKET) {
      values.push(this.parseAnnotationValue())
      while (this.peek().kind === TokenKind.COMMA) {
        this.advance()
        values.push(this.parseAnnotationValue())
      }
    }

    this.expect(TokenKind.RBRACKET)
    return values
  }

  private parseAnnotationObject(): Record<string, any> {
    this.expect(TokenKind.LBRACE)
    const obj: Record<string, any> = {}

    while (this.peek().kind !== TokenKind.RBRACE && this.peek().kind !== TokenKind.EOF) {
      const key = this.expect(TokenKind.IDENTIFIER).value
      this.expect(TokenKind.EQUALS)
      obj[key] = this.parseAnnotationValue()
    }

    this.expect(TokenKind.RBRACE)
    return obj
  }

  // ── Number List ──

  private parseNumberList(): number[] {
    const nums: number[] = []

    if (this.peek().kind === TokenKind.NUMBER) {
      nums.push(parseFloat(this.expect(TokenKind.NUMBER).value))
      while (this.peek().kind === TokenKind.COMMA) {
        this.advance()
        nums.push(parseFloat(this.expect(TokenKind.NUMBER).value))
      }
    }

    return nums
  }

  // ── Graph Builder（AST → DirectorIRGraph）──

  private buildGraph(ast: TIRDocumentAST): DirectorIRGraph {
    const graph = createEmptyIR('tir_parsed')
    const scenePrefix = new Map<string, string>() // shot id → scene name

    // 1. 全局元数据
    if (ast.arcType) {
      graph.metadata.title = ast.arcType
    }

    // 2. 遍历所有 scene
    for (const scene of ast.scenes) {
      // Scene-level 元数据
      const sceneTension = scene.annotations.get('@tension')
      const sceneLocation = scene.annotations.get('@location')

      // Scene 级别的 tension curve
      if (scene.tensionCurve) {
        // 可以在 meta 中记录
      }

      // 3. 创建 shot 节点
      for (const shot of scene.shots) {
        const sceneIdx = ast.scenes.indexOf(scene)
        const shotIdx = ast.scenes
          .slice(0, sceneIdx)
          .reduce((sum, s) => sum + s.shots.length, 0) + scene.shots.indexOf(shot)

        const tension = shot.annotations.get('@tension') as number | undefined
        const motion = shot.annotations.get('@motion') as string | undefined
        const grammar = shot.annotations.get('@grammar') as string | undefined
        const emotion = shot.annotations.get('@emotion') as string | undefined
        const characters = shot.annotations.get('@character') as string[] | string | undefined
        const duration = shot.annotations.get('@duration') as string | undefined
        const location = shot.annotations.get('@location') as string | undefined
        const tags = shot.annotations.get('@tags') as string[] | undefined

        // 带 scene prefix 的 ID
        const nodeId = `${scene.name.replace(/[\s"]/g, '_')}.${shot.id}`
        scenePrefix.set(shot.id, scene.name)

        const node = createIRNode({
          id: nodeId,
          type: 'shot',
          sceneIndex: sceneIdx,
          shotIndex: shotIdx,
          runtime: {
            text: shot.text,
            motionStyle: motion,
            grammarType: grammar,
            emotionType: emotion,
            characters: characters ? (Array.isArray(characters) ? characters : [characters]) : undefined,
            duration,
            location: location ?? sceneLocation,
            tags,
          },
          causal: {
            tension: tension ?? (sceneTension as number) ?? 0.5,
          },
        })

        graph.nodes.set(nodeId, node)
      }
    }

    // 4. 创建边（按 scene 分组）
    for (const scene of ast.scenes) {
      const scenePrefixName = scene.name.replace(/[\s"]/g, '_')

      for (const edge of scene.edges) {
        const fromId = edge.from.includes('.')
          ? edge.from
          : `${scenePrefixName}.${edge.from}`
        const toId = edge.to.includes('.')
          ? edge.to
          : `${scenePrefixName}.${edge.to}`

        // 边类型映射
        let edgeType: DirectorIREdgeType
        switch (edge.type) {
          case 'causal': edgeType = 'causal'; break
          case 'semantic': edgeType = 'semantic'; break
          case 'derivation': edgeType = 'derivation'; break
          case 'narrative_constraint': edgeType = 'narrative_constraint'; break
          default: edgeType = 'temporal'; break
        }

        const ireEdge: DirectorIREdge = {
          id: `tir_${fromId}→${toId}`,
          from: fromId,
          to: toId,
          type: edgeType,
          weight: edge.weight,
        }

        if (edge.hard || edge.ruleId) {
          ireEdge.constraint = {
            hard: edge.hard,
            ruleId: edge.ruleId,
          }
        }

        graph.edges.push(ireEdge)
      }
    }

    // 5. 注入约束
    for (const constraint of ast.globalConstraints) {
      const targetNode = graph.nodes.get(constraint.target)
      if (targetNode) {
        targetNode.state.narrative.violations = [
          ...(targetNode.state.narrative.violations ?? []),
          ...constraint.rules,
        ]
      }
    }

    for (const scene of ast.scenes) {
      const scenePrefixName = scene.name.replace(/[\s"]/g, '_')

      for (const constraint of scene.constraints) {
        const targetId = `${scenePrefixName}.${constraint.target}`
        const targetNode = graph.nodes.get(targetId)
        if (targetNode) {
          targetNode.state.narrative.violations = [
            ...(targetNode.state.narrative.violations ?? []),
            ...constraint.rules,
          ]
        }
      }
    }

    graph.metadata.shotCount = graph.nodes.size
    graph.metadata.sceneCount = ast.scenes.length
    graph.metadata.sceneNames = {}
    for (const scene of ast.scenes) {
      const idx = ast.scenes.indexOf(scene)
      graph.metadata.sceneNames[idx] = scene.name
    }

    // 后处理：修复跨 scene 的 edge 引用
    // 如果一个 edge 的 from/to 在当前 scene 中不存在，
    // 尝试在全局节点中搜索（按 shot id 后缀匹配）
    // 先收集需要修复的 edge 索引
    type EdgeFix = { idx: number; fixFrom?: string; fixTo?: string }
    const edgeFixes: EdgeFix[] = []

    graph.edges.forEach((edge, idx) => {
      let fixFrom: string | undefined
      let fixTo: string | undefined

      if (!graph.nodes.has(edge.from)) {
        const shortId = edge.from.split('.').pop()
        for (const [nid] of graph.nodes) {
          if (nid.endsWith(`.${shortId}`)) {
            fixFrom = nid
            break
          }
        }
      }
      if (!graph.nodes.has(edge.to)) {
        const shortId = edge.to.split('.').pop()
        for (const [nid] of graph.nodes) {
          if (nid.endsWith(`.${shortId}`)) {
            fixTo = nid
            break
          }
        }
      }

      if (fixFrom || fixTo) {
        edgeFixes.push({ idx, fixFrom, fixTo })
      }
    })

    // 从后往前移除有问题的 edge，然后添加修复后的
    const edgesToAdd: DirectorIREdge[] = []
    for (const fix of edgeFixes.reverse()) {
      const edge = graph.edges.splice(fix.idx, 1)[0]
      if (edge) {
        edgesToAdd.push({
          ...edge,
          id: `${fix.fixFrom ?? edge.from}→${fix.fixTo ?? edge.to}`,
          from: fix.fixFrom ?? edge.from,
          to: fix.fixTo ?? edge.to,
        })
      }
    }
    graph.edges.push(...edgesToAdd)

    graph.metadata.updatedAt = Date.now()

    return graph
  }

  // ── Token Helpers ──

  private peek(): Token {
    return this.tokens[this.pos] ?? { kind: TokenKind.EOF, value: '', line: 0, col: 0 }
  }

  private advance(): Token {
    return this.tokens[this.pos++] ?? { kind: TokenKind.EOF, value: '', line: 0, col: 0 }
  }

  private expect(kind: TokenKind): Token {
    const tok = this.peek()
    if (tok.kind !== kind) {
      throw new ParseError(
        `Expected ${kind}, got '${tok.value}' (${tok.kind})`,
        tok,
      )
    }
    return this.advance()
  }
}
