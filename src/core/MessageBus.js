/**
 * MessageBus - Agent 间通信的核心基础设施
 *
 * 支持：
 * - 点对点消息
 * - 广播消息
 * - 发布/订阅模式
 * - 消息历史记录
 * - 消息过滤
 */

import { EventEmitter } from 'events'

// 消息类型
export const MessageType = {
  TASK: 'task',           // 任务分配
  QUESTION: 'question',   // 询问问题
  RESULT: 'result',       // 返回结果
  STATUS: 'status',       // 状态更新
  FILE: 'file',           // 文件共享
  COLLABORATION: 'collab', // 协作请求
  HEARTBEAT: 'heartbeat', // 心跳检测
}

// 消息优先级
export const MessagePriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
}

/**
 * 创建消息对象
 */
export function createMessage({
  from,
  to = null,
  type = MessageType.TASK,
  content = {},
  priority = MessagePriority.NORMAL,
  replyTo = null,
  taskId = null,
}) {
  return {
    id: generateUUID(),
    from,
    to,
    type,
    content,
    priority,
    replyTo,
    taskId,
    timestamp: Date.now(),
    delivered: false,
    read: false,
  }
}

/**
 * 生成 UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * MessageBus 类
 */
export class MessageBus {
  constructor() {
    // 事件发射器，用于发布/订阅
    this.emitter = new EventEmitter()

    // Agent 注册表
    this.agents = new Map()

    // 消息历史
    this.history = []

    // 最大历史记录数
    this.maxHistorySize = 1000

    // 消息队列（用于离线 Agent）
    this.messageQueues = new Map()

    // 订阅者映射
    this.subscribers = new Map()

    // 设置最大监听器数量
    this.emitter.setMaxListeners(100)
  }

  /**
   * 注册 Agent
   */
  register(agentId, agentAdapter) {
    this.agents.set(agentId, agentAdapter)
    this.messageQueues.set(agentId, [])

    // 为该 Agent 创建专属事件通道
    this.emitter.on(`message:${agentId}`, (message) => {
      this.handleMessage(agentId, message)
    })

    console.log(`[MessageBus] Agent 注册: ${agentId}`)
  }

  /**
   * 注销 Agent
   */
  unregister(agentId) {
    this.agents.delete(agentId)
    this.messageQueues.delete(agentId)
    this.emitter.removeAllListeners(`message:${agentId}`)

    console.log(`[MessageBus] Agent 注销: ${agentId}`)
  }

  /**
   * 发送消息给特定 Agent
   */
  async send(to, message) {
    const fullMessage = {
      ...message,
      to,
      delivered: false,
      read: false,
    }

    // 记录历史
    this.addToHistory(fullMessage)

    // 检查目标 Agent 是否在线
    if (this.agents.has(to)) {
      // 在线，直接投递
      await this.deliver(to, fullMessage)
    } else {
      // 离线，加入队列
      this.enqueue(to, fullMessage)
      console.log(`[MessageBus] Agent ${to} 离线，消息已加入队列`)
    }

    // 触发全局消息事件
    this.emitter.emit('message', fullMessage)

    return fullMessage
  }

  /**
   * 广播消息给所有 Agent
   */
  async broadcast(message, exclude = []) {
    const fullMessage = {
      ...message,
      to: null, // null 表示广播
      delivered: false,
      read: false,
    }

    // 记录历史
    this.addToHistory(fullMessage)

    // 发送给所有注册的 Agent（排除发送者）
    const promises = []
    for (const [agentId, agent] of this.agents) {
      if (!exclude.includes(agentId) && agentId !== message.from) {
        promises.push(this.deliver(agentId, { ...fullMessage, to: agentId }))
      }
    }

    await Promise.allSettled(promises)

    // 触发全局消息事件
    this.emitter.emit('message', fullMessage)

    return fullMessage
  }

