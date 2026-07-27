/**
 * ResumeStorage — 存储抽象接口
 *
 * Gate 7: 存储抽象（Storage Adapter）
 * 业务代码不直接依赖本地文件系统，通过抽象接口访问存储。
 * Beta 0.3 使用 LocalStorage，GA 可切换为 CosStorage。
 */

export interface ResumeStorage {
  /**
   * 保存文件到存储
   * @param file 文件 Buffer
   * @param path 存储路径（相对路径）
   * @returns 文件的完整访问路径
   */
  save(file: Buffer, path: string): Promise<string>

  /**
   * 从存储读取文件
   * @param path 存储路径
   * @returns 文件 Buffer
   */
  read(path: string): Promise<Buffer>

  /**
   * 删除存储中的文件
   * @param path 存储路径
   */
  delete(path: string): Promise<void>

  /**
   * 检查文件是否存在
   * @param path 存储路径
   */
  exists(path: string): Promise<boolean>
}

export interface ResumeStorageConfig {
  type: 'local' | 'cos'
  basePath: string
}
