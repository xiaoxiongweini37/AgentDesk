/**
 * TaskManager - 任务管理器
 *
 * 职责：
 * - 任务创建和删除
 * - 任务状态管理
 * - 任务分解
 * - 依赖管理
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'

// 生成 UUID v4
function generateUUID() {
  return crypto.randomUUID()
}

// 任务状态
export const TaskStatus = {
  PENDING: 'pending',       // 待处理
  ASSIGNED: 'assigned',     // 已分配
  IN_PROGRESS: 'in_progress', // 进行中
  COMPLETED: 'completed',   // 已完成
  FAILED: 'failed',         // 失败
  CANCELLED: 'cancelled',   // 已取消
}

// 任务优先级
export const TaskPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
}

/**
 * 创建任务对象
 */
export function createTask({
  title,
  description = '',
  priority = TaskPriority.NORMAL,
  assignedTo = null,
  parentTaskId = null,
  dependencies = [],
  metadata = {},
}) {
  return {
    id: generateUUID(),
    title,
    description,
    status: TaskStatus.PENDING,
    priority,
    assignedTo,
    parentTaskId,
    subtasks: [],
    dependencies,
    metadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    completedAt: null,
    result: null,
    error: null,
  }
}

/**
 * TaskManager 类
 */
export class TaskManager extends EventEmitter {
  constructor() {
    super()

    // 任务存储
    this.tasks = new Map()

    // 任务历史
    this.history = []
  }

  /**
   * 创建任务
   */
  createTask(options) {
    const task = createTask(options)

    this.tasks.set(task.id, task)

    // 如果有父任务，添加到父任务的子任务列表
    if (task.parentTaskId) {
      const parentTask = this.tasks.get(task.parentTaskId)
      if (parentTask) {
        parentTask.subtasks.push(task.id)
      }
    }

    this.emit('taskCreated', task)
    this.addToHistory(task, 'created')

    console.log(`[TaskManager] 任务已创建: ${task.id} - ${task.title}`)

    return task
  }

  /**
   * 获取任务
   */
  getTask(taskId) {
    return this.tasks.get(taskId) || null
  }

  /**
   * 获取所有任务
   */
  getTasks(filters = {}) {
    let tasks = Array.from(this.tasks.values())

    // 过滤
    if (filters.status) {
      tasks = tasks.filter((t) => t.status === filters.status)
    }

    if (filters.assignedTo) {
      tasks = tasks.filter((t) => t.assignedTo === filters.assignedTo)
    }

    if (filters.priority) {
      tasks = tasks.filter((t) => t.priority === filters.priority)
    }

    if (filters.parentTaskId) {
      tasks = tasks.filter((t) => t.parentTaskId === filters.parentTaskId)
    }

    // 排序
    const sortBy = filters.sortBy || 'createdAt'
    const sortOrder = filters.sortOrder || 'desc'

    tasks.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'createdAt') {
        comparison = a.createdAt - b.createdAt
      } else if (sortBy === 'updatedAt') {
        comparison = a.updatedAt - b.updatedAt
      } else if (sortBy === 'priority') {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return tasks
  }

  /**
   * 更新任务状态
   */
  updateStatus(taskId, newStatus, result = null) {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { error: '任务不存在' }
    }

    const oldStatus = task.status
    task.status = newStatus
    task.updatedAt = Date.now()

    if (newStatus === TaskStatus.COMPLETED) {
      task.completedAt = Date.now()
      task.result = result
    }

    if (newStatus === TaskStatus.FAILED) {
      task.error = result
    }

    this.emit('taskStatusChanged', { task, oldStatus, newStatus })
    this.addToHistory(task, 'statusChanged', { oldStatus, newStatus })

    console.log(`[TaskManager] 任务状态更新: ${taskId} ${oldStatus} → ${newStatus}`)

