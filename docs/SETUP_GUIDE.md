# AgentDesk 开发环境搭建指南

> 多 Agent 协作开发平台 - 让你成为指挥者

**文档版本**：v1.0  
**最后更新**：2026-06-17  
**适用场景**：新电脑开发环境搭建

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [技术栈](#3-技术栈)
4. [依赖项](#4-依赖项)
5. [开发环境配置](#5-开发环境配置)
6. [项目结构](#6-项目结构)
7. [核心模块说明](#7-核心模块说明)
8. [运行指南](#8-运行指南)
9. [常见问题](#9-常见问题)
10. [开发计划](#10-开发计划)

---

## 1. 项目概述

### 1.1 项目定位

AgentDesk 是一个**多 Agent 协作开发平台**，让用户从"写代码的人"变成"指挥 AI 团队的人"。

### 1.2 核心理念

```
你（指挥者）
    ↓ 下达任务
┌─────────────────────────────────────────────────────┐
│                  AgentDesk 编排引擎                   │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Orchestrator │  │ TaskManager │  │Collaboration│ │
│  │  (编排器)    │  │ (任务管理)   │  │  Manager   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│         ↕               ↕               ↕          │
│  ┌─────────────────────────────────────────────┐   │
│  │           MessageBus + SharedWorkspace       │   │
│  └─────────────────────────────────────────────┘   │
│         ↕               ↕               ↕          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│  │ Agent A  │←──→│ Agent B  │←──→│ Agent C  │     │
│  │ (Claude) │    │ (Cursor) │    │ (Custom) │     │
│  └──────────┘    └──────────┘    └──────────┘     │
└─────────────────────────────────────────────────────┘
```

### 1.3 核心功能

- **多 Agent 协作**：多个 AI Agent 像真实团队一样协作
- **任务编排**：智能分配任务给合适的 Agent
- **消息通信**：Agent 间可以互相通信和共享文件
- **实时通知**：WebSocket 推送任务通知
- **CLI 集成**：支持 Claude Code、Cursor 等 CLI 工具

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层 (UI Layer)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 对话界面  │  │ 任务面板  │  │ 设置页面  │  │ 开发工具 │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      编排引擎 (Orchestrator)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Orchestrator │  │ TaskManager │  │Collaboration│             │
│  │  (编排器)    │  │ (任务管理)   │  │  Manager   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      核心层 (Core Layer)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ MessageBus  │  │SharedWorkspace│ │ AgentAdapter│             │
│  │  (消息总线)  │  │ (共享工作区)  │  │ (适配器)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Agent 层 (Agent Layer)                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │ Claude   │    │  Cursor  │    │  Custom  │                  │
│  │  CLI     │    │  Agent   │    │  Agent   │                  │
│  └──────────┘    └──────────┘    └──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户输入 → 前端 → 代理服务器 → CLI Agent → 执行结果 → 前端显示
    ↓
WebSocket 通知 → 实时状态更新
```

### 2.3 关键文件

| 文件 | 说明 |
|------|------|
| `proxy.cjs` | 代理服务器（后端核心） |
| `src/App.jsx` | 前端入口 |
| `src/core/` | 核心模块（MessageBus、TaskManager 等） |
| `src/hooks/` | React Hooks（useWebSocket、useAgentTaskProcessor 等） |
| `src/components/` | UI 组件 |
| `cli_registry.cjs` | CLI 工具注册表 |

---

## 3. 技术栈

### 3.1 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.1.0 | UI 框架 |
| Vite | 6.3.5 | 构建工具 |
| Tauri | 最新 | 桌面应用框架 |
| GSAP | 3.15.0 | 动画库 |

### 3.2 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 22.20.0+ | 运行时 |
| ws | 最新 | WebSocket 服务器 |
| yaml | 2.9.0+ | YAML 解析 |

### 3.3 CLI 工具

| 工具 | 用途 | 必需？ |
|------|------|--------|
| Claude Code | AI 编程助手 | 推荐 |
| Cursor Agent | 代码编辑 | 可选 |
| Hermes Agent | 通用任务 | 可选 |

---

## 4. 依赖项

### 4.1 系统依赖

#### Windows

```powershell
# 1. Node.js (v18+)
# 下载: https://nodejs.org/

# 2. Git
# 下载: https://git-scm.com/

# 3. Rust (用于 Tauri)
# 下载: https://rustup.rs/

# 4. Python (可选，用于某些脚本)
# 下载: https://www.python.org/
```

#### macOS

```bash
# 1. Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Node.js
brew install node

# 3. Git
brew install git

# 4. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### Linux (Ubuntu/Debian)

```bash
# 1. Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Git
sudo apt-get install git

# 3. Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 4.2 CLI 工具（可选但推荐）

#### Claude Code

```bash
# 安装
npm install -g @anthropic-ai/claude-code

# 配置 API Key
export ANTHROPIC_API_KEY="your-api-key"

# 测试
claude --version
```

#### Cursor Agent

```bash
# Cursor IDE 内置，无需单独安装
```

### 4.3 环境变量

创建 `.env` 文件（或在系统中设置）：

```bash
# Claude API
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_BASE_URL=https://api.anthropic.com

# OpenAI API (如果使用)
OPENAI_API_KEY=your-api-key

# 代理服务器端口
PROXY_PORT=3001
API_PORT=8642
```

---

## 5. 开发环境配置

### 5.1 克隆项目

```bash
# 克隆仓库
git clone https://github.com/xiaoxiongweini37/AgentDesk.git
cd AgentDesk
```

### 5.2 安装依赖

```bash
# 安装前端依赖
npm install

# 安装 Tauri CLI (全局)
npm install -g @tauri-apps/cli
```

### 5.3 配置文件

#### 配置 Agent

编辑 `~/.hermes/agent-orchestrator/config.yaml`：

```yaml
agents:
  commander:
    name: "总指挥"
    role: "协调和分配任务"
    cli_type: "hermes"
    cli_config: {}
    api_key: ""
    base_url: ""
    model: "mimo-v2.5-pro"
    tmux: null

  worker:
    name: "小鸡"
    role: "执行编码任务"
    cli_type: "claude"
    cli_config: {}
    api_key: "your-claude-api-key"
    base_url: "https://api.anthropic.com"
    model: "claude-sonnet-4-20250514"
    tmux: null

  coder-b:
    name: "B号"
    role: "执行架构设计"
    cli_type: "hermes"
    cli_config: {}
    api_key: ""
    base_url: ""
    model: "mimo-v2.5-pro"
    tmux: null
```

#### 配置 CLI 注册表

编辑 `cli_registry.cjs`，添加自定义 CLI：

```javascript
mycli: {
  name: "My CLI",
  icon: "🔧",
  description: "自定义 CLI 工具",
  defaultCommand: "my-cli",
  defaultArgs: ["--session", "{session_id}"],
  defaultEnv: {
    MY_API_KEY: "{api_key}",
  },
  configFields: [
    { key: "api_key", label: "API Key", type: "password" },
  ],
}
```

---

## 6. 项目结构

```
AgentDesk/
├── src/                          # 前端源码
│   ├── core/                     # 核心模块
│   │   ├── MessageBus.js         # 消息总线
│   │   ├── AgentAdapter.js       # Agent 适配器基类
│   │   ├── SharedWorkspace.js    # 共享工作区
│   │   ├── TaskManager.js        # 任务管理器
│   │   ├── Orchestrator.js       # 编排器
│   │   ├── CollaborationManager.js # 协作管理器
│   │   └── index.js              # 模块导出
│   ├── adapters/                 # Agent 适配器
│   │   └── ClaudeAdapter.js      # Claude CLI 适配器
│   ├── hooks/                    # React Hooks
│   │   ├── useHermes.js          # Hermes 通信
│   │   ├── useSessions.js        # 会话管理
│   │   ├── useAgentSelector.js   # Agent 选择
│   │   ├── useWebSocket.js       # WebSocket 连接
│   │   └── useAgentTaskProcessor.js # 任务处理
│   ├── components/               # UI 组件
│   │   ├── Chat.jsx              # 对话界面
│   │   ├── Sidebar.jsx           # 侧边栏
│   │   ├── Settings.jsx          # 设置页面
│   │   ├── TaskList.jsx          # 任务列表
│   │   ├── Dashboard.jsx         # 看板
│   │   ├── DevTools.jsx          # 开发者工具
│   │   └── ...                   # 其他组件
│   ├── styles/                   # 样式文件
│   │   └── global.css            # 全局样式
│   ├── App.jsx                   # 应用入口
│   └── main.jsx                  # 渲染入口
├── src-tauri/                    # Tauri 后端 (Rust)
├── docs/                         # 文档
│   ├── DEVELOPMENT_PLAN.md       # 开发计划
│   └── SETUP_GUIDE.md            # 本文档
├── proxy.cjs                     # 代理服务器（后端核心）
├── cli_registry.cjs              # CLI 注册表
├── package.json                  # 前端依赖
├── vite.config.js                # Vite 配置
├── index.html                    # HTML 入口
└── README.md                     # 项目说明
```

---

## 7. 核心模块说明

### 7.1 MessageBus（消息总线）

**文件**：`src/core/MessageBus.js`

**功能**：
- Agent 间消息传递
- 发布/订阅模式
- 消息历史记录

**使用示例**：

```javascript
import { MessageBus, MessageType } from './core/MessageBus.js'

const bus = new MessageBus()

// 注册 Agent
bus.register('agent-a', agentA)
bus.register('agent-b', agentB)

// 发送消息
await bus.send('agent-b', {
  from: 'agent-a',
  type: MessageType.TASK,
  content: { text: '请实现用户登录功能' },
})

// 广播消息
await bus.broadcast({
  from: 'agent-a',
  type: MessageType.STATUS,
  content: { text: '架构设计已完成' },
})
```

### 7.2 TaskManager（任务管理器）

**文件**：`src/core/TaskManager.js`

**功能**：
- 任务创建、更新、删除
- 任务分解
- 依赖管理

**使用示例**：

```javascript
import { TaskManager, TaskPriority } from './core/TaskManager.js'

const manager = new TaskManager()

// 创建任务
const task = manager.createTask({
  title: '实现用户登录功能',
  description: '包括前后端',
  priority: TaskPriority.HIGH,
})

// 分解任务
manager.decomposeTask(task.id, [
  { title: '设计数据库 schema' },
  { title: '实现后端 API' },
  { title: '实现前端页面' },
])

// 更新状态
manager.updateStatus(task.id, 'completed', { result: '...' })
```

### 7.3 Orchestrator（编排器）

**文件**：`src/core/Orchestrator.js`

**功能**：
- 智能任务分配
- Agent 能力匹配
- 负载均衡

**使用示例**：

```javascript
import { Orchestrator } from './core/Orchestrator.js'

const orchestrator = new Orchestrator(taskManager, messageBus, workspace)

// 注册 Agent 能力
orchestrator.registerAgentCapabilities('agent-a', ['coding', 'architecture'])
orchestrator.registerAgentCapabilities('agent-b', ['testing', 'review'])

// 自动分配任务
await orchestrator.autoAssign(task.id)

// 协作任务
await orchestrator.collaborateTask(task.id, ['agent-a', 'agent-b'])
```

### 7.4 WebSocket 通信

**后端**（proxy.cjs）：

```javascript
// WebSocket 服务器
const wss = new WebSocket.Server({ server })

// 向 Agent 发送消息
sendToAgent('worker', {
  type: 'task_assigned',
  task: { id: '...', title: '...' },
  message: '新任务',
})
```

**前端**（useWebSocket.js）：

```javascript
const { connected, lastMessage } = useWebSocket('worker')

// 监听消息
useEffect(() => {
  if (lastMessage?.type === 'task_assigned') {
    // 处理任务通知
  }
}, [lastMessage])
```

---

## 8. 运行指南

### 8.1 启动开发环境

#### 方式 1：同时启动前端和代理服务器

```bash
# 终端 1：启动代理服务器
node proxy.cjs

# 终端 2：启动前端开发服务器
npm run dev

# 终端 3：启动 Tauri 开发模式（可选）
npm run tauri dev
```

#### 方式 2：使用脚本启动

创建 `start.sh`（Linux/Mac）或 `start.ps1`（Windows）：

```bash
#!/bin/bash
# start.sh

# 启动代理服务器
echo "启动代理服务器..."
node proxy.cjs &
PROXY_PID=$!

# 等待代理服务器启动
sleep 2

# 启动前端
echo "启动前端..."
npm run dev

# 清理
kill $PROXY_PID
```

```powershell
# start.ps1

# 启动代理服务器
Write-Host "启动代理服务器..."
Start-Process -FilePath "node" -ArgumentList "proxy.cjs" -WindowStyle Hidden

# 等待代理服务器启动
Start-Sleep -Seconds 2

# 启动前端
Write-Host "启动前端..."
npm run dev
```

### 8.2 构建生产版本

```bash
# 构建前端
npm run build

# 构建 Tauri 应用
npm run tauri build
```

### 8.3 访问应用

- **开发模式**：http://localhost:1420
- **代理服务器**：http://localhost:3001
- **WebSocket**：ws://localhost:3001

---

## 9. 常见问题

### 9.1 端口被占用

```bash
# 查看端口占用
netstat -ano | findstr :3001  # Windows
lsof -i :3001                 # Linux/Mac

# 杀死进程
taskkill /F /PID <PID>        # Windows
kill -9 <PID>                 # Linux/Mac
```

### 9.2 中文编码问题

确保系统编码为 UTF-8：

```powershell
# Windows PowerShell
chcp 65001
[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

### 9.3 WebSocket 连接失败

检查：
1. 代理服务器是否启动
2. 防火墙是否放行端口 3001
3. 浏览器控制台是否有错误

### 9.4 CLI 工具找不到

```bash
# 检查 CLI 是否安装
which claude    # Linux/Mac
where claude    # Windows

# 添加到 PATH
export PATH=$PATH:/path/to/cli
```

### 9.5 任务执行失败

检查：
1. CLI 工具是否正确安装
2. API Key 是否配置
3. 网络是否正常

---

## 10. 开发计划

### 当前进度

- ✅ 阶段 1：基础通信框架
- ✅ 阶段 2：共享工作区
- ✅ 阶段 3：编排引擎
- ✅ 阶段 4：多 Agent 协作
- 🔄 阶段 5：UI 增强（30%）
- ⏳ 阶段 6：高级功能

### 下一步

1. **UI 增强**
   - Agent 监控面板
   - 消息中心
   - 日志查看器

2. **高级功能**
   - 持久化存储
   - 更多 Agent 适配器
   - 版本控制集成

3. **优化**
   - 性能优化
   - 错误处理
   - 测试覆盖

---

## 附录

### A. 快速命令参考

```bash
# 启动开发
npm run dev                    # 前端开发服务器
node proxy.cjs                 # 代理服务器
npm run tauri dev              # Tauri 开发模式

# 构建
npm run build                  # 构建前端
npm run tauri build            # 构建 Tauri 应用

# Git
git status                     # 查看状态
git add -A                     # 暂存所有
git commit -m "message"        # 提交
git push                       # 推送
git pull                       # 拉取
```

### B. 配置文件位置

| 文件 | 位置 | 说明 |
|------|------|------|
| Agent 配置 | `~/.hermes/agent-orchestrator/config.yaml` | Agent 列表和配置 |
| CLI 注册表 | `./cli_registry.cjs` | 支持的 CLI 工具 |
| 会话数据 | `~/.hermes/sessions/` | 会话历史 |
| 挂载配置 | `~/.hermes/mounts/` | 文件挂载 |

### C. API 端点参考

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/tasks` | GET | 获取任务列表 |
| `/api/tasks` | POST | 创建任务 |
| `/api/tasks/:id` | PUT | 更新任务 |
| `/api/tasks/:id` | DELETE | 删除任务 |
| `/api/tasks/:id/assign` | POST | 分配任务 |
| `/api/agents` | GET | 获取 Agent 列表 |
| `/api/agents/:id/start` | POST | 启动 Agent |
| `/api/agents/:id/stop` | POST | 停止 Agent |
| `/api/agents/:id/send` | POST | 发送消息给 Agent |
| `/api/agents/running` | GET | 获取运行中的 Agent |
| `/api/cli-types` | GET | 获取支持的 CLI 类型 |
| `/api/test/agent` | POST | 测试 Agent 通信 |

### D. WebSocket 消息类型

| 类型 | 说明 |
|------|------|
| `connected` | 连接成功 |
| `task_assigned` | 任务分配通知 |
| `progress_update` | 进度更新 |
| `collaboration_request` | 协作请求 |
| `conflict_detected` | 冲突检测 |

---

**文档完成！** 如有问题，请查看 `docs/DEVELOPMENT_PLAN.md` 或提交 Issue。
