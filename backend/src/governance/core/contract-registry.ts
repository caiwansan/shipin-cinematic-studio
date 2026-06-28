export interface ContractEntry {
  typeName: string;
  sourceFile: string;
  routes: string[];
  isActive: boolean;
  coverage: number;
}

export class ContractRegistry {
  private static contracts: Map<string, ContractEntry> = new Map();

  static register(name: string, entry: ContractEntry): void {
    this.contracts.set(name, entry);
  }

  static get(name: string): ContractEntry | undefined {
    return this.contracts.get(name);
  }

  static getAll(): ContractEntry[] {
    return Array.from(this.contracts.values());
  }

  static coverage(): number {
    const all = this.getAll();
    if (all.length === 0) return 0;
    return all.filter(c => c.isActive).length / all.length;
  }
}
