# AgentDesk 项目 - Claude 工作记录

## 项目概述
- **项目名称**: AgentDesk
- **项目定位**: 多 Agent 协作开发平台 - 让你成为指挥者
- **技术栈**: React + Vite + Tauri (Rust) + GSAP
- **主要功能**: 多 Agent 协作、任务编排、消息路由、共享工作区

## 核心理念
- **你负责决策**：定义需求、审查结果、调整方向
- **Agent 负责执行**：写代码、测试、部署、调试
- **团队协作**：多个 Agent 像真实团队一样协作

## 关键文件
- **开发计划**: docs/DEVELOPMENT_PLAN.md ⭐ **必读**
- **前端入口**: src/
- **Rust 后端**: src-tauri/
- **代理服务器**: proxy.cjs
- **CLI 注册表**: cli_registry.cjs
- **文档**: docs/
- **配置**: package.json, vite.config.js

## 开发规范
1. **遵循开发计划** - 所有开发工作按照 docs/DEVELOPMENT_PLAN.md 执行
2. **更新进度** - 完成任务后更新 DEVELOPMENT_PLAN.md 的进度跟踪部分
3. **记录变更** - 重大变更记录到 DEVELOPMENT_PLAN.md 的变更日志
4. **新功能插入** - 如有新功能需求，更新 DEVELOPMENT_PLAN.md 相应章节

## 工作规则

### 必须遵循的规则
1. **频繁保存** - 每完成一个子任务，立即更新此文件
2. **原子化提交** - 每完成一个可运行功能，立即 git commit
3. **记录决策** - 重要技术决策立即记录
4. **断点续传** - 任何中断后都能从这里恢复

### 保存格式
```markdown
## [日期] 工作记录

### 已完成
- [x] 任务1
- [x] 任务2

### 进行中
- [ ] 任务3 (进度: 60%)
  - 完成部分：xxx
  - 待完成部分：xxx
  - 相关文件：xxx

### 待处理
- [ ] 任务4
- [ ] 任务5

### 决策记录
- 决策1：选择了A方案，因为...
- 决策2：...

### 问题记录
- 问题1：描述 + 解决方案
- 问题2：...
```

---

## 当前状态

**最后更新**: 2026-06-17

### 最近完成的工作

#### 2026-06-17: 多 Agent 协作系统核心实现
- 实现 MessageBus 消息总线（src/core/MessageBus.js）
- 实现 AgentAdapter 基础框架（src/core/AgentAdapter.js）
- 实现 SharedWorkspace 共享工作区（src/core/SharedWorkspace.js）
- 实现 TaskManager 任务管理器（src/core/TaskManager.js）
- 实现 Orchestrator 编排引擎（src/core/Orchestrator.js）
- 实现 CollaborationManager 协作管理器（src/core/CollaborationManager.js）
- 实现真正的 CLI Agent 通信（exec + echo pipe）
- 实现 WebSocket 任务通知系统
- 实现 Agent 任务处理流程
- 添加任务管理 API（/api/tasks）
- 添加 Agent 控制 API（/api/agents/:id/start|stop|send）
- 添加开发者工具页面（DevTools.jsx）
- 修复中文编码问题

#### 2026-06-16: 基础功能完善
- 添加 Claude 自动压缩机制
- 实现会话压缩功能
- Progress 标签页基础改进
- 完善工作目录功能
- 主题切换系统完善
- 持久化 session ID

#### 2026-06-15: UI 重构
- 大规模 UI 重构和样式系统优化
- 引入毛玻璃效果、现代化颜色变量

#### 2026-06-11: 项目初始化
- 项目基础结构搭建
- 添加图片粘贴和文件上传功能
- 实现 Agent 配置 UI

### 正在进行的工作
- 暂无进行中的任务

### 待处理任务
- UI 增强（阶段 5）
- 高级功能（阶段 6）
- 持久化存储
- 更多 Agent 适配器

### 已知问题
- 暂无记录

### 重要决策记录
- 采用毛玻璃效果和现代化颜色变量系统，提升 UI 质感
- 使用 CSS 变量统一管理样式，便于主题切换和维护
- 工作目录和挂载文件分离：工作目录是 Agent 实际操作目录，挂载文件是提供给大模型的参考文件

---

## 自动压缩机制

**触发条件**：
- 对话超过 50 轮
- 上下文使用率超过 70%
- 用户说"压缩"或"保存进度"

**压缩内容**：
- 保留：关键决策、代码修改、未完成任务、文件路径
- 丢弃：思考过程、重复解释、临时调试信息

**使用方法**：
- 自动：当上下文快满时，我会自动总结并更新此文件
- 手动：你可以说"保存进度"、"压缩会话"或"总结一下"

---

## 恢复流程

**新会话开始时**：
1. 读取此文件了解项目状态
2. 运行 `git log --oneline -10` 查看最近提交
3. 查看 `git status` 了解未提交的修改
4. 从"正在进行的工作"部分继续

**会话结束时**：
1. 更新"当前状态"部分
2. 记录所有完成的工作
3. 记录所有进行中的任务和进度
4. Git commit 所有修改

---

## 快速命令

```bash
# 启动开发环境
node proxy.cjs &
npm run tauri dev

# 构建应用
npm run tauri build

# 查看最近提交
git log --oneline -10

# 查看当前状态
git status
```
