/**
 * CollaborationManager - 协作管理器
 *
 * 职责：
 * - Agent 间直接通信
 * - 协作任务流程管理
 * - 冲突检测和解决
 * - 进度同步
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'

// 协作状态
export const CollaborationStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

// 冲突类型
export const ConflictType = {
  FILE_EDIT: 'file_edit',       // 文件编辑冲突
  RESOURCE_ACCESS: 'resource',  // 资源访问冲突
  TASK_ASSIGNMENT: 'task',      // 任务分配冲突
}

/**
 * CollaborationManager 类
 */
export class CollaborationManager extends EventEmitter {
  constructor(messageBus, workspace, taskManager) {
    super()

    this.messageBus = messageBus
    this.workspace = workspace
    this.taskManager = taskManager

    // 活跃的协作会话
    this.collaborations = new Map()

    // 冲突记录
    this.conflicts = []

    // Agent 间通信历史
    this.communicationHistory = []

    // 订阅消息总线
    this.setupMessageListeners()
  }

  /**
   * 设置消息监听器
   */
  setupMessageListeners() {
    if (!this.messageBus) return

    // 监听协作相关消息
    this.messageBus.subscribeAll((message) => {
      if (message.type === 'collaboration_request') {
        this.handleCollaborationRequest(message)
      } else if (message.type === 'collaboration_response') {
        this.handleCollaborationResponse(message)
      } else if (message.type === 'progress_update') {
        this.handleProgressUpdate(message)
      } else if (message.type === 'conflict_detected') {
        this.handleConflictDetected(message)
      }
    })
  }

