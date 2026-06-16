/**
 * DevTools - 开发者工具页面
 *
 * 真正的核心引擎功能：
 * - 消息总线状态
 * - 共享工作区状态
 * - Agent 通信测试（真实 CLI 调用）
 */

import { useState, useEffect, useRef } from 'react'

const API_BASE = 'http://localhost:3001'

export default function DevTools({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('test')
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [testMessage, setTestMessage] = useState('你好，请介绍一下你自己')
  const [testResults, setTestResults] = useState([])
  const [testing, setTesting] = useState(false)
  const [cliTypes, setCliTypes] = useState([])
  const outputRef = useRef(null)

  // 加载 Agent 列表和 CLI 类型
  useEffect(() => {
    if (isOpen) {
      loadAgents()
      loadCliTypes()
    }
  }, [isOpen])

  const loadAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`)
      if (res.ok) {
        const data = await res.json()
        setAgents(data)
        if (data.length > 0 && !selectedAgent) {
          setSelectedAgent(data[0])
        }
      }
    } catch (err) {
      console.error('加载 Agent 失败:', err)
    }
  }

  const loadCliTypes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cli-types`)
      if (res.ok) {
        const data = await res.json()
        setCliTypes(data)
      }
    } catch (err) {
      console.error('加载 CLI 类型失败:', err)
    }
  }

  // 运行真正的 Agent 测试
  const runAgentTest = async () => {
    if (!selectedAgent || !testMessage.trim()) return

    setTesting(true)
    setTestResults([])

    const addResult = (result) => {
      setTestResults((prev) => [...prev, result])
      // 自动滚动到底部
      setTimeout(() => {
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
      }, 50)
    }

    try {
      addResult({
        type: 'info',
        timestamp: new Date().toLocaleTimeString(),
        message: `🚀 开始测试 Agent: ${selectedAgent.name} (${selectedAgent.cli_type || 'hermes'})`,
      })

      addResult({
        type: 'info',
        timestamp: new Date().toLocaleTimeString(),
        message: `📤 发送消息: "${testMessage.substring(0, 50)}${testMessage.length > 50 ? '...' : ''}"`,
      })

      // 调用真正的测试 API
      const response = await fetch(`${API_BASE}/api/test/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          message: testMessage,
          cliType: selectedAgent.cli_type || 'hermes',
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 读取 SSE 流
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              switch (data.type) {
                case 'status':
                  addResult({
                    type: 'status',
                    timestamp: new Date().toLocaleTimeString(),
                    message: `⏳ ${data.message}`,
                  })
                  break

                case 'output':
                  addResult({
                    type: 'output',
                    timestamp: new Date().toLocaleTimeString(),
                    message: data.content,
                  })
                  break

                case 'error':
                  addResult({
                    type: 'error',
                    timestamp: new Date().toLocaleTimeString(),
                    message: `❌ ${data.content || data.message}`,
                  })
                  break

                case 'complete':
                  addResult({
                    type: 'success',
                    timestamp: new Date().toLocaleTimeString(),
                    message: `✅ 测试完成 (退出码: ${data.exitCode})`,
                  })
                  if (data.output) {
                    addResult({
                      type: 'output',
                      timestamp: new Date().toLocaleTimeString(),
                      message: `\n📋 完整输出:\n${data.output}`,
                    })
                  }
                  break
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      addResult({
        type: 'error',
        timestamp: new Date().toLocaleTimeString(),
        message: `❌ 测试失败: ${error.message}`,
      })
    }

    setTesting(false)
  }

  // 获取 CLI 状态
  const getCliStatus = (cliType) => {
    const cli = cliTypes.find((c) => c.id === cliType)
    return cli?.available ? '✅ 已安装' : '❌ 未安装'
  }

  if (!isOpen) return null

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="glass-modal animate-slide-up"
        style={{
          width: 900,
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>
            🛠️ 开发者工具 - 真实测试
          </h2>
          <button
            onClick={onClose}
            className="glass-btn-ghost"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 8,
            }}
          >
            ✕
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {/* 左侧：Agent 选择 */}
          <div
            style={{
              width: 250,
              borderRight: '1px solid var(--glass-border)',
              padding: 16,
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-primary)' }}>
              🤖 选择 Agent
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  style={{
                    padding: '10px 12px',
                    background:
                      selectedAgent?.id === agent.id ? 'var(--glass-bg-hover)' : 'transparent',
                    border:
                      selectedAgent?.id === agent.id
                        ? '1px solid var(--glass-border-hover)'
                        : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    color:
                      selectedAgent?.id === agent.id ? 'var(--accent-light)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 13,
                    textAlign: 'left',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {agent.cli_type || 'hermes'} · {getCliStatus(agent.cli_type || 'hermes')}
                  </div>
                </button>
              ))}
            </div>

            {/* Agent 详情 */}
            {selectedAgent && (
              <div
                className="glass-card"
                style={{ marginTop: 16, padding: 12, fontSize: 12 }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Agent 详情</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  <div>ID: {selectedAgent.id}</div>
                  <div>类型: {selectedAgent.cli_type || 'hermes'}</div>
                  <div>角色: {selectedAgent.role || '未设置'}</div>
                  <div>
                    API Key: {selectedAgent.api_key ? '***已配置***' : '未配置'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：测试区域 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 输入区域 */}
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid var(--glass-border)',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-primary)' }}>
                💬 测试消息
              </h3>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="输入要发送给 Agent 的消息..."
                  className="glass-input"
                  style={{ flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !testing) {
                      runAgentTest()
                    }
                  }}
                />
                <button
                  onClick={runAgentTest}
                  disabled={testing || !selectedAgent}
                  className="glass-btn-primary"
                  style={{
                    padding: '8px 20px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: testing ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    opacity: testing ? 0.7 : 1,
                  }}
                >
                  {testing ? '⏳ 执行中...' : '🚀 发送测试'}
                </button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                💡 这会真正启动 {selectedAgent?.cli_type || 'hermes'} CLI 进程并发送消息
              </div>
            </div>

            {/* 输出区域 */}
            <div
              ref={outputRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 12,
                lineHeight: 1.8,
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              {testResults.length === 0 ? (
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                    padding: 40,
                  }}
                >
                  选择 Agent 并点击"发送测试"开始
                  <br />
                  <br />
                  ⚠️ 这将真正启动 CLI 进程
                </div>
              ) : (
                testResults.map((result, i) => (
                  <div
                    key={i}
                    style={{
                      color:
                        result.type === 'error'
                          ? 'var(--error)'
                          : result.type === 'success'
                          ? 'var(--success)'
                          : result.type === 'output'
                          ? 'var(--text-primary)'
                          : 'var(--accent-light)',
                      marginBottom: 4,
                      wordBreak: 'break-word',
                    }}
                  >
                    <span style={{ opacity: 0.5, marginRight: 8 }}>[{result.timestamp}]</span>
                    {result.type === 'output' ? (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', display: 'inline' }}>
                        {result.message}
                      </pre>
                    ) : (
                      result.message
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