  /**
   * 订阅消息
   */
  subscribe(agentId, callback) {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, [])
    }
    this.subscribers.get(agentId).push(callback)

    // 返回取消订阅函数
    return () => {
      const subs = this.subscribers.get(agentId) || []
      const index = subs.indexOf(callback)
      if (index > -1) {
        subs.splice(index, 1)
      }
    }
  }

  /**
   * 订阅特定类型消息
   */
  subscribeToType(type, callback) {
    const handler = (message) => {
      if (message.type === type) {
        callback(message)
      }
    }

    this.emitter.on('message', handler)

    // 返回取消订阅函数
    return () => {
      this.emitter.off('message', handler)
    }
  }

  /**
   * 订阅全局消息
   */
  subscribeAll(callback) {
    this.emitter.on('message', callback)

    // 返回取消订阅函数
    return () => {
      this.emitter.off('message', callback)
    }
  }

  /**
   * 投递消息给 Agent
   */
  async deliver(agentId, message) {
    const agent = this.agents.get(agentId)
    if (!agent) {
      console.warn(`[MessageBus] Agent ${agentId} 未注册`)
      return false
    }

    try {
      // 调用 Agent 的消息处理方法
      if (typeof agent.handleMessage === 'function') {
        await agent.handleMessage(message)
      } else if (typeof agent.onMessage === 'function') {
        await agent.onMessage(message)
      }

      // 标记为已投递
      message.delivered = true

      // 触发 Agent 专属事件
      this.emitter.emit(`message:${agentId}`, message)

      // 通知订阅者
      const subs = this.subscribers.get(agentId) || []
      subs.forEach((callback) => callback(message))

      return true
    } catch (error) {
      console.error(`[MessageBus] 投递消息给 ${agentId} 失败:`, error)
      return false
    }
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(agentId, message) {
    // 检查是否是发给自己的
    if (message.to && message.to !== agentId) {
      return
    }

    // 标记为已读
    message.read = true

    // 如果消息来自其他 Agent，可能需要转发
    if (message.from !== agentId && !message.to) {
      // 广播消息，已由 deliver 方法处理
    }
  }

  /**
   * 将消息加入队列
   */
  enqueue(agentId, message) {
    if (!this.messageQueues.has(agentId)) {
      this.messageQueues.set(agentId, [])
    }
    this.messageQueues.get(agentId).push(message)
  }

  /**
   * 获取队列中的消息
   */
  getQueuedMessages(agentId) {
    return this.messageQueues.get(agentId) || []
  }

  /**
   * 清空队列
   */
  clearQueue(agentId) {
    this.messageQueues.set(agentId, [])
  }

  /**
   * 添加到历史记录
   */
  addToHistory(message) {
    this.history.push(message)

    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }
  }

  /**
   * 获取历史消息
   */
  getHistory(filters = {}) {
    let filtered = [...this.history]

    if (filters.from) {
      filtered = filtered.filter((m) => m.from === filters.from)
    }

    if (filters.to) {
      filtered = filtered.filter((m) => m.to === filters.to)
    }

    if (filters.type) {
      filtered = filtered.filter((m) => m.type === filters.type)
    }

    if (filters.taskId) {
      filtered = filtered.filter((m) => m.taskId === filters.taskId)
    }

    if (filters.startTime) {
      filtered = filtered.filter((m) => m.timestamp >= filters.startTime)
    }

    if (filters.endTime) {
      filtered = filtered.filter((m) => m.timestamp <= filters.endTime)
    }

    // 排序
    const order = filters.order || 'desc'
    filtered.sort((a, b) =>
      order === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    )

    // 分页
    const limit = filters.limit || 50
    const offset = filters.offset || 0

    return filtered.slice(offset, offset + limit)
  }

  /**
   * 获取 Agent 列表
   */
  getRegisteredAgents() {
    return Array.from(this.agents.keys())
  }

  /**
   * 检查 Agent 是否在线
   */
  isAgentOnline(agentId) {
    return this.agents.has(agentId)
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      registeredAgents: this.agents.size,
      totalMessages: this.history.length,
      queuedMessages: Array.from(this.messageQueues.values()).reduce(
        (sum, queue) => sum + queue.length,
        0
      ),
    }
  }

  /**
   * 清空历史记录
   */
  clearHistory() {
    this.history = []
  }

  /**
   * 销毁消息总线
   */
  destroy() {
    this.emitter.removeAllListeners()
    this.agents.clear()
    this.messageQueues.clear()
    this.subscribers.clear()
    this.history = []
  }
}

// 创建单例实例
let instance = null

export function getMessageBus() {
  if (!instance) {
    instance = new MessageBus()
  }
  return instance
}

export default MessageBus
