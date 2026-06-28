import type { CapabilityDefinition } from './capability.types.js';
/**
 * 验证 CapabilityDefinition 的合法性。
 * 在注册时自动调用。
 */
export declare function validateCapability(cap: CapabilityDefinition, knownIds: Set<string>): string[];
/**
 * 验证整个 Registry 的完整性。
 */
export declare function validateRegistry(registry: {
    all: readonly CapabilityDefinition[];
}): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
