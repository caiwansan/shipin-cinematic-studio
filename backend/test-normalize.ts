import { normalize, matchSeed, convertAllU0Seeds } from './src/decision-runtime/p0/u1-seed-matcher.js'
import { DEFAULT_SEEDS } from './src/decision-runtime/p0/u0-seed-schema.js'

const tokens = normalize('阿里巴巴最新财报分析')
console.log('tokens for "阿里巴巴最新财报分析":')
console.log(tokens)

const fullQuery = tokens.join('')
console.log('fullQuery:', fullQuery)
console.log('includes "财报":', fullQuery.includes('财报'))
