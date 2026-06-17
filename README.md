# AgentDesk

> 多 Agent 协作开发平台 - 让你成为指挥者，让 AI 团队执行

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 项目简介

AgentDesk 是一个**多 Agent 协作开发平台**，让用户从"写代码的人"变成"指挥 AI 团队的人"。

### 核心理念

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
│  ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│  │ Claude   │    │  Cursor  │    │  Custom  │     │
│  │  CLI     │    │  Agent   │    │  Agent   │     │
│  └──────────┘    └──────────┘    └──────────┘     │
└─────────────────────────────────────────────────────┘
```

## ✨ 核心功能

- 🤖 **多 Agent 协作** — 多个 AI Agent 像真实团队一样协作
- 📋 **任务编排** — 智能分配任务给合适的 Agent
- 💬 **消息通信** — Agent 间可以互相通信和共享文件
- 🔔 **实时通知** — WebSocket 推送任务通知
- 🔧 **CLI 集成** — 支持 Claude Code、Cursor 等 CLI 工具
- 🎨 **现代 UI** — 毛玻璃效果、主题切换

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Git
- Rust (用于 Tauri)
- Claude Code CLI (推荐)

### 安装

```bash
# 克隆仓库
git clone https://github.com/xiaoxiongweini37/AgentDesk.git
cd AgentDesk

# 安装依赖
npm install
```

### 配置

编辑 `~/.hermes/agent-orchestrator/config.yaml`：

```yaml
agents:
  worker:
    name: "小鸡"
    cli_type: "claude"
    api_key: "your-api-key"
    base_url: "https://api.anthropic.com"
    model: "claude-sonnet-4-20250514"
```

### 启动

```bash
# 终端 1：启动代理服务器
node proxy.cjs

# 终端 2：启动前端
npm run dev

# 终端 3：启动 Tauri (可选)
npm run tauri dev
```

访问 http://localhost:1420

## 📖 文档

- **[开发环境搭建指南](docs/SETUP_GUIDE.md)** ⭐ **新人必读**
- **[开发计划](docs/DEVELOPMENT_PLAN.md)** — 项目进度和架构设计
- **[CLAUDE.md](CLAUDE.md)** — 项目状态和工作记录

## 🏗️ 项目结构

```
AgentDesk/
├── src/                          # 前端源码
│   ├── core/                     # 核心模块
│   │   ├── MessageBus.js         # 消息总线
│   │   ├── TaskManager.js        # 任务管理器
│   │   ├── Orchestrator.js       # 编排器
│   │   └── ...
│   ├── hooks/                    # React Hooks
│   ├── components/               # UI 组件
│   └── styles/                   # 样式文件
├── proxy.cjs                     # 代理服务器（后端核心）
├── cli_registry.cjs              # CLI 注册表
├── docs/                         # 文档
├── package.json
└── vite.config.js
```

## 🔧 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + Vite + GSAP |
| 桌面 | Tauri (Rust) |
| 后端 | Node.js + WebSocket |
| AI | Claude Code CLI, Cursor Agent |

## 📝 开发进度

- ✅ 阶段 1：基础通信框架
- ✅ 阶段 2：共享工作区
- ✅ 阶段 3：编排引擎
- ✅ 阶段 4：多 Agent 协作
- 🔄 阶段 5：UI 增强 (30%)
- ⏳ 阶段 6：高级功能

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**Made with ❤️ by jinzhong**
