/**
 * benchmark/dataset/loader.ts — Dataset 加载器
 *
 * 从 datasets/v1/ 目录读取 JSON 文件，验证 schema，返回 BenchmarkDataset。
 * Dataset Independence: Runner 只读取 Dataset，不关心格式。
 */
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { BenchmarkDataset, BenchmarkQuestion } from '../types'

const __filename = fileURLToPath(import.meta.url)
const __basedir = dirname(dirname(dirname(dirname(__filename))))
const DATASET_DIR = resolve(__basedir, 'datasets')

interface DatasetFile {
  category: string
  questions: BenchmarkQuestion[]
}

export class DatasetLoader {
  /**
   * 加载指定版本的完整 dataset
   */
  load(version: string): BenchmarkDataset {
    const versionDir = resolve(DATASET_DIR, version)
    
    const files = readdirSync(versionDir).filter(f => f.endsWith('.json'))
    let allQuestions: BenchmarkQuestion[] = []
    
    for (const file of files) {
      const data: DatasetFile = JSON.parse(readFileSync(resolve(versionDir, file), 'utf-8'))
      allQuestions = allQuestions.concat(data.questions)
    }
    
    return {
      meta: {
        version,
        name: `GEO Benchmark Dataset ${version}`,
        description: `GEO Brand Intelligence Benchmark - ${version}`,
        totalQuestions: allQuestions.length,
      },
      questions: allQuestions,
    }
  }
  
  /**
   * 按类别加载
   */
  loadByCategory(version: string, category: string): BenchmarkQuestion[] {
    const filePath = resolve(DATASET_DIR, version, `${category}.json`)
    const data: DatasetFile = JSON.parse(readFileSync(filePath, 'utf-8'))
    return data.questions
  }
  
  /**
   * 按难度过滤
   */
  filterByDifficulty(questions: BenchmarkQuestion[], difficulty: 1 | 2 | 3): BenchmarkQuestion[] {
    return questions.filter(q => q.difficulty === difficulty)
  }
}