    return { success: true, task }
  }

  /**
   * 分配任务给 Agent
   */
  assignTask(taskId, agentId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { error: '任务不存在' }
    }

    task.assignedTo = agentId
    task.status = TaskStatus.ASSIGNED
    task.updatedAt = Date.now()

    this.emit('taskAssigned', { task, agentId })
    this.addToHistory(task, 'assigned', { agentId })

    console.log(`[TaskManager] 任务已分配: ${taskId} → ${agentId}`)

    return { success: true, task }
  }

  /**
   * 删除任务
   */
  deleteTask(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { error: '任务不存在' }
    }

    // 删除子任务
    for (const subtaskId of task.subtasks) {
      this.deleteTask(subtaskId)
    }

    // 从父任务中移除
    if (task.parentTaskId) {
      const parentTask = this.tasks.get(task.parentTaskId)
      if (parentTask) {
        parentTask.subtasks = parentTask.subtasks.filter((id) => id !== taskId)
      }
    }

    this.tasks.delete(taskId)

    this.emit('taskDeleted', task)
    this.addToHistory(task, 'deleted')

    console.log(`[TaskManager] 任务已删除: ${taskId}`)

    return { success: true }
  }

  /**
   * 分解任务为子任务
   */
  decomposeTask(taskId, subtasks) {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { error: '任务不存在' }
    }

    const createdSubtasks = []

    for (const subtaskOptions of subtasks) {
      const subtask = this.createTask({
        ...subtaskOptions,
        parentTaskId: taskId,
      })
      createdSubtasks.push(subtask)
    }

    this.emit('taskDecomposed', { task, subtasks: createdSubtasks })

    console.log(`[TaskManager] 任务已分解: ${taskId} → ${createdSubtasks.length} 个子任务`)

    return { success: true, subtasks: createdSubtasks }
  }

  /**
   * 添加依赖
   */
  addDependency(taskId, dependsOnTaskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { error: '任务不存在' }
    }

    const dependsOnTask = this.tasks.get(dependsOnTaskId)
    if (!dependsOnTask) {
      return { error: '依赖任务不存在' }
    }

    // 检查循环依赖
    if (this.wouldCreateCycle(taskId, dependsOnTaskId)) {
      return { error: '会创建循环依赖' }
    }

    if (!task.dependencies.includes(dependsOnTaskId)) {
      task.dependencies.push(dependsOnTaskId)
      task.updatedAt = Date.now()

      this.emit('dependencyAdded', { taskId, dependsOnTaskId })
    }

    return { success: true }
  }

  /**
   * 检查是否会创建循环依赖
   */
  wouldCreateCycle(taskId, dependsOnTaskId) {
    // 如果 A 依赖 B，检查 B 是否已经依赖 A（直接或间接）
    const visited = new Set()

    const check = (currentId) => {
      if (currentId === taskId) {
        return true
      }

      if (visited.has(currentId)) {
        return false
      }

      visited.add(currentId)

      const task = this.tasks.get(currentId)
      if (!task) {
        return false
      }

      for (const dep of task.dependencies) {
        if (check(dep)) {
          return true
        }
      }

      return false
    }

    return check(dependsOnTaskId)
  }

  /**
   * 检查任务依赖是否满足
   */
  areDependenciesMet(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      return false
    }

    return task.dependencies.every((depId) => {
      const depTask = this.tasks.get(depId)
      return depTask && depTask.status === TaskStatus.COMPLETED
    })
  }

  /**
   * 获取可执行的任务（依赖已满足）
   */
  getReadyTasks() {
    return this.getTasks({ status: TaskStatus.PENDING }).filter((task) =>
      this.areDependenciesMet(task.id)
    )
  }

  /**
   * 获取任务进度
   */
  getProgress() {
    const tasks = Array.from(this.tasks.values())

    const total = tasks.length
    const completed = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length
    const inProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length
    const failed = tasks.filter((t) => t.status === TaskStatus.FAILED).length
    const pending = tasks.filter((t) => t.status === TaskStatus.PENDING).length

    return {
      total,
      completed,
      inProgress,
      failed,
      pending,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    }
  }

  /**
   * 添加到历史记录
   */
  addToHistory(task, action, details = {}) {
    this.history.push({
      taskId: task.id,
      action,
      details,
      timestamp: Date.now(),
    })

    // 限制历史记录大小
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500)
    }
  }

  /**
   * 获取任务历史
   */
  getHistory(taskId = null) {
    if (taskId) {
      return this.history.filter((h) => h.taskId === taskId)
    }
    return this.history
  }

  /**
   * 清空任务
   */
  clear() {
    this.tasks.clear()
    this.history = []
  }
}

/**
 * 创建 TaskManager 实例
 */
export function createTaskManager() {
  return new TaskManager()
}

export default TaskManager
