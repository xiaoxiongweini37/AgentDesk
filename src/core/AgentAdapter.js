/**
 * AgentAdapter - 统一的 Agent 适配器接口
 *
 * 所有 Agent 适配器必须继承此基类并实现抽象方法
 */

import { EventEmitter } from 'events'
import { createMessage, MessageType } from './MessageBus.js'

// Agent 状态
export const AgentStatus = {
  IDLE: 'idle',           // 空闲
  STARTING: 'starting',   // 启动中
  RUNNING: 'running',     // 运行中
  BUSY: 'busy',           // 忙碌
  ERROR: 'error',         // 错误
  STOPPED: 'stopped',     // 已停止
}

// Agent 能力
export const AgentCapability = {
  CODE_EXECUTION: 'code_execution',
  FILE_OPERATIONS: 'file_operations',
  TERMINAL_COMMANDS: 'terminal_commands',
  GIT_OPERATIONS: 'git_operations',
  WEB_SEARCH: 'web_search',
  IMAGE_ANALYSIS: 'image_analysis',
}

/**
 * AgentAdapter 基类
 */
export class AgentAdapter extends EventEmitter {
  /**
   * 构造函数
   * @param {string} agentId - Agent 唯一标识
   * @param {string} cliType - CLI 类型（如 'claude', 'cursor', 'hermes'）
   * @param {Object} config - Agent 配置
   */
  constructor(agentId, cliType, config = {}) {
    super()

    this.agentId = agentId
    this.cliType = cliType
    this.config = config

    // Agent 状态
    this.status = AgentStatus.IDLE
    this.process = null
    this.messageBus = null

    // 消息队列
    this.messageQueue = []
    this.isProcessing = false

    // 会话信息
    this.sessionId = config.sessionId || null
    this.startTime = null
    this.lastActivity = null

    // 错误信息
    this.lastError = null
    this.errorCount = 0

    // 统计信息
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      tasksCompleted: 0,
      uptime: 0,
    }
  }

  // ==================== 抽象方法（子类必须实现） ====================

  /**
   * 启动 Agent
   * @abstract
   */
  async start() {
    throw new Error('start() must be implemented by subclass')
  }

  /**
   * 停止 Agent
   * @abstract
   */
  async stop() {
    throw new Error('stop() must be implemented by subclass')
  }

  /**
   * 发送消息到 Agent
   * @abstract
   * @param {Object} message - 消息对象
   */
  async sendToAgent(message) {
    throw new Error('sendToAgent() must be implemented by subclass')
  }

  /**
   * 获取 Agent 状态
   * @abstract
   */
  async checkStatus() {
    throw new Error('checkStatus() must be implemented by subclass')
  }

  /**
   * 获取 Agent 能力列表
   * @abstract
   */
  getCapabilities() {
    throw new Error('getCapabilities() must be implemented by subclass')
  }

  // ==================== 公共方法 ====================

  /**
   * 注册到消息总线
   */
  registerToMessageBus(messageBus) {
    this.messageBus = messageBus
    this.messageBus.register(this.agentId, this)
    console.log(`[AgentAdapter] ${this.agentId} 已注册到消息总线`)
  }

  /**
   * 从消息总线注销
   */
  unregisterFromMessageBus() {
    if (this.messageBus) {
      this.messageBus.unregister(this.agentId)
      this.messageBus = null
      console.log(`[AgentAdapter] ${this.agentId} 已从消息总线注销`)
    }
  }

  /**
   * 发送消息给其他 Agent
   */
  async sendMessage(to, content, options = {}) {
    const message = createMessage({
      from: this.agentId,
      to,
      type: options.type || MessageType.TASK,
      content,
      priority: options.priority,
      replyTo: options.replyTo,
      taskId: options.taskId,
    })

    if (this.messageBus) {
      await this.messageBus.send(to, message)
      this.stats.messagesSent++
      this.lastActivity = Date.now()
    }

    return message
  }

  /**
   * 广播消息给所有 Agent
   */
  async broadcastMessage(content, options = {}) {
    const message = createMessage({
      from: this.agentId,
      type: options.type || MessageType.STATUS,
      content,
      priority: options.priority,
    })

    if (this.messageBus) {
      await this.messageBus.broadcast(message)
      this.stats.messagesSent++
      this.lastActivity = Date.now()
    }

    return message
  }

  /**
   * 处理接收到的消息
   */
  async handleMessage(message) {
    this.stats.messagesReceived++
    this.lastActivity = Date.now()

    console.log(`[AgentAdapter] ${this.agentId} 收到消息:`, message.type)

    // 触发消息事件
    this.emit('message', message)

    // 加入消息队列
    this.messageQueue.push(message)

    // 处理消息队列
    await this.processMessageQueue()
  }

  /**
   * 处理消息队列
   */
  async processMessageQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()

      try {
        await this.processMessage(message)
      } catch (error) {
        console.error(`[AgentAdapter] ${this.agentId} 处理消息失败:`, error)
        this.lastError = error.message
        this.errorCount++
        this.emit('error', error)
      }
    }

    this.isProcessing = false
  }

  /**
   * 处理单条消息（子类可覆盖）
   */
  async processMessage(message) {
    // 默认实现：发送到 Agent
    await this.sendToAgent(message)
  }

  /**
   * 更新状态
   */
  updateStatus(newStatus) {
    const oldStatus = this.status
    this.status = newStatus

    if (newStatus === AgentStatus.RUNNING && !this.startTime) {
      this.startTime = Date.now()
    }

    // 触发状态变化事件
    this.emit('statusChange', { oldStatus, newStatus })

    // 广播状态变化
    if (this.messageBus) {
      this.broadcastMessage(
        { status: newStatus, agentId: this.agentId },
        { type: MessageType.STATUS }
      )
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      agentId: this.agentId,
      cliType: this.cliType,
      status: this.status,
      sessionId: this.sessionId,
      startTime: this.startTime,
      lastActivity: this.lastActivity,
      lastError: this.lastError,
      errorCount: this.errorCount,
      stats: { ...this.stats },
      uptime: this.startTime ? Date.now() - this.startTime : 0,
    }
  }

  /**
   * 是否在线
   */
  isOnline() {
    return [
      AgentStatus.IDLE,
      AgentStatus.RUNNING,
      AgentStatus.BUSY,
    ].includes(this.status)
  }

  /**
   * 是否忙碌
   */
  isBusy() {
    return this.status === AgentStatus.BUSY
  }

  /**
   * 获取能力列表
   */
  getCapabilities() {
    return []
  }

  /**
   * 重启 Agent
   */
  async restart() {
    console.log(`[AgentAdapter] ${this.agentId} 重启中...`)
    await this.stop()
    await this.start()
  }

  /**
   * 获取会话 ID
   */
  getSessionId() {
    return this.sessionId
  }

  /**
   * 设置会话 ID
   */
  setSessionId(sessionId) {
    this.sessionId = sessionId
  }

  /**
   * 销毁 Agent
   */
  async destroy() {
    await this.stop()
    this.unregisterFromMessageBus()
    this.removeAllListeners()
  }
}

export default AgentAdapter
