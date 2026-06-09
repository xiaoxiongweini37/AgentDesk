# AgentDesk

基于 Hermes Agent 的桌面端智能体应用。

## 功能

- 💬 对话窗口 — 与 AI 助手对话
- 📋 任务管理 — 创建、跟踪、完成任务
- 📁 文件上传 — 拖拽或选择文件上传
- 📊 团队看板 — 实时监控多个智能体状态

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
# 启动代理服务器
node proxy.cjs &

# 启动 Tauri 开发服务器
npm run tauri dev
```

### 构建应用

```bash
# 构建桌面应用
npm run tauri build
```

## 文档

详细文档请参考 `docs/` 目录：

- [设计文档](docs/design.md) — 项目背景和目标
- [实现细节](docs/implementation.md) — 技术实现
- [调研资料](docs/research.md) — 技术选型和竞品分析
- [API 文档](docs/api.md) — 接口说明
- [架构设计](docs/architecture.md) — 系统架构
- [开发指南](docs/development.md) — 开发环境搭建

## 技术栈

- **前端**: React + Vite
- **桌面**: Tauri (Rust)
- **AI**: Hermes Agent API
- **动画**: GSAP

## 项目结构

```
AgentDesk/
├── src/                # React 前端
│   ├── components/     # UI 组件
│   ├── hooks/          # 自定义 Hook
│   └── styles/         # 样式文件
├── src-tauri/          # Rust 后端 (Tauri)
├── proxy.cjs           # 代理服务器
├── docs/               # 文档
├── package.json
└── vite.config.js
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 许可证

MIT
