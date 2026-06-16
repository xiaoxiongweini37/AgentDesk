# AgentDesk 架构设计

## 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentDesk 桌面应用                      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    Tauri 框架                        │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │              React 前端                      │  │  │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐         │  │  │
│  │  │  │Chat │ │Tasks│ │Files│ │Dash │         │  │  │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘         │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      代理服务器 (proxy.cjs)                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  • CORS 处理                                        │  │
│  │  • 会话 ID 管理                                     │  │
│  │  • 看板数据聚合                                     │  │
│  │  • API 请求转发                                     │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hermes Gateway (localhost:8642)           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  • API Server                                       │  │
│  │  • 会话管理                                         │  │
│  │  • 模型调用                                         │  │
│  │  • 工具执行                                         │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       AI 模型服务                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  • mimo-v2.5-pro (小米)                             │  │
│  │  • 其他模型 (可扩展)                                │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 组件架构

### 1. 前端组件层

```
App.jsx
├── Sidebar.jsx              # 侧边栏导航
├── Chat.jsx                 # 对话组件
├── TaskList.jsx             # 任务列表
├── FileUpload.jsx           # 文件上传
└── Dashboard.jsx            # 看板组件
```

**组件职责**:

- **App**: 根组件，管理全局状态和路由
- **Sidebar**: 导航菜单，切换不同功能模块
- **Chat**: 对话界面，消息输入/显示
- **TaskList**: 任务管理，CRUD 操作
- **FileUpload**: 文件处理，拖拽上传
- **Dashboard**: 看板显示，实时监控

### 2. Hook 层

```
hooks/
└── useHermes.js             # Hermes API 连接
```

**职责**:
- 管理 API 连接状态
- 处理消息发送/接收
- 管理会话 ID
- 提供错误处理

### 3. 服务层

```
proxy.cjs                    # 代理服务器
├── 会话 ID 管理
├── 看板数据聚合
├── API 请求转发
└── CORS 处理
```

**职责**:
- 解决 CORS 跨域问题
- 聚合多个数据源
- 提供统一 API 接口
- 处理认证和授权

### 4. 数据层

```
Hermes Gateway
├── 会话数据库 (SQLite)
├── 技能库
├── 配置文件
└── 日志系统
```

## 数据流架构

### 1. 对话数据流

```
用户输入
    ↓
React 组件 (Chat.jsx)
    ↓
useHermes Hook
    ↓
fetch API 调用
    ↓
代理服务器 (proxy.cjs)
    ↓
Hermes Gateway API
    ↓
AI 模型服务
    ↓
响应返回
    ↓
状态更新
    ↓
UI 渲染
```

### 2. 看板数据流

```
定时器 (5秒)
    ↓
fetch('/api/dashboard')
    ↓
代理服务器
    ↓
tmux 会话读取
    ↓
状态检测
    ↓
JSON 序列化
    ↓
前端渲染
```

### 3. 会话共享数据流

```
启动时
    ↓
fetch('/api/session-id')
    ↓
读取 ~/.hermes/sessions/
    ↓
获取最新 CLI 会话 ID
    ↓
存储到 React 状态
    ↓
后续请求携带 X-Hermes-Session-Id
```

## 状态管理

### 1. 全局状态 (App.jsx)

```javascript
const [activeTab, setActiveTab] = useState('chat')
const [messages, setMessages] = useState([])
```

### 2. 组件状态

```javascript
// Chat.jsx
const [input, setInput] = useState('')

// Dashboard.jsx
const [agents, setAgents] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
const [lastUpdate, setLastUpdate] = useState(null)
```

### 3. Hook 状态 (useHermes.js)

```javascript
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState(null)
const [sessionId, setSessionId] = useState(null)
```

## 安全架构

### 1. 认证机制

```
API Key 认证
    ↓
Authorization: Bearer hermes-secret-key-2026
    ↓
代理服务器验证
    ↓
转发到 Hermes Gateway
```

### 2. 会话安全

