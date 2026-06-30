// State machine validity test
// Verifies that valid transitions pass and invalid transitions throw

import { validateTransition } from '../../../../platform/state-machine';

function testValidTransition(name: string, from: string, to: string) {
  const result = validateTransition(name, from, to);
  if (!result.allowed) throw new Error(`Expected valid: ${from} → ${to} in ${name}: ${result.reason}`);
  console.log(`  ✅ Valid: ${from} → ${to}`);
}

function testInvalidTransition(name: string, from: string, to: string) {
  const result = validateTransition(name, from, to);
  if (result.allowed) throw new Error(`Expected invalid: ${from} → ${to} in ${name}`);
  console.log(`  ✅ Blocked: ${from} → ${to}`);
}

console.log('Verification State Machine:');
testValidTransition('verification', 'pending', 'running');
testValidTransition('verification', 'pending', 'cancelled');
testValidTransition('verification', 'running', 'completed');
testValidTransition('verification', 'running', 'failed');
testValidTransition('verification', 'failed', 'retrying');
testValidTransition('verification', 'retrying', 'running');
testValidTransition('verification', 'retrying', 'failed');
testInvalidTransition('verification', 'completed', 'running');
testInvalidTransition('verification', 'cancelled', 'running');
testInvalidTransition('verification', 'completed', 'failed');

console.log('Publishing State Machine:');
testValidTransition('publishing', 'draft', 'approved');
testValidTransition('publishing', 'published', 'verified_online');
testInvalidTransition('publishing', 'draft', 'published');
testInvalidTransition('publishing', 'indexed', 'published');

console.log('Growth State Machine:');
testValidTransition('growth', 'idle', 'aggregating');
testValidTransition('growth', 'aggregating', 'completed');
testInvalidTransition('growth', 'completed', 'aggregating');
testInvalidTransition('growth', 'idle', 'completed');

console.log('State Machine validation: ✅ ALL PASS');
