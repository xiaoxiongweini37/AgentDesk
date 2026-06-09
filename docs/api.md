# AgentDesk API 文档

## 概述

AgentDesk 通过代理服务器与 Hermes API 通信，解决 CORS 跨域问题。

## 代理服务器

**地址**: `http://localhost:3001`

**功能**:
- 转发 API 请求到 Hermes Gateway
- 提供会话 ID 接口
- 提供看板数据接口
- 处理 CORS 跨域

## API 接口

### 1. 健康检查

**接口**: `GET /health`

**响应**:
```json
{
  "status": "ok",
  "platform": "hermes-agent"
}
```

**用途**: 检查 API 服务是否正常

### 2. 获取会话 ID

**接口**: `GET /api/session-id`

**响应**:
```json
{
  "session_id": "20260608_165429_4c8909"
}
```

**用途**: 获取当前 CLI 会话 ID，用于共享对话

### 3. 获取看板数据

**接口**: `GET /api/dashboard`

**响应**:
```json
[
  {
    "id": "commander",
    "name": "总指挥",
    "role": "协调·监控·读图",
    "tmux": null,
    "online": true,
    "task": "协调团队·监控进度·验收质量",
    "output": "在线"
  },
  {
    "id": "worker",
    "name": "A号",
    "role": "速度型编码",
    "tmux": "worker",
    "online": true,
    "task": "⚙️ 执行代码中",
    "output": "...(tmux 输出内容)..."
  }
]
```

**字段说明**:
- `id`: 智能体唯一标识
- `name`: 显示名称
- `role`: 角色描述
- `tmux`: tmux 会话名称（null 表示非 tmux 管理）
- `online`: 是否在线
- `task`: 当前任务状态
- `output`: 最近输出内容

### 4. 聊天完成

**接口**: `POST /v1/chat/completions`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer hermes-secret-key-2026
X-Hermes-Session-Id: <session-id>  // 可选，用于共享会话
```

**请求体**:
```json
{
  "model": "mimo-v2.5-pro",
  "messages": [
    {
      "role": "user",
      "content": "你好"
    }
  ]
}
```

**响应**:
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1780975734,
  "model": "mimo-v2.5-pro",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么可以帮助你的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 19759,
    "completion_tokens": 73,
    "total_tokens": 19832
  }
}
```

**字段说明**:
- `model`: 模型名称
- `messages`: 消息数组
  - `role`: 消息角色（user/assistant/system）
  - `content`: 消息内容
- `X-Hermes-Session-Id`: 可选，用于共享 CLI 会话

## 错误处理

### 错误响应格式

```json
{
  "error": {
    "message": "错误信息",
    "type": "错误类型",
    "code": "错误代码"
  }
}
```

### 常见错误

| 状态码 | 错误类型 | 说明 |
|--------|----------|------|
| 400 | invalid_request_error | 请求参数错误 |
| 401 | authentication_error | 认证失败 |
| 403 | permission_error | 权限不足 |
| 404 | not_found | 接口不存在 |
| 500 | internal_error | 服务器内部错误 |

## 认证方式

### API Key 认证

所有需要认证的接口都需要在请求头中包含：

```
Authorization: Bearer hermes-secret-key-2026
```

### 会话认证

共享会话需要额外的请求头：

```
X-Hermes-Session-Id: <session-id>
```

## 使用示例

### JavaScript

```javascript
// 获取会话 ID
const sessionResponse = await fetch('http://localhost:3001/api/session-id')
const { session_id } = await sessionResponse.json()

// 发送消息
const response = await fetch('http://localhost:3001/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer hermes-secret-key-2026',
    'X-Hermes-Session-Id': session_id,
  },
  body: JSON.stringify({
    model: 'mimo-v2.5-pro',
    messages: [{ role: 'user', content: '你好' }],
  }),
})

const data = await response.json()
console.log(data.choices[0].message.content)
```

### cURL

```bash
# 获取会话 ID
curl http://localhost:3001/api/session-id

# 发送消息
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer hermes-secret-key-2026" \
  -d '{"model":"mimo-v2.5-pro","messages":[{"role":"user","content":"你好"}]}'

# 获取看板数据
curl http://localhost:3001/api/dashboard
```

### Python

```python
import requests

# 获取会话 ID
session_response = requests.get('http://localhost:3001/api/session-id')
session_id = session_response.json()['session_id']

# 发送消息
response = requests.post(
    'http://localhost:3001/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer hermes-secret-key-2026',
        'X-Hermes-Session-Id': session_id,
    },
    json={
        'model': 'mimo-v2.5-pro',
        'messages': [{'role': 'user', 'content': '你好'}],
    },
)

data = response.json()
print(data['choices'][0]['message']['content'])
```

## 限制与注意事项

### 请求限制

- 请求频率: 无明确限制，但建议不要过于频繁
- 请求大小: 建议单个请求不超过 10MB
- 超时时间: 默认 30 秒

### 安全建议

1. **API Key 保护**: 不要在客户端代码中硬编码 API Key
2. **HTTPS**: 生产环境建议使用 HTTPS
3. **输入验证**: 验证用户输入，防止注入攻击
4. **错误处理**: 不要将详细错误信息暴露给用户

### 性能优化

1. **连接池**: 使用连接池复用连接
2. **缓存**: 合理使用缓存减少请求
3. **压缩**: 启用 gzip 压缩
4. **异步**: 使用异步请求提高并发

## 更新日志

### v1.0.0 (2026-06-09)

- 初始版本
- 支持聊天完成接口
- 支持会话 ID 获取
- 支持看板数据获取
