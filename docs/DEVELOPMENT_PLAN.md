# AgentDesk 开发计划

> 多 Agent 协作开发平台 - 让你成为指挥者，让 AI 团队执行

**文档版本**：v1.0  
**创建日期**：2026-06-16  
**最后更新**：2026-06-16

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心理念](#2-核心理念)
3. [架构设计](#3-架构设计)
4. [核心组件](#4-核心组件)
5. [通信协议](#5-通信协议)
6. [实施计划](#6-实施计划)
7. [进度跟踪](#7-进度跟踪)
8. [变更日志](#8-变更日志)

---

## 1. 项目概述

### 1.1 项目定位

AgentDesk 是一个**多 Agent 协作开发平台**，让用户从"写代码的人"变成"指挥 AI 团队的人"。

### 1.2 核心价值

- **你负责决策**：定义需求、审查结果、调整方向
- **Agent 负责执行**：写代码、测试、部署、调试
- **团队协作**：多个 Agent 像真实团队一样协作

### 1.3 技术栈

- **前端**：React + Vite + Tauri (Rust)
- **后端**：Node.js (proxy.cjs)
- **Agent**：Claude Code CLI、Cursor Agent、Hermes Agent 等
- **通信**：消息总线 + stdin/stdout + HTTP API

---

## 2. 核心理念

### 2.0 架构选型分析

#### 主流多 Agent 架构对比

| 架构类型 | 代表框架 | 特点 | 适用场景 |
|----------|----------|------|----------|
| 中心化 | AutoGen | 简单、易调试 | 研究、原型 |
| 去中心化 | 研究项目 | 无单点故障 | 大规模系统 |
| 层级架构 | MetaGPT、ChatDev | 符合团队结构 | 软件开发 |
| 混合架构 | CrewAI、**AgentDesk** | 灵活、可扩展 | 通用任务 |

#### AgentDesk 架构优势

1. **混合架构** - 结合中心化和去中心化的优点
2. **真实执行能力** - 不是聊天机器人，能真正操作计算机
3. **灵活的 Agent 支持** - 可集成各种 CLI 工具
4. **桌面应用** - 比纯 Python 脚本更易用
5. **消息总线** - Agent 间可直接通信

#### AgentDesk 架构待改进

1. **冲突解决** - 需要更智能的冲突检测机制
2. **学习能力** - 可添加经验积累机制
3. **动态调整** - 可添加自动优化功能
4. **UI 完善** - 需要更好的可视化界面

#### 可借鉴的框架

| 框架 | 可借鉴点 |
|------|----------|
| MetaGPT | 更明确的角色定义、标准化协作流程 |
| CrewAI | 任务分解算法、智能分配策略 |
| LangGraph | 状态机管理、可视化工作流 |

#### 架构评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 可扩展性 | 8/10 | 支持多种 Agent 类型 |
| 灵活性 | 9/10 | 混合架构，可调整 |
| 执行能力 | 9/10 | 真正的 CLI 执行 |
| 协作能力 | 7/10 | 基础协作，待完善 |
| 易用性 | 6/10 | UI 待完善 |
| 学习曲线 | 7/10 | 概念清晰 |

**总体评分：7.5/10**

**结论**：对于个人使用的多 Agent 协作开发工具，当前架构是很好的选择！

---

### 2.1 你不是开发者，你是指挥者

```
传统模式：
你 → 写代码 → 测试 → 调试 → 部署

AgentDesk 模式：
你 → 下达任务 → 监督进度 → 审查结果
        ↓
    Agent 团队 → 执行所有操作
```

### 2.2 Agent 必须有执行能力

| 能力 | 聊天机器人 | Agent（执行者） |
|------|-----------|----------------|
| 对话 | ✅ | ✅ |
| 执行代码 | ❌ | ✅ |
| 操作文件 | ❌ | ✅ |
| 运行命令 | ❌ | ✅ |
| Git 操作 | ❌ | ✅ |
| 安装依赖 | ❌ | ✅ |

### 2.3 Agent 间必须能通信

```
单 Agent 模式（不够）：
你 → Agent → 结果

多 Agent 协作模式（目标）：
你 → Agent A ←→ Agent B ←→ Agent C
         ↓           ↓           ↓
      架构设计    编写代码    编写测试
```

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层 (UI Layer)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 对话界面  │  │ 任务面板  │  │ Agent 监控│  │ 日志查看 │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      编排引擎 (Orchestrator)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   TaskManager                            │   │
│  │  - 接收用户输入                                          │   │
│  │  - 分解为子任务                                          │   │
│  │  - 分配给合适的 Agent                                    │   │
│  │  - 跟踪任务状态                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   MessageBus                             │   │
│  │  - Agent 间消息传递                                      │   │
│  │  - 发布/订阅模式                                         │   │
│  │  - 消息路由和过滤                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   SharedWorkspace                        │   │
│  │  - 文件系统共享                                          │   │
│  │  - 上下文同步                                            │   │
│  │  - 状态管理                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Agent 团队                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Agent A    │←──→│   Agent B    │←──→│   Agent C    │      │
│  │  (架构师)     │    │  (开发者)     │    │  (测试员)     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      执行层 (Execution Layer)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 文件操作  │  │ 代码执行  │  │ 终端命令  │  │ Git 操作 │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流

```
用户下达任务
    ↓
编排器接收并分解任务
    ↓
消息总线路由到目标 Agent
    ↓
Agent 执行任务并产生结果
    ↓
结果通过消息总线返回
    ↓
编排器汇总并更新状态
    ↓
用户查看结果
```

### 3.3 Agent 间通信流

```
Agent A 需要 Agent B 的帮助
    ↓
Agent A 发送协作请求到消息总线
    ↓
消息总线路由到 Agent B
    ↓
Agent B 处理请求并返回结果
    ↓
结果通过消息总线回到 Agent A
    ↓
Agent A 继续执行
```

---

## 4. 核心组件

### 4.1 MessageBus（消息总线）

**职责**：Agent 间通信的核心基础设施

```javascript
// 消息格式
const AgentMessage = {
  id: 'uuid',                    // 消息 ID
  from: 'agent-a',              // 发送者
  to: 'agent-b',                // 接收者（null = 广播）
  type: 'task' | 'question' | 'result' | 'status' | 'file',
  content: {
    text: '消息内容',
    task: {},                    // 任务详情
    files: [],                   // 相关文件
    context: {},                 // 上下文信息
  },
  timestamp: Date.now(),
  replyTo: 'msg-id',            // 回复哪条消息
  taskId: 'task-id',            // 所属任务
}

// 核心 API
class MessageBus {
  // 发送消息给特定 Agent
  send(to: string, message: Message): Promise<void>
  
  // 广播消息给所有 Agent
  broadcast(message: Message): Promise<void>
  
  // 订阅消息
  subscribe(agentId: string, callback: Function): void
  
  // 订阅特定类型消息
  subscribeToType(type: string, callback: Function): void
  
  // 获取历史消息
  getHistory(filters: Object): Message[]
}
```

### 4.2 SharedWorkspace（共享工作区）

**职责**：Agent 间共享文件和上下文

```javascript
class SharedWorkspace {
  // 文件操作
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listFiles(directory: string): Promise<FileInfo[]>
  
  // 代码操作
  searchCode(query: string): Promise<SearchResult[]>
  getFileInfo(path: string): Promise<FileInfo>
  
  // 上下文共享
  setContext(key: string, value: any): void
  getContext(key: string): any
  
  // 文件锁定（防止冲突）
  lockFile(path: string, agentId: string): Promise<boolean>
  unlockFile(path: string): Promise<void>
  isLocked(path: string): boolean
}
```

### 4.3 AgentAdapter（Agent 适配器）

**职责**：统一不同 CLI Agent 的接口

```javascript
class AgentAdapter {
  constructor(agentId: string, cliType: string, config: Object)
  
  // 生命周期
  async start(): Promise<void>
  async stop(): Promise<void>
  async restart(): Promise<void>
  
  // 消息交互
  async sendMessage(message: Message): Promise<void>
  async sendTask(task: Task): Promise<void>
  
  // 状态查询
  getStatus(): AgentStatus
  isOnline(): boolean
  getCapabilities(): string[]
  
  // 事件监听
  onMessage(callback: Function): void
  onStatusChange(callback: Function): void
  onError(callback: Function): void
}
```

**支持的 Agent 类型**：

| 类型 | CLI 工具 | 能力 |
|------|----------|------|
| claude | Claude Code CLI | 全栈开发、文件操作、终端命令 |
| cursor | Cursor Agent | 代码编辑、重构、补全 |
| hermes | Hermes Agent | 通用任务、记忆管理 |
| custom | 自定义 CLI | 可扩展 |

### 4.4 Orchestrator（编排器）

**职责**：任务分解、分配、协调

```javascript
class Orchestrator {
  constructor(
    messageBus: MessageBus,
    workspace: SharedWorkspace,
    agents: Map<string, AgentAdapter>
  )
  
  // 任务管理
  async createTask(description: string): Task
  async assignTask(taskId: string, agentId: string): void
  async autoAssign(taskId: string): void
  
  // 协作管理
  async 协作Task(taskId: string, agentIds: string[]): void
  async分解Task(taskId: string): SubTask[]
  
  // 状态查询
  getTaskStatus(taskId: string): TaskStatus
  getAgentStatus(agentId: string): AgentStatus
  getProgress(): ProgressReport
}
```

### 4.5 TaskManager（任务管理器）

**职责**：任务生命周期管理

```javascript
class TaskManager {
  // 任务创建
  createTask(options: TaskOptions): Task
  
  // 任务状态
  updateStatus(taskId: string, status: TaskStatus): void
  getTask(taskId: string): Task
  getTasks(filters: Object): Task[]
  
  // 任务分解
 分解Task(taskId: string): SubTask[]
  
  // 依赖管理
  addDependency(taskId: string, dependsOn: string): void
  getDependencies(taskId: string): string[]
}
```

---

## 5. 通信协议

### 5.1 消息类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `task` | 分配任务 | "实现用户登录功能" |
| `question` | 询问问题 | "这个 API 怎么调用？" |
| `result` | 返回结果 | "功能已实现，文件在 src/auth.ts" |
| `status` | 状态更新 | "正在执行中..." |
| `file` | 文件共享 | "这是数据库 schema" |
| `协作` | 协作请求 | "我需要你帮忙测试这个功能" |

### 5.2 消息格式

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "from": "agent-architect",
  "to": "agent-developer",
  "type": "task",
  "content": {
    "text": "请实现用户登录 API",
    "task": {
      "id": "task-001",
      "title": "用户登录 API",
      "description": "实现 POST /api/login 接口",
      "requirements": [
        "支持用户名/密码登录",
        "返回 JWT token",
        "处理错误情况"
      ]
    },
    "files": ["src/api/auth.ts"],
    "context": {
      "database": "PostgreSQL",
      "framework": "Express"
    }
  },
  "timestamp": 1718544000000,
  "replyTo": null,
  "taskId": "task-001"
}
```

### 5.3 Agent 通信协议

**CLI Agent 通过 stdin/stdout 通信**：

```javascript
// 发送到 Agent（通过 stdin）
process.stdin.write(JSON.stringify(message) + '\n')

// 从 Agent 接收（通过 stdout）
process.stdout.on('data', (data) => {
  const messages = data.toString().split('\n').filter(Boolean)
  messages.forEach(msg => {
    const parsed = JSON.parse(msg)
    messageBus.deliver(parsed)
  })
})
```

**消息格式约定**：
- 每条消息一行 JSON
- 以换行符 `\n` 分隔
- 支持批量消息

---

## 6. 实施计划

### 阶段 1：基础通信框架

**目标**：实现 Agent 间基本通信

**时间**：第 1 周

**任务**：
- [ ] 实现 MessageBus 核心
- [ ] 实现 AgentAdapter 基础框架
- [ ] 实现 Claude Code CLI 适配器
- [ ] 测试两个 Agent 间通信

**交付物**：
- `src/core/MessageBus.js`
- `src/core/AgentAdapter.js`
- `src/adapters/ClaudeAdapter.js`
- 测试用例

---

### 阶段 2：共享工作区

**目标**：实现 Agent 间文件和上下文共享

**时间**：第 2 周

**任务**：
- [ ] 实现 SharedWorkspace 核心
- [ ] 实现文件读写操作
- [ ] 实现上下文同步
- [ ] 实现文件锁定机制
- [ ] 集成到 AgentAdapter

**交付物**：
- `src/core/SharedWorkspace.js`
- 文件操作 API
- 锁定机制

---

### 阶段 3：编排引擎

**目标**：实现任务分解和智能分配

**时间**：第 3 周

**任务**：
- [ ] 实现 TaskManager
- [ ] 实现 Orchestrator 核心
- [ ] 实现任务分解逻辑
- [ ] 实现智能分配算法
- [ ] 实现协作任务支持

**交付物**：
- `src/core/TaskManager.js`
- `src/core/Orchestrator.js`
- 任务分配算法

---

### 阶段 4：多 Agent 协作

**目标**：实现完整的团队协作功能

**时间**：第 4 周

**任务**：
- [ ] 实现 Agent 间直接通信
- [ ] 实现协作任务流程
- [ ] 实现冲突检测和解决
- [ ] 实现进度同步
- [ ] 集成测试

**交付物**：
- 协作流程引擎
- 冲突解决机制
- 集成测试用例

---

### 阶段 5：UI 增强

**目标**：完善用户界面，提供良好的指挥体验

**时间**：第 5 周

**任务**：
- [ ] 实现任务面板（查看所有任务）
- [ ] 实现 Agent 监控面板
- [ ] 实现消息中心（查看 Agent 间通信）
- [ ] 实现日志查看器
- [ ] 实现进度可视化

**交付物**：
- 任务管理界面
- Agent 监控界面
- 消息中心界面
- 日志查看器

---

### 阶段 6：高级功能

**目标**：增强系统能力

**时间**：第 6 周+

**任务**：
- [ ] 实现更多 Agent 适配器（Cursor、Hermes）
- [ ] 实现版本控制集成
- [ ] 实现执行回放
- [ ] 实现模板和工作流
- [ ] 性能优化

**交付物**：
- 更多 Agent 支持
- Git 集成
- 工作流引擎

---

## 7. 进度跟踪

### 当前状态

**当前阶段**：阶段 1 - 基础通信框架 ✅ 已完成  
**开始日期**：2026-06-16  
**完成日期**：2026-06-16  
**进度**：100%

### 已完成

#### 2026-06-16
- [x] 项目基础结构搭建
- [x] 基本对话功能
- [x] Agent 配置管理
- [x] 会话压缩功能
- [x] 主题切换系统
- [x] 多 CLI 支持框架（cli_registry.cjs）
- [x] **阶段 1：基础通信框架**
  - [x] MessageBus 核心实现（src/core/MessageBus.js）
  - [x] AgentAdapter 基础框架（src/core/AgentAdapter.js）
  - [x] ClaudeAdapter 实现（src/adapters/ClaudeAdapter.js）
- [x] **阶段 2：共享工作区**
  - [x] SharedWorkspace 核心实现（src/core/SharedWorkspace.js）
  - [x] 文件读写操作
  - [x] 上下文同步机制
  - [x] 文件锁定机制（防止冲突）
  - [x] 代码搜索功能

### 进行中

**当前阶段**：阶段 5 - UI 增强
**开始日期**：2026-06-16
**预计完成**：2026-06-23
**进度**：30%

- [x] 任务面板（查看所有任务）- TaskList 升级为使用后端 API
- [ ] Agent 监控面板
- [ ] 消息中心（查看 Agent 间通信）
- [ ] 日志查看器
- [ ] 进度可视化

### 已完成（阶段 1-4 + Agent 通信 + 任务系统）

#### 核心模块
- [x] MessageBus 消息总线（src/core/MessageBus.js）
- [x] AgentAdapter 基础框架（src/core/AgentAdapter.js）
- [x] SharedWorkspace 共享工作区（src/core/SharedWorkspace.js）
- [x] TaskManager 任务管理器（src/core/TaskManager.js）
- [x] Orchestrator 编排引擎（src/core/Orchestrator.js）
- [x] CollaborationManager 协作管理器（src/core/CollaborationManager.js）

#### Agent 通信
- [x] 真正的 CLI Agent 通信（exec + echo pipe）
- [x] WebSocket 任务通知系统
- [x] Agent 任务处理流程
- [x] 持久化 Agent 进程管理

#### 后端 API
- [x] 任务管理 API（/api/tasks CRUD）
- [x] Agent 控制 API（/api/agents/:id/start|stop|send）
- [x] Agent 状态 API（/api/agents/running）
- [x] CLI 类型 API（/api/cli-types）

#### 前端 UI
- [x] 设置页面 Agent 通信界面
- [x] 开发者工具页面（DevTools.jsx）
- [x] 任务列表升级（使用后端 API）
- [x] Dashboard 简化
- [x] CollaborationFlow 简化
- [x] WebSocket 状态指示器
- [x] 任务通知弹窗
- [x] 任务结果显示

### 待处理

- [ ] 阶段 3：编排引擎（Orchestrator、TaskManager）
- [ ] 阶段 4：多 Agent 协作
- [ ] 阶段 5：UI 增强
- [ ] 阶段 6：高级功能

---

## 8. 变更日志

### v1.0 (2026-06-16)
- 创建开发计划文档
- 定义架构设计
- 定义核心组件
- 定义实施计划

---

## 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| Agent | 具有执行能力的 AI 实例 |
| 编排引擎 | 协调多个 Agent 工作的系统 |
| 消息总线 | Agent 间通信的基础设施 |
| 共享工作区 | Agent 间共享的文件和上下文 |
| 任务 | 需要完成的工作单元 |
| 协作 | 多个 Agent 共同完成任务 |

### B. 参考资料

- [Claude Code CLI 文档](https://docs.anthropic.com/claude-code)
- [Cursor Agent 文档](https://cursor.sh/docs)
- [多 Agent 系统设计模式](https://en.wikipedia.org/wiki/Multi-agent_system)

### C. 联系方式

- 项目负责人：梁雄翔 (jinzhong)
- 项目仓库：D:\AgentDesk

---

**文档维护说明**：
- 每完成一个阶段，更新"进度跟踪"部分
- 每有重大变更，更新"变更日志"部分
- 如有新功能需求，更新相应章节并记录原因
