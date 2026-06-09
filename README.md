# AgentDesk

基于 Hermes Agent 的桌面端智能体应用。

## 功能

- 💬 对话窗口 — 与 AI 助手对话
- 📋 任务管理 — 创建、跟踪、完成任务
- 📁 文件上传 — 拖拽或选择文件上传
- 🔗 文件夹链接 — 快速访问常用文件夹

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 技术栈

- **前端**: React + Vite
- **桌面**: Tauri (Rust)
- **AI**: Hermes Agent API

## 项目结构

```
AgentDesk/
├── src/                # React 前端
│   ├── components/     # UI 组件
│   │   ├── Chat.jsx        # 对话窗口
│   │   ├── TaskList.jsx    # 任务列表
│   │   ├── FileUpload.jsx  # 文件上传
│   │   └── Sidebar.jsx     # 侧边栏
│   ├── hooks/          # 自定义 Hook
│   ├── styles/         # 样式文件
│   ├── App.jsx         # 主应用
│   └── main.jsx        # 入口文件
├── src-tauri/          # Rust 后端 (Tauri)
├── public/             # 静态资源
├── package.json
└── vite.config.js
```

## 许可证

MIT
