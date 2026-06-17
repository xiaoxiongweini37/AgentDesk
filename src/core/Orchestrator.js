/**
 * Orchestrator - 编排器
 *
 * 职责：
 * - 任务分配和调度
 * - Agent 协作管理
 * - 智能分配算法
 * - 结果聚合
 */

import { EventEmitter } from 'events'
import { TaskStatus, TaskPriority } from './TaskManager.js'

/**
 * Orchestrator 类
 */
export class Orchestrator extends EventEmitter {
  constructor(taskManager, messageBus, workspace) {
    super()

    this.taskManager = taskManager
    this.messageBus = messageBus
    this.workspace = workspace

    // Agent 能力映射
    this.agentCapabilities = new Map()

    // 分配策略
    this.strategies = {
      roundRobin: this.roundRobinStrategy.bind(this),
      capability: this.capabilityStrategy.bind(this),
      loadBalanced: this.loadBalancedStrategy.bind(this),
    }

    // 当前策略
    this.currentStrategy = 'capability'

    // Agent 负载统计
    this.agentLoad = new Map()
  }

  /**
   * 注册 Agent 能力
   */
  registerAgentCapabilities(agentId, capabilities) {
    this.agentCapabilities.set(agentId, capabilities)
    this.agentLoad.set(agentId, { tasks: 0, completed: 0 })
  }

  /**
   * 智能分配任务
   */
  async autoAssign(taskId) {
    const task = this.taskManager.getTask(taskId)
    if (!task) {
      return { error: '任务不存在' }
    }

    // 选择分配策略
    const strategy = this.strategies[this.currentStrategy]
    if (!strategy) {
      return { error: `未知策略: ${this.currentStrategy}` }
    }

    // 执行分配
    const agentId = strategy(task)
    if (!agentId) {
      return { error: '没有合适的 Agent' }
    }

    // 分配任务
    const result = this.taskManager.assignTask(taskId, agentId)
    if (result.error) {
      return result
    }

    // 通知 Agent
    await this.notifyAgent(agentId, task)

    return { success: true, agentId, task }
  }

  /**
   * 轮询策略
   */
  roundRobinStrategy(task) {
    const agents = Array.from(this.agentCapabilities.keys())
    if (agents.length === 0) {
      return null
    }

    // 找到负载最低的 Agent
    let minLoad = Infinity
    let selectedAgent = null

    for (const agentId of agents) {
      const load = this.agentLoad.get(agentId) || { tasks: 0 }
      if (load.tasks < minLoad) {
        minLoad = load.tasks
        selectedAgent = agentId
      }
    }

    return selectedAgent
  }

  /**
   * 能力匹配策略
   */
  capabilityStrategy(task) {
    const agents = Array.from(this.agentCapabilities.entries())

    // 计算每个 Agent 的匹配分数
    const scores = agents.map(([agentId, capabilities]) => {
      let score = 0

      // 检查任务需要的能力
      const requiredCapabilities = task.metadata.requiredCapabilities || []

      for (const required of requiredCapabilities) {
        if (capabilities.includes(required)) {
          score += 10
        }
      }

      // 考虑负载
      const load = this.agentLoad.get(agentId) || { tasks: 0 }
      score -= load.tasks * 2

      // 考虑优先级
      if (task.priority === TaskPriority.URGENT) {
        // 紧急任务优先分配给空闲 Agent
        if (load.tasks === 0) {
          score += 5
        }
      }

      return { agentId, score }
    })

    // 选择分数最高的 Agent
    scores.sort((a, b) => b.score - a.score)

    return scores.length > 0 ? scores[0].agentId : null
  }

  /**
   * 负载均衡策略
   */
  loadBalancedStrategy(task) {
    const agents = Array.from(this.agentCapabilities.keys())
    if (agents.length === 0) {
      return null
    }

    // 找到负载最低的 Agent
    let minLoad = Infinity
    let selectedAgent = null

    for (const agentId of agents) {
      const load = this.agentLoad.get(agentId) || { tasks: 0, completed: 0 }
      // 综合考虑当前任务数和完成率
      const effectiveLoad = load.tasks - (load.completed * 0.1)
      if (effectiveLoad < minLoad) {
        minLoad = effectiveLoad
        selectedAgent = agentId
      }
    }

    return selectedAgent
  }

  /**
   * 通知 Agent 有新任务
   */
  async notifyAgent(agentId, task) {
    const message = {
      from: 'orchestrator',
      to: agentId,
      type: 'task',
      content: {
        taskId: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
      },
    }

    if (this.messageBus) {
      await this.messageBus.send(agentId, message)
    }

    // 更新负载
    const load = this.agentLoad.get(agentId) || { tasks: 0, completed: 0 }
    load.tasks++
    this.agentLoad.set(agentId, load)

    this.emit('agentNotified', { agentId, task })
  }

