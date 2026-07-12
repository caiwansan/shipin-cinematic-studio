import type { GoldenEntry } from './types';
import * as fs from 'fs';
import * as path from 'path';

export interface DatasetMetadata {
  version?: string;
  calibratedAt?: string;
  baselineProvider?: string;
  totalEntries: number;
  industries: string[];
  scenarios: string[];
  loadedAt: string;
}

class GoldenDatasetLoader {
  private entries: GoldenEntry[] = [];
  private loaded = false;
  private metadata: DatasetMetadata | null = null;

  // 从文件加载
  async loadFromFile(filePath: string): Promise<{ metadata: DatasetMetadata; entries: GoldenEntry[] }> {
    try {
      const absPath = path.resolve(filePath);
      const content = fs.readFileSync(absPath, 'utf-8');
      const raw = JSON.parse(content);

      // 兼容数组和 { version, entries } 格式
      const dataset: GoldenEntry[] = Array.isArray(raw) ? raw : raw.entries || [];

      // 完整性校验
      const industries = new Set<string>();
      const scenarios = new Set<string>();
      for (const entry of dataset) {
        if (!entry.id) throw new Error(`条目缺少 id: ${JSON.stringify(entry)}`);
        if (!entry.scenario) throw new Error(`条目 ${entry.id} 缺少 scenario`);
        if (!entry.intent) throw new Error(`条目 ${entry.id} 缺少 intent`);
        if (!entry.expectedBand) throw new Error(`条目 ${entry.id} 缺少 expectedBand`);
        if (entry.industry) industries.add(entry.industry);
        scenarios.add(entry.scenario);
      }

      this.entries = dataset;
      this.loaded = true;
      this.metadata = {
        version: raw.version || '1.0.0',
        calibratedAt: raw.calibratedAt,
        baselineProvider: raw.baselineProvider,
        totalEntries: dataset.length,
        industries: Array.from(industries),
        scenarios: Array.from(scenarios),
        loadedAt: new Date().toISOString(),
      };

      return { metadata: this.metadata, entries: dataset };
    } catch (err: any) {
      throw new Error(`Dataset 加载失败: ${err.message}`);
    }
  }

  // 直接设置数据（用于测试）
  setEntries(entries: GoldenEntry[]): void {
    this.entries = entries;
    this.loaded = true;
    const industries = new Set(entries.filter(e => e.industry).map(e => e.industry!));
    const scenarios = new Set(entries.map(e => e.scenario));
    this.metadata = {
      version: '1.0.0',
      totalEntries: entries.length,
      industries: Array.from(industries),
      scenarios: Array.from(scenarios),
      loadedAt: new Date().toISOString(),
    };
  }

  // 获取版本信息（简写）
  getVersion(): string | undefined {
    return this.metadata?.version;
  }

  // 获取校准元信息
  getCalibrationInfo(): { calibratedAt?: string; baselineProvider?: string } {
    return {
      calibratedAt: this.metadata?.calibratedAt,
      baselineProvider: this.metadata?.baselineProvider,
    };
  }

  // 获取所有条目
  getAll(): GoldenEntry[] {
    return this.entries;
  }

  // 按行业筛选
  getByIndustry(industry: string): GoldenEntry[] {
    return this.entries.filter(e => e.industry === industry);
  }

  // 按场景筛选
  getByScenario(scenario: string): GoldenEntry[] {
    return this.entries.filter(e => e.scenario === scenario);
  }

  // 按意图筛选
  getByIntent(intent: string): GoldenEntry[] {
    return this.entries.filter(e => e.intent === intent);
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getMetadata(): DatasetMetadata | null {
    return this.metadata;
  }

  // 通过 ID 查询
  getById(id: string): GoldenEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  count(): number {
    return this.entries.length;
  }
}

export const goldenDataset = new GoldenDatasetLoader();
