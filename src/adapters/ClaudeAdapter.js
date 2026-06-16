/**
 * ClaudeAdapter - Claude Code CLI 适配器
 *
 * 通过 stdin/stdout 与 Claude Code CLI 进程通信
 */

import { spawn } from 'child_process'
import { AgentAdapter, AgentStatus } from '../core/AgentAdapter.js'
import { MessageType, createMessage } from '../core/MessageBus.js'

// Claude Code CLI 默认配置
const DEFAULT_CONFIG = {
  command: 'claude',
  args: [],
  env: {},
  cwd: process.cwd(),
  shell: true,
}

/**
 * ClaudeAdapter 类
 */
export class ClaudeAdapter extends AgentAdapter {
  /**
   * 构造函数
   * @param {string} agentId - Agent 唯一标识
   * @param {Object} config - 配置对象
   */
  constructor(agentId, config = {}) {
    super(agentId, 'claude', { ...DEFAULT_CONFIG, ...config })

    // Claude 特定配置
    this.claudeConfig = {
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseUrl: config.baseUrl || process.env.ANTHROPIC_BASE_URL,
      model: config.model || 'claude-sonnet-4-20250514',
    }

    // 输出缓冲区
    this.stdoutBuffer = ''
    this.stderrBuffer = ''

    // 消息解析状态
    this.isParsingMessage = false
    this.currentMessage = ''

    // 会话 ID
    this.sessionId = config.sessionId || this.generateSessionId()
  }

  /**
   * 生成会话 ID
   */
  generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * 启动 Claude Code CLI
   */
  async start() {
    try {
      this.updateStatus(AgentStatus.STARTING)
      console.log(`[ClaudeAdapter] 启动 ${this.agentId}...`)

      // 构建启动参数
      const args = [
        '--session-id', this.sessionId,
        ...this.config.args,
      ]

      // 构建环境变量
      const env = {
        ...process.env,
        ...this.config.env,
      }

      if (this.claudeConfig.apiKey) {
        env.ANTHROPIC_API_KEY = this.claudeConfig.apiKey
      }
      if (this.claudeConfig.baseUrl) {
        env.ANTHROPIC_BASE_URL = this.claudeConfig.baseUrl
      }

      // 启动进程
      this.process = spawn(this.config.command, args, {
        cwd: this.config.cwd,
        env,
        shell: this.config.shell,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      // 设置输出监听
      this.setupOutputListeners()

      // 等待进程启动
      await this.waitForReady()

      this.updateStatus(AgentStatus.RUNNING)
      console.log(`[ClaudeAdapter] ${this.agentId} 启动成功`)

      return true
    } catch (error) {
      console.error(`[ClaudeAdapter] ${this.agentId} 启动失败:`, error)
      this.lastError = error.message
      this.errorCount++
      this.updateStatus(AgentStatus.ERROR)
      throw error
    }
  }

  /**
   * 停止 Claude Code CLI
   */
  async stop() {
    try {
      console.log(`[ClaudeAdapter] 停止 ${this.agentId}...`)

      if (this.process) {
        // 发送退出命令
        this.process.stdin.write('/exit\n')

        // 等待进程退出
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            this.process.kill()
            resolve()
          }, 5000)

          this.process.on('exit', () => {
            clearTimeout(timeout)
            resolve()
          })
        })

        this.process = null
      }

      this.updateStatus(AgentStatus.STOPPED)
      console.log(`[ClaudeAdapter] ${this.agentId} 已停止`)

