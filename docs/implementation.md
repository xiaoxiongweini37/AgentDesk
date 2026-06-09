# AgentDesk 实现细节

## 项目结构

```
AgentDesk/
├── src/                          # 前端源码
│   ├── components/               # React 组件
│   │   ├── Chat.jsx             # 对话组件
│   │   ├── Dashboard.jsx        # 看板组件
│   │   ├── FileUpload.jsx       # 文件上传组件
│   │   ├── Sidebar.jsx          # 侧边栏组件
│   │   └── TaskList.jsx         # 任务列表组件
│   ├── hooks/                   # 自定义 Hook
│   │   └── useHermes.js         # Hermes API 连接
│   ├── styles/                  # 样式文件
│   │   └── global.css           # 全局样式
│   ├── App.jsx                  # 主应用组件
│   └── main.jsx                 # 入口文件
├── src-tauri/                   # Tauri 后端
│   ├── src/
│   │   └── main.rs             # Rust 入口
│   ├── Cargo.toml              # Rust 依赖
│   └── tauri.conf.json         # Tauri 配置
├── proxy.cjs                   # 代理服务器
├── docs/                       # 文档
├── package.json                # Node.js 依赖
└── vite.config.js              # Vite 配置
```

## 核心模块实现

### 1. useHermes Hook

**文件**: `src/hooks/useHermes.js`

**职责**:
- 管理与 Hermes API 的连接
- 处理消息发送和接收
- 管理会话 ID
- 提供健康检查

**关键代码**:

```javascript
import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

export function useHermes() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sessionId, setSessionId] = useState(null)

  // 启动时获取当前 CLI session ID
  useEffect(() => {
    fetch(`${API_BASE}/api/session-id`)
      .then(r => r.json())
      .then(data => {
        if (data.session_id) {
          setSessionId(data.session_id)
        }
      })
      .catch(err => console.error('获取 session ID 失败:', err))
  }, [])

  const sendMessage = useCallback(async (messages) => {
    setIsLoading(true)
    setError(null)

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer hermes-secret-key-2026',
      }
      
      if (sessionId) {
        headers['X-Hermes-Session-Id'] = sessionId
      }

      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'mimo-v2.5-pro',
          messages: messages,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  return {
    sendMessage,
    isLoading,
    error,
    sessionId,
  }
}
```

### 2. 代理服务器

**文件**: `proxy.cjs`

**职责**:
- 解决 CORS 跨域问题
- 提供会话 ID 接口
- 提供看板数据接口
- 转发 API 请求

**关键功能**:

```javascript
// 会话 ID 获取
function getCurrentSessionId() {
  const sessionsDir = '/home/jinzhong/.hermes/sessions'
  const files = fs.readdirSync(sessionsDir)
    .filter(f => f.startsWith('session_') && f.endsWith('.json'))
    .filter(f => !f.includes('api-') && !f.includes('cron_'))
    .sort()
    .reverse()
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'))
    if (data.session_id && data.platform === 'cli') {
      return data.session_id
    }
  }
  return null
}

// 看板数据
function getDashboardData() {
  const agents = [
    { id: 'commander', name: '总指挥', role: '协调·监控·读图', tmux: null },
    { id: 'worker', name: 'A号', role: '速度型编码', tmux: 'worker' },
    { id: 'coder-b', name: 'B号', role: '严谨型编码', tmux: 'coder-b' },
    { id: 'coder-c', name: 'C号', role: '测试评估', tmux: 'coder-c' },
    { id: 'claude-code', name: 'Claude', role: 'Claude Code CLI', tmux: 'claude-code' },
  ]
  
  return agents.map(agent => {
    if (!agent.tmux) {
      return { ...agent, online: true, task: '协调团队·监控进度·验收质量', output: '在线' }
    }
    
    const online = isSessionActive(agent.tmux)
    const output = online ? getTmuxOutput(agent.tmux, 100) : ''
    const task = detectTask(output)
    
    return { ...agent, online, task, output: output || '离线' }
  })
}
```

### 3. 看板组件

**文件**: `src/components/Dashboard.jsx`

**职责**:
- 显示所有智能体状态
- 实时刷新数据
- 自动滚动到最新内容

**关键实现**:

```javascript
export default function Dashboard() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const outputRefs = useRef({})

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard`)
      if (!response.ok) throw new Error('Failed to fetch dashboard')
      const data = await response.json()
      setAgents(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 5000) // 每 5 秒刷新
    return () => clearInterval(interval)
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    agents.forEach(agent => {
      const ref = outputRefs.current[agent.id]
      if (ref) {
        ref.scrollTop = ref.scrollHeight
      }
    })
  }, [agents])

  // ... 渲染逻辑
}
```

## 构建与部署

### 开发环境

```bash
# 安装依赖
npm install

# 启动代理服务器
node proxy.cjs &

# 启动开发服务器
npm run tauri dev
```

### 生产构建

```bash
# 构建前端
npm run build

# 构建桌面应用（不打包安装包）
npm run tauri build -- --no-bundle

# 构建桌面应用（包含安装包）
npm run tauri build
```

### 部署流程

1. **开发阶段**: 使用 `npm run tauri dev` 实时预览
2. **测试阶段**: 使用 `npm run tauri build -- --no-bundle` 生成 exe
3. **发布阶段**: 使用 `npm run tauri build` 生成安装包

## 常见问题

### 1. CORS 错误

**问题**: 浏览器报跨域错误

**解决**: 确保代理服务器运行在 3001 端口

```bash
node proxy.cjs &
```

### 2. API 连接失败

**问题**: 无法连接到 Hermes API

**解决**: 检查 Hermes Gateway 是否运行

```bash
hermes gateway status
hermes gateway start
```

### 3. 看板数据为空

**问题**: 看板显示"无输出"

**解决**: 检查 tmux 会话是否存在

```bash
tmux list-sessions
```

### 4. 构建失败

**问题**: Tauri 构建失败

**解决**: 安装必要的系统依赖

```bash
# Windows
winget install Microsoft.VisualStudio.2022.BuildTools

# Linux
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev
```

## 性能优化

### 1. 减少 API 请求

- 使用防抖处理频繁更新
- 合理设置轮询间隔
- 使用缓存减少重复请求

### 2. 优化渲染性能

- 使用虚拟滚动处理大量日志
- 避免不必要的重渲染
- 使用 React.memo 优化组件

### 3. 内存管理

- 及时清理定时器
- 避免内存泄漏
- 定期清理日志数据

## 测试策略

### 单元测试

- 使用 Jest 测试工具函数
- 使用 React Testing Library 测试组件

### 集成测试

- 测试 API 连接
- 测试数据流
- 测试用户交互

### 端到端测试

- 使用 Playwright 测试完整流程
- 测试桌面应用功能

## 监控与日志

### 日志记录

- 前端错误日志
- API 调用日志
- 用户操作日志

### 性能监控

- API 响应时间
- 渲染性能
- 内存使用情况

## 更新日志

### v0.1.0 (2026-06-09)

- 初始版本发布
- 基础对话功能
- 任务管理功能
- 文件上传功能
- 看板功能
