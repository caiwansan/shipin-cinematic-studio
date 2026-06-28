/**
 * scripts/verify-membership-tier.ts
 *
 * Verify getEffectiveTier() behavior with edge cases.
 *
 * Run: npx tsx scripts/verify-membership-tier.ts
 */

import { getEffectiveTier, isPaidTier } from '../src/utils/membership-tier.js'

const tests = [
  // Case 1: Membership=tier set, User=free
  {
    name: 'Membership=svip, User=free',
    input: { membership: { tier: 'svip' }, memberTier: 'free' },
    expected: 'svip',
  },
  // Case 2: Membership=null, User=vip
  {
    name: 'Membership=null, User=vip',
    input: { membership: null, memberTier: 'vip' },
    expected: 'vip',
  },
  // Case 3: Both null
  {
    name: 'Both null',
    input: { membership: null, memberTier: null },
    expected: 'free',
  },
  // Case 4: Membership=basic, User=null
  {
    name: 'Membership=basic, User=null',
    input: { membership: { tier: 'basic' }, memberTier: null },
    expected: 'basic',
  },
  // Case 5: Membership=null, User=null, undefined
  {
    name: 'Empty object',
    input: { membership: undefined, memberTier: undefined },
    expected: 'free',
  },
  // Case 6: isPaidTier
  {
    name: 'isPaidTier with free',
    input: { membership: { tier: 'free' }, memberTier: null },
    expectedBool: false,
  },
  {
    name: 'isPaidTier with pro',
    input: { membership: { tier: 'pro' }, memberTier: null },
    expectedBool: true,
  },
]

let passed = 0
let failed = 0

for (const test of tests) {
  if ('expected' in test) {
    const result = getEffectiveTier(test.input as any)
    const ok = result === test.expected
    if (ok) passed++; else failed++
    console.log(`${ok ? '✅' : '❌'} ${test.name}: got "${result}", expected "${test.expected}"`)
  }
  if ('expectedBool' in test) {
    const result = isPaidTier(test.input as any)
    const ok = result === test.expectedBool
    if (ok) passed++; else failed++
    console.log(`${ok ? '✅' : '❌'} ${test.name}: got ${result}, expected ${test.expectedBool}`)
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`)
process.exit(failed > 0 ? 1 : 0)
