/**
 * TIR — Textual IR Tokenizer
 * TIR 词法分析器 — 将 TIR 源码拆分成 Token 流
 *
 * 规则：
 *   - 忽略空白和缩进（基于块解析）
 *   - 单行注释：// 或 #
 *   - 块作用域靠 {} 嵌套，不是缩进
 */

export enum TokenKind {
  // 关键字
  SCENE = 'scene',
  SHOT = 'shot',
  CONSTRAIN = 'constrain',
  FORBID = 'forbid',
  MUST = 'must',

  // 弧线修饰
  AT_ARC = '@arc',
  AT_MAX_TENSION = '@max_tension_curve',

  // Annotation 前缀
  ANNOTATION = '@annotation',

  // 箭头
  ARROW = '->',
  ARROW_SEMANTIC = '->>',

  // 标点
  LBRACE = '{',
  RBRACE = '}',
  LBRACKET = '[',
  RBRACKET = ']',
  LPAREN = '(',
  RPAREN = ')',
  EQUALS = '=',
  COMMA = ',',
  IN = '∈',
  NOT_IN = '∉',

  // 字面量
  STRING = 'string',
  NUMBER = 'number',
  IDENTIFIER = 'identifier',

  // 特殊
  EOF = 'eof',
}

export interface Token {
  kind: TokenKind
  value: string
  line: number
  col: number
}

export class TokenizerError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
  ) {
    super(`[TIR:${line}:${col}] ${message}`)
    this.name = 'TokenizerError'
  }
}

export class TIRTokenizer {
  private pos = 0
  private line = 1
  private col = 1
  private tokens: Token[] = []

  constructor(private input: string) {}

  tokenize(): Token[] {
    this.tokens = []

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos]

      // 跳过空白
      if (ch === ' ' || ch === '\t') {
        this.advance()
        continue
      }

      // 换行
      if (ch === '\n') {
        this.line++
        this.col = 1
        this.pos++
        continue
      }

      // 回车
      if (ch === '\r') {
        this.pos++
        continue
      }

      // 注释 //
      if (ch === '/' && this.peek() === '/') {
        this.skipLine()
        continue
      }

      // 注释 #
      if (ch === '#') {
        this.skipLine()
        continue
      }

      // 箭头 -> 或 ->>
      if (ch === '-') {
        // 先检查 ->> (two char lookahead)
        if (this.input[this.pos + 1] === '>' && this.input[this.pos + 2] === '>') {
          this.advance() // -
          this.advance() // >
          this.advance() // >
          this.emit(TokenKind.ARROW_SEMANTIC, '->>')
          continue
        }
        // 再检查 ->
        if (this.peek() === '>') {
          this.advance() // -
          this.advance() // >
          this.emit(TokenKind.ARROW, '->')
          continue
        }
      }

      // ∈
      if (ch === '\u2208') {
        this.advance()
        this.emit(TokenKind.IN, '∈')
        continue
      }

      // ∉
      if (ch === '\u2209') {
        this.advance()
        this.emit(TokenKind.NOT_IN, '∉')
        continue
      }

      // 大括号
      if (ch === '{') {
        this.advance()
        this.emit(TokenKind.LBRACE, '{')
        continue
      }
      if (ch === '}') {
        this.advance()
        this.emit(TokenKind.RBRACE, '}')
        continue
      }

      // 方括号
      if (ch === '[') {
        this.advance()
        this.emit(TokenKind.LBRACKET, '[')
        continue
      }
      if (ch === ']') {
        this.advance()
        this.emit(TokenKind.RBRACKET, ']')
        continue
      }

      // 圆括号
      if (ch === '(') {
        this.advance()
        this.emit(TokenKind.LPAREN, '(')
        continue
      }
      if (ch === ')') {
        this.advance()
        this.emit(TokenKind.RPAREN, ')')
        continue
      }

      // 等号
      if (ch === '=') {
        this.advance()
        this.emit(TokenKind.EQUALS, '=')
        continue
      }

      // 逗号
      if (ch === ',') {
        this.advance()
        this.emit(TokenKind.COMMA, ',')
        continue
      }

      // @annotation
      if (ch === '@') {
        this.readAnnotation()
        continue
      }

      // 字符串
      if (ch === '"') {
        this.readString()
        continue
      }

      // 数字
      if (this.isDigit(ch) || (ch === '.' && this.isDigit(this.peek()))) {
        this.readNumber()
        continue
      }

      // 标识符 / 关键字
      if (this.isIdentStart(ch)) {
        this.readIdentifier()
        continue
      }

      throw new TokenizerError(
        `Unexpected character '${ch}' (code: ${ch.charCodeAt(0)})`,
        this.line,
        this.col,
      )
    }

    this.emit(TokenKind.EOF, '')
    return this.tokens
  }

  private advance(): string {
    const ch = this.input[this.pos]
    this.pos++
    this.col++
    return ch
  }

  private peek(): string {
    return this.input[this.pos + 1] ?? ''
  }

  private emit(kind: TokenKind, value: string): void {
    this.tokens.push({ kind, value, line: this.line, col: this.col })
  }

  private skipLine(): void {
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      this.pos++
      this.col++
    }
  }

  private readAnnotation(): void {
    const startCol = this.col
    this.advance() // @
    let value = '@'
    while (this.pos < this.input.length && this.isIdentPart(this.input[this.pos])) {
      value += this.advance()
    }

    // 检查是否是已知的 annotation 关键字
    switch (value) {
      case '@arc':
        this.emit(TokenKind.AT_ARC, value)
        break
      case '@max_tension_curve':
        this.emit(TokenKind.AT_MAX_TENSION, value)
        break
      default:
        this.emit(TokenKind.ANNOTATION, value)
        break
    }
  }

  private readString(): void {
    this.advance() // opening "
    let value = ''

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos]
      if (ch === '"') {
        this.advance() // closing "
        this.tokens.push({ kind: TokenKind.STRING, value, line: this.line, col: this.col })
        return
      }
      if (ch === '\\') {
        this.advance()
        const next = this.advance()
        switch (next) {
          case 'n': value += '\n'; break
          case 't': value += '\t'; break
          case '"': value += '"'; break
          case '\\': value += '\\'; break
          default: value += '\\' + next; break
        }
      } else {
        value += this.advance()
      }
    }

    throw new TokenizerError('Unterminated string literal', this.line, this.col)
  }

  private readNumber(): void {
    let value = ''
    while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
      value += this.advance()
    }
    if (this.input[this.pos] === '.') {
      value += this.advance()
      while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
        value += this.advance()
      }
    }
    this.emit(TokenKind.NUMBER, value)
  }

  private readIdentifier(): void {
    let value = ''
    while (this.pos < this.input.length && this.isIdentPart(this.input[this.pos])) {
      value += this.advance()
    }

    // 映射关键字
    switch (value) {
      case 'scene':
        this.emit(TokenKind.SCENE, value)
        break
      case 'shot':
        this.emit(TokenKind.SHOT, value)
        break
      case 'constrain':
        this.emit(TokenKind.CONSTRAIN, value)
        break
      case 'forbid':
        this.emit(TokenKind.FORBID, value)
        break
      case 'must':
        this.emit(TokenKind.MUST, value)
        break
      default:
        this.emit(TokenKind.IDENTIFIER, value)
        break
    }
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9'
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
  }

  private isIdentPart(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === '-' || ch === '_' || ch === '.'
  }
}