```
会话 ID 验证
    ↓
X-Hermes-Session-Id 头
    ↓
代理服务器读取会话文件
    ↓
验证会话有效性
```

### 3. 数据安全

- 所有数据本地存储
- 不上传云端
- API Key 不暴露给前端
- 使用 HTTPS（生产环境）

## 性能架构

### 1. 前端性能

- **虚拟滚动**: 大量日志时使用虚拟滚动
- **防抖处理**: 频繁更新时使用防抖
- **懒加载**: 组件按需加载
- **缓存策略**: 合理使用缓存减少请求

### 2. 后端性能

- **连接池**: 复用 HTTP 连接
- **异步处理**: 使用异步操作
- **缓存**: 缓存会话数据
- **压缩**: 启用 gzip 压缩

### 3. 网络性能

- **CDN**: 使用 CDN 加速静态资源
- **HTTP/2**: 支持 HTTP/2 协议
- **Keep-Alive**: 启用长连接
- **请求合并**: 合并多个请求

## 可扩展性架构

### 1. 组件扩展

```javascript
// 添加新功能模块
const tabs = [
  { id: 'chat', icon: '💬', label: '对话' },
  { id: 'tasks', icon: '📋', label: '任务' },
  { id: 'files', icon: '📁', label: '文件' },
  { id: 'dashboard', icon: '📊', label: '看板' },
  { id: 'new-feature', icon: '🔧', label: '新功能' }, // 新增
]
```

### 2. API 扩展

```javascript
// 添加新 API 接口
if (req.url === '/api/new-endpoint') {
  // 处理逻辑
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
  return
}
```

### 3. 智能体扩展

```javascript
// 添加新智能体
const agents = [
  { id: 'commander', name: '总指挥', role: '协调·监控·读图', tmux: null },
  { id: 'worker', name: 'A号', role: '速度型编码', tmux: 'worker' },
  { id: 'coder-b', name: 'B号', role: '严谨型编码', tmux: 'coder-b' },
  { id: 'coder-c', name: 'C号', role: '测试评估', tmux: 'coder-c' },
  { id: 'claude-code', name: 'Claude', role: 'Claude Code CLI', tmux: 'claude-code' },
  { id: 'new-agent', name: '新智能体', role: '新角色', tmux: 'new-agent' }, // 新增
]
```

## 部署架构

### 1. 开发环境

```
开发者机器
├── Node.js 环境
├── Rust 环境
├── Tauri CLI
└── 代理服务器
```

### 2. 测试环境

```
测试机器
├── 构建产物 (exe)
├── 代理服务器
└── Hermes Gateway
```

### 3. 生产环境

```
用户机器
├── AgentDesk.exe
├── 代理服务器 (可选)
└── Hermes Gateway (可选)
```

## 监控架构

### 1. 日志监控

```
前端日志
├── console.log
├── 错误边界
└── 用户操作日志

后端日志
├── API 调用日志
├── 错误日志
└── 性能日志
```

### 2. 性能监控

```
性能指标
├── API 响应时间
├── 渲染性能
├── 内存使用
└── CPU 使用
```

### 3. 错误监控

```
错误类型
├── API 错误
├── 渲染错误
├── 网络错误
└── 未知错误
```

## 未来演进

### 1. 短期演进

- 完善现有功能
- 优化性能
- 添加测试
- 完善文档

### 2. 中期演进

- 添加插件系统
- 支持多主题
- 国际化支持
- 移动端适配

### 3. 长期演进

- 分布式架构
- 云端同步
- AI 增强
- 生态建设

## 技术债务

### 1. 当前技术债务

- 缺少单元测试
- 错误处理不完善
- 类型定义缺失
- 文档不完整

### 2. 偿还计划

- 添加 Jest 测试
- 完善错误边界
- 引入 TypeScript
- 补充文档

## 总结

AgentDesk 采用分层架构设计，各层职责清晰，耦合度低。通过代理服务器解决跨域问题，通过 tmux 会话读取实现智能体监控。系统具有良好的可扩展性和可维护性，能够支持未来的功能扩展和性能优化。