      return true
    } catch (error) {
      console.error(`[ClaudeAdapter] ${this.agentId} 停止失败:`, error)
      this.lastError = error.message
      this.updateStatus(AgentStatus.ERROR)
      throw error
    }
  }

  /**
   * 发送消息到 Claude Code CLI
   */
  async sendToAgent(message) {
    if (!this.process || this.status !== AgentStatus.RUNNING) {
      throw new Error(`Agent ${this.agentId} 未运行`)
    }

    try {
      this.updateStatus(AgentStatus.BUSY)

      // 格式化消息内容
      const content = this.formatMessage(message)

      // 发送到 stdin
      this.process.stdin.write(content + '\n')

      this.stats.messagesSent++
      this.lastActivity = Date.now()

      console.log(`[ClaudeAdapter] ${this.agentId} 发送消息:`, message.type)

      return true
    } catch (error) {
      console.error(`[ClaudeAdapter] ${this.agentId} 发送消息失败:`, error)
      this.lastError = error.message
      this.errorCount++
      throw error
    }
  }

  /**
   * 格式化消息内容
   */
  formatMessage(message) {
    const { content } = message

    if (typeof content === 'string') {
      return content
    }

    // 如果是任务类型，格式化为任务描述
    if (message.type === MessageType.TASK && content.task) {
      const task = content.task
      let formatted = ''

      if (task.title) {
        formatted += `任务: ${task.title}\n`
      }
      if (task.description) {
        formatted += `\n${task.description}\n`
      }
      if (task.requirements && task.requirements.length > 0) {
        formatted += `\n要求:\n`
        task.requirements.forEach((req, i) => {
          formatted += `${i + 1}. ${req}\n`
        })
      }

      return formatted
    }

    // 其他类型，返回文本内容
    return content.text || JSON.stringify(content)
  }

  /**
   * 设置输出监听器
   */
  setupOutputListeners() {
    // 监听 stdout
    this.process.stdout.on('data', (data) => {
      this.stdoutBuffer += data.toString()
      this.processStdout()
    })

    // 监听 stderr
    this.process.stderr.on('data', (data) => {
      this.stderrBuffer += data.toString()
      this.processStderr()
    })

    // 监听进程退出
    this.process.on('exit', (code, signal) => {
      console.log(`[ClaudeAdapter] ${this.agentId} 进程退出:`, code, signal)
      this.updateStatus(AgentStatus.STOPPED)
      this.emit('exit', { code, signal })
    })

    // 监听错误
    this.process.on('error', (error) => {
      console.error(`[ClaudeAdapter] ${this.agentId} 进程错误:`, error)
      this.lastError = error.message
      this.errorCount++
      this.updateStatus(AgentStatus.ERROR)
      this.emit('error', error)
    })
  }

  /**
   * 处理 stdout 输出
   */
  processStdout() {
    // 按行分割
    const lines = this.stdoutBuffer.split('\n')
    this.stdoutBuffer = lines.pop() || '' // 保留未完成的行

    for (const line of lines) {
      if (line.trim()) {
        this.processLine(line.trim())
      }
    }
  }

  /**
   * 处理单行输出
   */
  processLine(line) {
    // 尝试解析为 JSON 消息
    try {
      const message = JSON.parse(line)
      if (message.type && message.content) {
        // 是结构化消息
        this.handleStructuredMessage(message)
        return
      }
    } catch (e) {
      // 不是 JSON，作为普通文本处理
    }

    // 普通文本输出
    this.handleTextOutput(line)
  }

  /**
   * 处理结构化消息
   */
  handleStructuredMessage(message) {
    const fullMessage = createMessage({
      from: this.agentId,
      to: message.to || null,
      type: message.type || MessageType.RESULT,
      content: message.content,
      taskId: message.taskId,
    })

    // 触发消息事件
    this.emit('message', fullMessage)

    // 如果有消息总线，发送到消息总线
    if (this.messageBus) {
      if (fullMessage.to) {
        this.messageBus.send(fullMessage.to, fullMessage)
      } else {
        this.messageBus.broadcast(fullMessage)
      }
    }

    this.stats.messagesReceived++
    this.lastActivity = Date.now()
  }

  /**
   * 处理文本输出
   */
  handleTextOutput(line) {
    // 触发输出事件
    this.emit('output', {
      type: 'stdout',
      content: line,
      timestamp: Date.now(),
    })

    // 检测状态变化
    if (line.includes('Error') || line.includes('error')) {
      this.lastError = line
      this.errorCount++
    }
  }

  /**
   * 处理 stderr 输出
   */
  processStderr() {
    // 按行分割
    const lines = this.stderrBuffer.split('\n')
    this.stderrBuffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        this.emit('output', {
          type: 'stderr',
          content: line.trim(),
          timestamp: Date.now(),
        })
      }
    }
  }

  /**
   * 等待 Claude Code CLI 就绪
   */
  async waitForReady(timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('等待 Claude Code CLI 超时'))
      }, timeout)

      const checkReady = (data) => {
        const output = data.toString()
        // 检测就绪信号（根据 Claude Code CLI 的实际输出调整）
        if (
          output.includes('>') ||
          output.includes('$') ||
          output.includes('Ready') ||
          output.includes('session')
        ) {
          clearTimeout(timer)
          this.process.stdout.removeListener('data', checkReady)
          resolve()
        }
      }

      this.process.stdout.on('data', checkReady)
    })
  }

  /**
   * 检查 Agent 状态
   */
  async checkStatus() {
    if (!this.process) {
      return { status: AgentStatus.STOPPED }
    }

    return {
      status: this.status,
      pid: this.process.pid,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
    }
  }

  /**
   * 获取能力列表
   */
  getCapabilities() {
    return [
      'code_execution',
      'file_operations',
      'terminal_commands',
      'git_operations',
      'web_search',
    ]
  }

  /**
   * 获取会话 ID
   */
  getSessionId() {
    return this.sessionId
  }

  /**
   * 发送任务
   */
  async sendTask(task) {
    const message = createMessage({
      from: 'orchestrator',
      to: this.agentId,
      type: MessageType.TASK,
      content: {
        task,
        text: task.description || task.title,
      },
      taskId: task.id,
    })

    await this.sendToAgent(message)
    return message
  }

  /**
   * 发送问题
   */
  async sendQuestion(question, to = null) {
    const message = createMessage({
      from: this.agentId,
      to,
      type: MessageType.QUESTION,
      content: {
        text: question,
      },
    })

    if (to) {
      await this.sendMessage(to, message.content, { type: MessageType.QUESTION })
    } else {
      await this.broadcastMessage(message.content, { type: MessageType.QUESTION })
    }

    return message
  }

  /**
   * 发送结果
   */
  async sendResult(result, to, taskId = null) {
    const message = createMessage({
      from: this.agentId,
      to,
      type: MessageType.RESULT,
      content: {
        text: typeof result === 'string' ? result : JSON.stringify(result),
        result,
      },
      taskId,
    })

    await this.sendMessage(to, message.content, {
      type: MessageType.RESULT,
      taskId,
    })

    return message
  }

  /**
   * 请求协作
   */
  async requestCollaboration(taskId, agentIds, description) {
    const message = createMessage({
      from: this.agentId,
      type: MessageType.COLLABORATION,
      content: {
        text: description,
        taskId,
        requestedAgents: agentIds,
      },
      taskId,
    })

    await this.broadcastMessage(message.content, {
      type: MessageType.COLLABORATION,
      taskId,
    })

    return message
  }
}

/**
 * 创建 ClaudeAdapter 实例
 */
export function createClaudeAdapter(agentId, config = {}) {
  return new ClaudeAdapter(agentId, config)
}

export default ClaudeAdapter
