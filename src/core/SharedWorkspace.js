/**
 * SharedWorkspace - Agent 间共享工作区
 *
 * 功能：
 * - 文件读写操作
 * - 上下文同步
 * - 文件锁定（防止冲突）
 * - 代码搜索
 * - 状态共享
 */

import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

/**
 * SharedWorkspace 类
 */
export class SharedWorkspace extends EventEmitter {
  /**
   * 构造函数
   * @param {string} workspacePath - 工作区根路径
   */
  constructor(workspacePath = process.cwd()) {
    super()

    this.workspacePath = workspacePath
    this.contextStore = new Map()
    this.fileLocks = new Map()
    this.fileCache = new Map()

    // 确保工作区目录存在
    this.ensureWorkspace()
  }

  // ==================== 工作区管理 ====================

  /**
   * 确保工作区目录存在
   */
  ensureWorkspace() {
    if (!fs.existsSync(this.workspacePath)) {
      fs.mkdirSync(this.workspacePath, { recursive: true })
      console.log(`[SharedWorkspace] 创建工作区: ${this.workspacePath}`)
    }
  }

  /**
   * 获取工作区路径
   */
  getWorkspacePath() {
    return this.workspacePath
  }

  /**
   * 设置工作区路径
   */
  setWorkspacePath(newPath) {
    this.workspacePath = newPath
    this.ensureWorkspace()
    this.emit('workspaceChanged', newPath)
  }

  // ==================== 文件操作 ====================