  /**
   * 发起协作请求
   */
  async requestCollaboration(fromAgentId, toAgentId, taskId, description) {
    const collaborationId = crypto.randomUUID()

    const collaboration = {
      id: collaborationId,
      taskId,
      initiator: fromAgentId,
      participants: [fromAgentId, toAgentId],
      status: CollaborationStatus.PENDING,
      description,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.collaborations.set(collaborationId, collaboration)

    // 发送协作请求
    const message = {
      from: fromAgentId,
      to: toAgentId,
      type: 'collaboration_request',
      content: {
        collaborationId,
        taskId,
        description,
      },
    }

    await this.messageBus.send(toAgentId, message)

    // 记录通信历史
    this.addCommunication(fromAgentId, toAgentId, 'collaboration_request', description)

    this.emit('collaborationRequested', collaboration)

    return { success: true, collaborationId, collaboration }
  }

  /**
   * 处理协作请求
   */
  async handleCollaborationRequest(message) {
    const { collaborationId, taskId, description } = message.content

    console.log(`[CollaborationManager] 收到协作请求: ${message.from} → ${message.to}`)

    this.emit('collaborationRequestReceived', {
      collaborationId,
      from: message.from,
      to: message.to,
      taskId,
      description,
    })
  }

  /**
   * 响应协作请求
   */
  async respondToCollaboration(collaborationId, agentId, accepted, reason = '') {
    const collaboration = this.collaborations.get(collaborationId)
    if (!collaboration) {
      return { error: '协作不存在' }
    }

    if (accepted) {
      collaboration.status = CollaborationStatus.ACTIVE
      collaboration.updatedAt = Date.now()

      // 通知发起者
      const message = {
        from: agentId,
        to: collaboration.initiator,
        type: 'collaboration_response',
        content: {
          collaborationId,
          accepted: true,
          message: '我接受协作请求',
        },
      }

      await this.messageBus.send(collaboration.initiator, message)

      this.emit('collaborationAccepted', { collaborationId, agentId })
    } else {
      collaboration.status = CollaborationStatus.FAILED
      collaboration.updatedAt = Date.now()

      // 通知发起者
      const message = {
        from: agentId,
        to: collaboration.initiator,
        type: 'collaboration_response',
        content: {
          collaborationId,
          accepted: false,
          reason,
        },
      }

      await this.messageBus.send(collaboration.initiator, message)

      this.emit('collaborationRejected', { collaborationId, agentId, reason })
    }

    return { success: true }
  }

  /**
   * 处理协作响应
   */
  async handleCollaborationResponse(message) {
    const { collaborationId, accepted, reason } = message.content

    console.log(`[CollaborationManager] 收到协作响应: ${message.from} → ${accepted ? '接受' : '拒绝'}`)

    this.emit('collaborationResponseReceived', {
      collaborationId,
      from: message.from,
      accepted,
      reason,
    })
  }

  /**
   * 发送进度更新
   */
  async sendProgressUpdate(agentId, collaborationId, progress, details = '') {
    const collaboration = this.collaborations.get(collaborationId)
    if (!collaboration) {
      return { error: '协作不存在' }
    }

    // 通知所有参与者
    for (const participantId of collaboration.participants) {
      if (participantId !== agentId) {
        const message = {
          from: agentId,
          to: participantId,
          type: 'progress_update',
          content: {
            collaborationId,
            progress,
            details,
          },
        }

        await this.messageBus.send(participantId, message)
      }
    }

    // 记录到协作历史
    collaboration.messages.push({
      from: agentId,
      type: 'progress',
      content: `进度更新: ${progress}% - ${details}`,
      timestamp: Date.now(),
    })

    collaboration.updatedAt = Date.now()

    this.emit('progressUpdated', { collaborationId, agentId, progress, details })

    return { success: true }
  }

  /**
   * 处理进度更新
   */
  async handleProgressUpdate(message) {
    const { collaborationId, progress, details } = message.content

    console.log(`[CollaborationManager] 进度更新: ${message.from} - ${progress}%`)

    this.emit('progressUpdateReceived', {
      collaborationId,
      from: message.from,
      progress,
      details,
    })
  }

  /**
   * 检测文件编辑冲突
   */
  async detectFileConflict(agentId, filePath) {
    // 检查文件是否被其他 Agent 锁定
    if (this.workspace.isLocked(filePath)) {
      const lockInfo = this.workspace.getLockInfo(filePath)

      if (lockInfo.agentId !== agentId) {
        // 检测到冲突
        const conflict = {
          id: crypto.randomUUID(),
          type: ConflictType.FILE_EDIT,
          filePath,
          agent1: agentId,
          agent2: lockInfo.agentId,
          detectedAt: Date.now(),
          resolved: false,
        }

        this.conflicts.push(conflict)

        // 通知相关 Agent
        await this.notifyConflict(conflict)

        this.emit('conflictDetected', conflict)

        return { conflict: true, conflictId: conflict.id, lockedBy: lockInfo.agentId }
      }
    }

    return { conflict: false }
  }

  /**
   * 通知冲突
   */
  async notifyConflict(conflict) {
    const message = {
      from: 'system',
      to: conflict.agent1,
      type: 'conflict_detected',
      content: {
        conflictId: conflict.id,
        type: conflict.type,
        message: `文件 ${conflict.filePath} 正在被 ${conflict.agent2} 编辑`,
        suggestion: '请等待或协商解决',
      },
    }

    await this.messageBus.send(conflict.agent1, message)
  }

  /**
   * 处理冲突检测
   */
  async handleConflictDetected(message) {
    console.log(`[CollaborationManager] 冲突检测: ${message.content.message}`)

    this.emit('conflictNotification', {
      agentId: message.to,
      conflict: message.content,
    })
  }

  /**
   * 解决冲突
   */
  async resolveConflict(conflictId, resolution) {
    const conflict = this.conflicts.find((c) => c.id === conflictId)
    if (!conflict) {
      return { error: '冲突不存在' }
    }

    conflict.resolved = true
    conflict.resolution = resolution
    conflict.resolvedAt = Date.now()

    // 通知相关 Agent
    for (const agentId of [conflict.agent1, conflict.agent2]) {
      const message = {
        from: 'system',
        to: agentId,
        type: 'conflict_resolved',
        content: {
          conflictId,
          resolution,
        },
      }

      await this.messageBus.send(agentId, message)
    }

    this.emit('conflictResolved', { conflictId, resolution })

    return { success: true }
  }

  /**
   * 完成协作
   */
  async completeCollaboration(collaborationId, result) {
    const collaboration = this.collaborations.get(collaborationId)
    if (!collaboration) {
      return { error: '协作不存在' }
    }

    collaboration.status = CollaborationStatus.COMPLETED
    collaboration.result = result
    collaboration.updatedAt = Date.now()
    collaboration.completedAt = Date.now()

    // 通知所有参与者
    for (const participantId of collaboration.participants) {
      const message = {
        from: 'system',
        to: participantId,
        type: 'collaboration_completed',
        content: {
          collaborationId,
          result,
        },
      }

      await this.messageBus.send(participantId, message)
    }

    this.emit('collaborationCompleted', { collaborationId, result })

    return { success: true }
  }

  /**
   * Agent 间直接通信
   */
  async sendMessage(fromAgentId, toAgentId, content, type = 'direct') {
    const message = {
      from: fromAgentId,
      to: toAgentId,
      type,
      content: {
        text: content,
        timestamp: Date.now(),
      },
    }

    await this.messageBus.send(toAgentId, message)

    // 记录通信历史
    this.addCommunication(fromAgentId, toAgentId, type, content)

    return { success: true, message }
  }

  /**
   * 广播消息给所有 Agent
   */
  async broadcastMessage(fromAgentId, content, type = 'broadcast') {
    const message = {
      from: fromAgentId,
      type,
      content: {
        text: content,
        timestamp: Date.now(),
      },
    }

    await this.messageBus.broadcast(message)

    // 记录通信历史
    this.addCommunication(fromAgentId, 'all', type, content)

    return { success: true, message }
  }

  /**
   * 请求文件共享
   */
  async requestFileShare(fromAgentId, toAgentId, filePath) {
    // 读取文件内容
    try {
      const content = await this.workspace.readFile(filePath)

      const message = {
        from: fromAgentId,
        to: toAgentId,
        type: 'file_share',
        content: {
          filePath,
          fileContent: content,
          message: `分享文件: ${filePath}`,
        },
      }

      await this.messageBus.send(toAgentId, message)

      this.addCommunication(fromAgentId, toAgentId, 'file_share', filePath)

      return { success: true }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * 添加通信记录
   */
  addCommunication(from, to, type, content) {
    this.communicationHistory.push({
      from,
      to,
      type,
      content: typeof content === 'string' ? content.substring(0, 200) : JSON.stringify(content).substring(0, 200),
      timestamp: Date.now(),
    })

    // 限制历史记录大小
    if (this.communicationHistory.length > 1000) {
      this.communicationHistory = this.communicationHistory.slice(-500)
    }
  }

  /**
   * 获取通信历史
   */
  getCommunicationHistory(filters = {}) {
    let history = [...this.communicationHistory]

    if (filters.agentId) {
      history = history.filter((h) => h.from === filters.agentId || h.to === filters.agentId)
    }

    if (filters.type) {
      history = history.filter((h) => h.type === filters.type)
    }

    // 排序
    const order = filters.order || 'desc'
    history.sort((a, b) => order === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp)

    // 分页
    const limit = filters.limit || 50
    const offset = filters.offset || 0

    return history.slice(offset, offset + limit)
  }

  /**
   * 获取活跃的协作
   */
  getActiveCollaborations() {
    return Array.from(this.collaborations.values()).filter(
      (c) => c.status === CollaborationStatus.ACTIVE
    )
  }

  /**
   * 获取协作详情
   */
  getCollaboration(collaborationId) {
    return this.collaborations.get(collaborationId) || null
  }

  /**
   * 获取冲突列表
   */
  getConflicts(filters = {}) {
    let conflicts = [...this.conflicts]

    if (filters.resolved !== undefined) {
      conflicts = conflicts.filter((c) => c.resolved === filters.resolved)
    }

    return conflicts
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const totalCollaborations = this.collaborations.size
    const activeCollaborations = this.getActiveCollaborations().length
    const totalConflicts = this.conflicts.length
    const unresolvedConflicts = this.conflicts.filter((c) => !c.resolved).length
    const totalCommunications = this.communicationHistory.length

    return {
      totalCollaborations,
      activeCollaborations,
      totalConflicts,
      unresolvedConflicts,
      totalCommunications,
    }
  }

  /**
   * 清空状态
   */
  clear() {
    this.collaborations.clear()
    this.conflicts = []
    this.communicationHistory = []
  }
}

/**
 * 创建 CollaborationManager 实例
 */
export function createCollaborationManager(messageBus, workspace, taskManager) {
  return new CollaborationManager(messageBus, workspace, taskManager)
}

export default CollaborationManager