  /**
   * 任务完成回调
   */
  async onTaskCompleted(taskId, result) {
    const task = this.taskManager.getTask(taskId)
    if (!task) {
      return
    }

    // 更新任务状态
    this.taskManager.updateStatus(taskId, TaskStatus.COMPLETED, result)

    // 更新 Agent 负载
    if (task.assignedTo) {
      const load = this.agentLoad.get(task.assignedTo) || { tasks: 0, completed: 0 }
      load.tasks = Math.max(0, load.tasks - 1)
      load.completed++
      this.agentLoad.set(task.assignedTo, load)
    }

    // 检查是否有依赖此任务的其他任务
    const dependentTasks = this.getDependentTasks(taskId)
    for (const depTask of dependentTasks) {
      if (this.taskManager.areDependenciesMet(depTask.id)) {
        // 依赖已满足，可以自动分配
        await this.autoAssign(depTask.id)
      }
    }

    this.emit('taskCompleted', { task, result })
  }

  /**
   * 任务失败回调
   */
  async onTaskFailed(taskId, error) {
    const task = this.taskManager.getTask(taskId)
    if (!task) {
      return
    }

    // 更新任务状态
    this.taskManager.updateStatus(taskId, TaskStatus.FAILED, error)

    // 更新 Agent 负载
    if (task.assignedTo) {
      const load = this.agentLoad.get(task.assignedTo) || { tasks: 0, completed: 0 }
      load.tasks = Math.max(0, load.tasks - 1)
      this.agentLoad.set(task.assignedTo, load)
    }

    this.emit('taskFailed', { task, error })
  }

  /**
   * 获取依赖此任务的其他任务
   */
  getDependentTasks(taskId) {
    return this.taskManager.getTasks().filter((task) =>
      task.dependencies.includes(taskId)
    )
  }

  /**
   * 分解复杂任务
   */
  async decomposeTask(taskId, decomposition) {
    const task = this.taskManager.getTask(taskId)
    if (!task) {
      return { error: '任务不存在' }
    }

    // 创建子任务
    const result = this.taskManager.decomposeTask(taskId, decomposition)
    if (result.error) {
      return result
    }

    // 为每个子任务自动分配
    for (const subtask of result.subtasks) {
      await this.autoAssign(subtask.id)
    }

    return result
  }

  /**
   * 协作任务 - 多个 Agent 共同完成
   */
  async collaborateTask(taskId, agentIds) {
    const task = this.taskManager.getTask(taskId)
    if (!task) {
      return { error: '任务不存在' }
    }

    // 将任务分解为多个并行子任务
    const subtasks = agentIds.map((agentId, index) => ({
      title: `${task.title} - 部分 ${index + 1}`,
      description: `由 ${agentId} 负责的部分`,
      assignedTo: agentId,
      metadata: {
       collaborateTaskId: taskId,
       collaborateIndex: index,
       collaborateTotal: agentIds.length,
      },
    }))

    const result = this.taskManager.decomposeTask(taskId, subtasks)
    if (result.error) {
      return result
    }

    // 通知所有参与的 Agent
    for (const agentId of agentIds) {
      const message = {
        from: 'orchestrator',
        to: agentId,
        type: 'collaboration',
        content: {
          taskId,
          participants: agentIds,
          message: `你被邀请参与协作任务: ${task.title}`,
        },
      }

      if (this.messageBus) {
        await this.messageBus.send(agentId, message)
      }
    }

    this.emit('collaborateTaskStarted', { task, agentIds, subtasks: result.subtasks })

    return { success: true, subtasks: result.subtasks }
  }

  /**
   * 获取 Agent 状态
   */
  getAgentStatus(agentId) {
    const load = this.agentLoad.get(agentId) || { tasks: 0, completed: 0 }
    const capabilities = this.agentCapabilities.get(agentId) || []

    return {
      agentId,
      capabilities,
      currentTasks: load.tasks,
      completedTasks: load.completed,
      isOnline: this.messageBus ? this.messageBus.isAgentOnline(agentId) : false,
    }
  }

  /**
   * 获取所有 Agent 状态
   */
  getAllAgentStatus() {
    const statuses = {}

    for (const agentId of this.agentCapabilities.keys()) {
      statuses[agentId] = this.getAgentStatus(agentId)
    }

    return statuses
  }

  /**
   * 获取任务统计
   */
  getStats() {
    const taskProgress = this.taskManager.getProgress()
    const agentStatuses = this.getAllAgentStatus()

    return {
      tasks: taskProgress,
      agents: agentStatuses,
      currentStrategy: this.currentStrategy,
    }
  }

  /**
   * 设置分配策略
   */
  setStrategy(strategyName) {
    if (!this.strategies[strategyName]) {
      return { error: `未知策略: ${strategyName}` }
    }

    this.currentStrategy = strategyName
    return { success: true }
  }

  /**
   * 清空状态
   */
  clear() {
    this.agentCapabilities.clear()
    this.agentLoad.clear()
  }
}

/**
 * 创建 Orchestrator 实例
 */
export function createOrchestrator(taskManager, messageBus, workspace) {
  return new Orchestrator(taskManager, messageBus, workspace)
}

export default Orchestrator