  /**
   * 读取文件
   * @param {string} filePath - 文件路径（相对于工作区）
   * @param {Object} options - 选项
   * @returns {Promise<string>} 文件内容
   */
  async readFile(filePath, options = {}) {
    const fullPath = this.resolvePath(filePath)

    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      throw new Error(`文件不存在: ${filePath}`)
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8')

      // 更新缓存
      this.fileCache.set(filePath, {
        content,
        mtime: fs.statSync(fullPath).mtime,
      })

      this.emit('fileRead', { path: filePath, size: content.length })

      return content
    } catch (error) {
      console.error(`[SharedWorkspace] 读取文件失败: ${filePath}`, error)
      throw error
    }
  }

  /**
   * 写入文件
   * @param {string} filePath - 文件路径（相对于工作区）
   * @param {string} content - 文件内容
   * @param {Object} options - 选项
   * @returns {Promise<void>}
   */
  async writeFile(filePath, content, options = {}) {
    const fullPath = this.resolvePath(filePath)

    // 检查文件是否被锁定
    if (this.isLocked(filePath)) {
      const lockInfo = this.fileLocks.get(filePath)
      throw new Error(`文件被锁定: ${filePath} (锁定者: ${lockInfo.agentId})`)
    }

    try {
      // 确保目录存在
      const dir = path.dirname(fullPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // 写入文件
      fs.writeFileSync(fullPath, content, 'utf-8')

      // 更新缓存
      this.fileCache.set(filePath, {
        content,
        mtime: fs.statSync(fullPath).mtime,
      })

      this.emit('fileWritten', { path: filePath, size: content.length })

      console.log(`[SharedWorkspace] 文件已写入: ${filePath}`)
    } catch (error) {
      console.error(`[SharedWorkspace] 写入文件失败: ${filePath}`, error)
      throw error
    }
  }

  /**
   * 列出目录内容
   * @param {string} dirPath - 目录路径（相对于工作区）
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 文件列表
   */
  async listFiles(dirPath = '.', options = {}) {
    const fullPath = this.resolvePath(dirPath)

    if (!fs.existsSync(fullPath)) {
      throw new Error(`目录不存在: ${dirPath}`)
    }

    try {
      const items = fs.readdirSync(fullPath, { withFileTypes: true })

      const result = items
        .filter((item) => {
          // 过滤隐藏文件
          if (!options.showHidden && item.name.startsWith('.')) {
            return false
          }
          return true
        })
        .map((item) => {
          const itemPath = path.join(fullPath, item.name)
          const stat = fs.statSync(itemPath)

          return {
            name: item.name,
            path: path.join(dirPath, item.name),
            isDirectory: item.isDirectory(),
            isFile: item.isFile(),
            size: stat.size,
            mtime: stat.mtime,
            locked: this.isLocked(path.join(dirPath, item.name)),
          }
        })

      // 排序
      const sortBy = options.sortBy || 'name'
      const sortOrder = options.sortOrder || 'asc'
      result.sort((a, b) => {
        // 目录优先
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1

        // 按字段排序
        let comparison = 0
        if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name)
        } else if (sortBy === 'size') {
          comparison = a.size - b.size
        } else if (sortBy === 'mtime') {
          comparison = a.mtime - b.mtime
        }

        return sortOrder === 'desc' ? -comparison : comparison
      })

      return result
    } catch (error) {
      console.error(`[SharedWorkspace] 列出目录失败: ${dirPath}`, error)
      throw error
    }
  }

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    const fullPath = this.resolvePath(filePath)

    // 检查是否被锁定
    if (this.isLocked(filePath)) {
      throw new Error(`文件被锁定，无法删除: ${filePath}`)
    }

    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
        this.fileCache.delete(filePath)
        this.emit('fileDeleted', { path: filePath })
        console.log(`[SharedWorkspace] 文件已删除: ${filePath}`)
      }
    } catch (error) {
      console.error(`[SharedWorkspace] 删除文件失败: ${filePath}`, error)
      throw error
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  fileExists(filePath) {
    const fullPath = this.resolvePath(filePath)
    return fs.existsSync(fullPath)
  }

  /**
   * 获取文件信息
   * @param {string} filePath - 文件路径
   * @returns {Object} 文件信息
   */
  getFileInfo(filePath) {
    const fullPath = this.resolvePath(filePath)

    if (!fs.existsSync(fullPath)) {
      return null
    }

    const stat = fs.statSync(fullPath)
    return {
      path: filePath,
      name: path.basename(filePath),
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      size: stat.size,
      mtime: stat.mtime,
      atime: stat.atime,
      locked: this.isLocked(filePath),
      lockInfo: this.fileLocks.get(filePath) || null,
    }
  }

  // ==================== 代码搜索 ====================

  /**
   * 搜索代码
   * @param {string} query - 搜索关键词
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 搜索结果
   */
  async searchCode(query, options = {}) {
    const results = []
    const searchPath = options.path || '.'
    const fullPath = this.resolvePath(searchPath)

    const searchInFile = (filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        const matches = []

        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            matches.push({
              line: index + 1,
              content: line.trim(),
            })
          }
        })

        if (matches.length > 0) {
          results.push({
            path: path.relative(this.workspacePath, filePath),
            matches,
            matchCount: matches.length,
          })
        }
      } catch (error) {
        // 忽略无法读取的文件
      }
    }

    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return

      const items = fs.readdirSync(dir, { withFileTypes: true })

      for (const item of items) {
        const itemPath = path.join(dir, item.name)

        // 跳过隐藏目录和 node_modules
        if (item.name.startsWith('.') || item.name === 'node_modules') {
          continue
        }

        if (item.isDirectory()) {
          walkDir(itemPath)
        } else if (item.isFile()) {
          // 只搜索文本文件
          const ext = path.extname(item.name).toLowerCase()
          const textExts = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.py', '.css', '.html', '.yaml', '.yml']
          if (textExts.includes(ext)) {
            searchInFile(itemPath)
          }
        }
      }
    }

    walkDir(fullPath)

    // 排序（按匹配数）
    results.sort((a, b) => b.matchCount - a.matchCount)

    // 限制结果数量
    const limit = options.limit || 50
    return results.slice(0, limit)
  }

  // ==================== 文件锁定 ====================

  /**
   * 锁定文件
   * @param {string} filePath - 文件路径
   * @param {string} agentId - 锁定者
   * @param {Object} options - 选项
   * @returns {boolean} 是否成功锁定
   */
  lockFile(filePath, agentId, options = {}) {
    if (this.isLocked(filePath)) {
      const lockInfo = this.fileLocks.get(filePath)
      if (lockInfo.agentId === agentId) {
        // 已经是自己的锁
        return true
      }
      console.warn(`[SharedWorkspace] 文件已被锁定: ${filePath} (锁定者: ${lockInfo.agentId})`)
      return false
    }

    const lockInfo = {
      agentId,
      lockedAt: Date.now(),
      expiresAt: options.expiresAt || Date.now() + 300000, // 默认5分钟过期
      reason: options.reason || null,
    }

    this.fileLocks.set(filePath, lockInfo)

    this.emit('fileLocked', { path: filePath, agentId })
    console.log(`[SharedWorkspace] 文件已锁定: ${filePath} (锁定者: ${agentId})`)

    return true
  }

  /**
   * 解锁文件
   * @param {string} filePath - 文件路径
   * @param {string} agentId - 解锁者（必须是锁定者）
   * @returns {boolean} 是否成功解锁
   */
  unlockFile(filePath, agentId) {
    if (!this.isLocked(filePath)) {
      return true
    }

    const lockInfo = this.fileLocks.get(filePath)

    // 只有锁定者才能解锁
    if (lockInfo.agentId !== agentId) {
      console.warn(`[SharedWorkspace] 无权解锁: ${filePath} (请求者: ${agentId}, 锁定者: ${lockInfo.agentId})`)
      return false
    }

    this.fileLocks.delete(filePath)

    this.emit('fileUnlocked', { path: filePath, agentId })
    console.log(`[SharedWorkspace] 文件已解锁: ${filePath}`)

    return true
  }

  /**
   * 检查文件是否被锁定
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  isLocked(filePath) {
    if (!this.fileLocks.has(filePath)) {
      return false
    }

    const lockInfo = this.fileLocks.get(filePath)

    // 检查是否过期
    if (lockInfo.expiresAt && Date.now() > lockInfo.expiresAt) {
      this.fileLocks.delete(filePath)
      return false
    }

    return true
  }

  /**
   * 获取锁定信息
   * @param {string} filePath - 文件路径
   * @returns {Object|null}
   */
  getLockInfo(filePath) {
    return this.fileLocks.get(filePath) || null
  }

  /**
   * 清除过期的锁
   */
  cleanExpiredLocks() {
    const now = Date.now()
    for (const [filePath, lockInfo] of this.fileLocks) {
      if (lockInfo.expiresAt && now > lockInfo.expiresAt) {
        this.fileLocks.delete(filePath)
        this.emit('fileLockExpired', { path: filePath })
      }
    }
  }

  // ==================== 上下文管理 ====================

  /**
   * 设置上下文
   * @param {string} key - 键
   * @param {*} value - 值
   * @param {Object} options - 选项
   */
  setContext(key, value, options = {}) {
    const entry = {
      value,
      setBy: options.setBy || 'system',
      setAt: Date.now(),
      expiresAt: options.expiresAt || null,
    }

    this.contextStore.set(key, entry)
    this.emit('contextChanged', { key, value, setBy: entry.setBy })

    console.log(`[SharedWorkspace] 上下文已设置: ${key}`)
  }

  /**
   * 获取上下文
   * @param {string} key - 键
   * @returns {*} 值
   */
  getContext(key) {
    const entry = this.contextStore.get(key)

    if (!entry) {
      return undefined
    }

    // 检查是否过期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.contextStore.delete(key)
      return undefined
    }

    return entry.value
  }

  /**
   * 删除上下文
   * @param {string} key - 键
   */
  deleteContext(key) {
    this.contextStore.delete(key)
    this.emit('contextDeleted', { key })
  }

  /**
   * 获取所有上下文
   * @param {Object} filters - 过滤条件
   * @returns {Object} 上下文对象
   */
  getAllContext(filters = {}) {
    const result = {}
    const now = Date.now()

    for (const [key, entry] of this.contextStore) {
      // 检查是否过期
      if (entry.expiresAt && now > entry.expiresAt) {
        this.contextStore.delete(key)
        continue
      }

      // 过滤条件
      if (filters.setBy && entry.setBy !== filters.setBy) {
        continue
      }

      result[key] = entry.value
    }

    return result
  }

  /**
   * 搜索上下文
   * @param {string} query - 搜索关键词
   * @returns {Object} 匹配的上下文
   */
  searchContext(query) {
    const result = {}
    const lowerQuery = query.toLowerCase()

    for (const [key, entry] of this.contextStore) {
      if (key.toLowerCase().includes(lowerQuery)) {
        result[key] = entry.value
      }
    }

    return result
  }

  // ==================== 辅助方法 ====================

  /**
   * 解析路径
   * @param {string} filePath - 相对路径
   * @returns {string} 绝对路径
   */
  resolvePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath
    }
    return path.resolve(this.workspacePath, filePath)
  }

  /**
   * 获取相对路径
   * @param {string} fullPath - 绝对路径
   * @returns {string} 相对路径
   */
  getRelativePath(fullPath) {
    return path.relative(this.workspacePath, fullPath)
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      workspacePath: this.workspacePath,
      contextCount: this.contextStore.size,
      lockCount: this.fileLocks.size,
      cacheSize: this.fileCache.size,
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.fileCache.clear()
  }

  /**
   * 销毁工作区
   */
  destroy() {
    this.contextStore.clear()
    this.fileLocks.clear()
    this.fileCache.clear()
    this.removeAllListeners()
  }
}

/**
 * 创建共享工作区实例
 */
export function createSharedWorkspace(workspacePath) {
  return new SharedWorkspace(workspacePath)
}

export default SharedWorkspace
