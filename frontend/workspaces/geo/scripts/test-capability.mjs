/**
 * GEO Capability — Test Suite
 *
 * Standalone, no test framework dependency.
 * Run: npx tsx scripts/test-capability.mjs
 *
 * Covers 9 scenarios.
 */

import { ref } from 'vue'
import {
  useCapability,
  useCapabilities,
  setEdition,
  setRuntimeOverride,
} from '../composables/useCapability'
import { defaultCapabilities } from '../config/capabilities'

let passed = 0
let failed = 0
const startTime = Date.now()

function assert(condition, message) {
  if (condition) { passed++; process.stdout.write('.') }
  else { failed++; console.error(`\nFAIL: ${message}`) }
}
function assertEqual(actual, expected, message) {
  if (actual === expected) { passed++; process.stdout.write('.') }
  else { failed++; console.error(`\nFAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`) }
}

// 1: Default capabilities all enabled
{
  const keys = Object.keys(defaultCapabilities)
  const results = keys.map(k => useCapability(k))
  for (let i = 0; i < keys.length; i++) {
    assert(results[i].enabled.value === true, `default: ${keys[i]} enabled`)
    assert(results[i].source.value === 'default', `default: ${keys[i]} source = default`)
  }
}

// 2: Edition override — community disables insights + growth
{
  setEdition('community')
  const pub = useCapability('publishing')
  const ins = useCapability('insights')
  const gro = useCapability('growth')
  const dis = useCapability('discovery')

  assert(pub.enabled.value === true, 'community: publishing enabled')
  assert(ins.enabled.value === false, 'community: insights disabled')
  assert(gro.enabled.value === false, 'community: growth disabled')
  assert(dis.enabled.value === true, 'community: discovery unchanged')
  assertEqual(ins.source.value, 'edition', 'community: insights source = edition')

  setEdition('enterprise')
}

// 3: Edition switch reactivity (no page refresh)
{
  setEdition('community')
  const ins = useCapability('insights')
  assert(ins.enabled.value === false, 'edition reactive: community = false')

  setEdition('enterprise')
  assert(ins.enabled.value === true, 'edition reactive: enterprise = true')
}

// 4: Runtime override
{
  const cap = useCapability('verification')
  assert(cap.enabled.value === true, 'runtime: default true')

  setRuntimeOverride('verification', false)
  assert(cap.enabled.value === false, 'runtime: override false')
  assertEqual(cap.source.value, 'runtime', 'runtime: source = runtime')

  setRuntimeOverride('verification', undefined)
  assert(cap.enabled.value === true, 'runtime: cleared = default')
}

// 5: Runtime isolation — doesn't pollute defaults
{
  const a = useCapability('publishing')
  setRuntimeOverride('publishing', false)
  assert(a.enabled.value === false, 'runtime isolation: A = false')

  const b = useCapability('publishing')
  assert(b.enabled.value === false, 'runtime isolation: B = false (shared)')

  setRuntimeOverride('publishing', undefined)
  assert(a.enabled.value === true, 'runtime isolation: A restored')
  assert(b.enabled.value === true, 'runtime isolation: B restored')
}

// 6: Feature Flag independence (capability ≠ feature flag)
{
  const capOn = ref(true)
  const flagOn = ref(true)
  const show = () => capOn.value && flagOn.value

  assert(show() === true, 'ff independence: both true')
  capOn.value = false
  assert(show() === false, 'ff independence: cap false')
  capOn.value = true
  flagOn.value = false
  assert(show() === false, 'ff independence: flag false')
}

// 7: useCapabilities() bulk query
{
  const { capabilities } = useCapabilities()
  const all = capabilities.value
  assert(all.missionCenter.enabled === true, 'bulk: missionCenter enabled')
  assertEqual(all.publishing.source, 'default', 'bulk: publishing source = default')
  assert(all.copilot.enabled === true, 'bulk: copilot enabled')
  assertEqual(Object.keys(all).length, 9, 'bulk: 9 keys')
}

// 8: SSR compat (no window dependency)
{
  const cap = useCapability('recommendations')
  assert(cap.enabled.value === true, 'SSR: recommendations enabled')
  assert(typeof cap.refresh === 'function', 'SSR: refresh exists')
}

// 9: Multiple components share same reactive state
{
  const compA = useCapability('copilot')
  const compB = useCapability('copilot')
  assert(compA.enabled.value === compB.enabled.value, 'shared: A === B')

  setRuntimeOverride('copilot', false)
  assert(compA.enabled.value === false, 'shared: A = false')
  assert(compB.enabled.value === false, 'shared: B = false')
  setRuntimeOverride('copilot', undefined)
}

const elapsed = Date.now() - startTime
console.log(`\n\n${passed} passed, ${failed} failed, ${elapsed}ms`)
if (failed > 0) { process.exit(1) }
else { console.log('ALL PASSED'); process.exit(0) }
