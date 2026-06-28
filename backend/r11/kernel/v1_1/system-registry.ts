/**
 * v1_1/system-registry.ts
 *
 * v1.1 — System Registry
 *
 * 多系统注册中心：管理所有被观测的 SystemInstance。
 */

import type { SystemInstance } from "./system-instance";

export class SystemRegistry {
  private systems = new Map<string, SystemInstance>();

  register(system: SystemInstance): void {
    this.systems.set(system.id, system);
  }

  get(id: string): SystemInstance | undefined {
    return this.systems.get(id);
  }

  list(): SystemInstance[] {
    return Array.from(this.systems.values());
  }

  unregister(id: string): boolean {
    return this.systems.delete(id);
  }

  has(id: string): boolean {
    return this.systems.has(id);
  }

  /**
   * 跨系统查询所有同名 operator。
   * 用于比较不同系统之间同一个 δ 的表现差异。
   */
  crossSystemOperator(operatorId: string): Map<string, SystemInstance> {
    const result = new Map<string, SystemInstance>();
    for (const [sysId, sys] of this.systems) {
      if (sys.get(operatorId)) {
        result.set(sysId, sys);
      }
    }
    return result;
  }
}
