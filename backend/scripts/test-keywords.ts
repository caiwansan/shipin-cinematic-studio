import { legalRAG } from '../src/services/legal/legal-rag.service.js'

async function main() {
  // Test the keyword extraction
  const tokens = '网上买东西质量有问题，商家不退钱'.split(/[\s,，、。.；;：:！!？?()（）【】\[\]{}"'""''"\n\r\t]+/).filter(k => k.length > 0)
  console.log('Tokens:', tokens)
  
  const keywords: string[] = []
  for (const token of tokens) {
    if (token.length > 5) {
      for (let i = 0; i < token.length - 1; i++) {
        for (let len = 2; len <= 4 && i + len <= token.length; len++) {
          keywords.push(token.slice(i, i + len))
        }
      }
    } else if (token.length >= 2) {
      keywords.push(token)
    }
  }
  console.log('Keywords:', [...new Set(keywords)])
}

main().catch(console.error)
