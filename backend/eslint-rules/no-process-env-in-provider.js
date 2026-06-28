/**
 * ESLint Rule: no-process-env-in-provider
 * 
 * provider 代码禁止直接读 process.env，必须通过 RuntimeContext
 * 
 * Rule Configuration:
 *   - "always" (default): 禁止所有 process.env 访问
 *   - "allow" with allowList: 允许特定 key
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow process.env in provider code — use RuntimeContext instead",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowList: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
          allowAll: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {}
    const allowList = options.allowList || []
    const allowAll = options.allowAll || false
    
    // 仅对 services/ 和 queue/ 下的 provider 文件生效
    const filename = context.getFilename()
    if (!filename.includes('/services/') && !filename.includes('/queue/')) {
      return {}
    }
    // 只对 provider 文件生效（含 services/ 下大部分文件和 queue/worker-runtime）
    if (!filename.match(/provider|worker-runtime/)) {
      return {}
    }

    return {
      MemberExpression(node) {
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object?.name === 'process' &&
          node.object.property?.name === 'env'
        ) {
          // 获取访问的 key
          const keyNode = node.property
          let keyName = null
          if (keyNode.type === 'Literal') {
            keyName = keyNode.value
          } else if (keyNode.type === 'Identifier') {
            keyName = keyNode.name
          }

          if (allowAll) return
          if (keyName && allowList.includes(keyName)) return

          context.report({
            node,
            message: `❌ provider 中禁止直接访问 process.env${keyName ? `.${keyName}` : ''} — 使用 RuntimeContext`,
          })
        }
      },
    }
  },
}
