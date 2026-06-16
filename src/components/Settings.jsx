import { useState, useEffect } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

export default function Settings({ onClose }) {
  const [activeTab, setActiveTab] = useState('general')
  const [health, setHealth] = useState({ proxy: null, api: null })
  const [sessionId, setSessionId] = useState(null)
  const [model, setModel] = useState(localStorage.getItem('agentdesk-model') || 'mimo-v2.5-pro')
  const [theme, setTheme] = useState(localStorage.getItem('agentdesk-theme') || 'dark')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    checkHealth()
    fetchSessionId()
  }, [])

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`)
      setHealth(prev => ({ ...prev, proxy: res.ok }))
    } catch {
      setHealth(prev => ({ ...prev, proxy: false }))
    }
    try {
      const res = await fetch(`${API_BASE}/v1/models`, {
        headers: { 'Authorization': 'Bearer hermes-secret-key-2026' }
      })
      setHealth(prev => ({ ...prev, api: res.ok }))
    } catch {
      setHealth(prev => ({ ...prev, api: false }))
    }
  }

  const fetchSessionId = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/session-id`)
      const data = await res.json()
      setSessionId(data.session_id)
    } catch {
      setSessionId(null)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const res = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer hermes-secret-key-2026',
        },
        body: JSON.stringify({
          model: 'mimo-v2.5-pro',
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
        }),
      })
      const data = await res.json()
      if (data.choices?.[0]?.message?.content) {
        alert('✅ 连接正常！\n回复: ' + data.choices[0].message.content.substring(0, 100))
      }
    } catch (err) {
      alert('❌ 连接失败: ' + err.message)
    }
    setTesting(false)
  }

  const handleModelChange = (e) => {
    setModel(e.target.value)
    localStorage.setItem('agentdesk-model', e.target.value)
  }

  const handleThemeChange = (e) => {
    setTheme(e.target.value)
    localStorage.setItem('agentdesk-theme', e.target.value)
    document.documentElement.setAttribute('data-theme', e.target.value)
  }

  const clearLocalMessages = () => {
    if (confirm('确定清除本地消息记录？（不会影响 CLI 会话）')) {
      localStorage.removeItem('agentdesk-messages')
      alert('已清除')
    }
  }

  const tabs = [
    { id: 'general', label: '通用', icon: '⚙️' },
    { id: 'agents', label: 'Agent配置', icon: '🤖' },
    { id: 'about', label: '关于', icon: 'ℹ️' },
  ]

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
          width: 600,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid var(--glass-border)',
        }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>⚙️ 设置</h2>
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
              transition: 'var(--transition)',
            }}
          >✕</button>
        </div>

        {/* 标签页 */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--glass-border)',
          padding: '0 24px',
          gap: 4,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                background: activeTab === tab.id ? 'var(--glass-bg-hover)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: 'var(--transition)',
                borderRadius: '8px 8px 0 0',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {activeTab === 'general' && (
            <GeneralSettings
              health={health}
              sessionId={sessionId}
              model={model}
              theme={theme}
              testing={testing}
              onTestConnection={testConnection}
              onRefresh={() => { checkHealth(); fetchSessionId() }}
              onModelChange={handleModelChange}
              onThemeChange={handleThemeChange}
              onClearMessages={clearLocalMessages}
            />
          )}
          {activeTab === 'agents' && <AgentSettings />}
          {activeTab === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings({ health, sessionId, model, theme, testing, onTestConnection, onRefresh, onModelChange, onThemeChange, onClearMessages }) {
  return (
    <div>
      <Section title="连接状态">
        <Row>
          <StatusDot ok={health.proxy} />
          <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>代理服务器 (localhost:3001)</span>
        </Row>
        <Row>
          <StatusDot ok={health.api} />
          <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>Hermes API (localhost:8642)</span>
        </Row>
        <Row>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, opacity: 0.7 }}>
            当前会话: {sessionId || '未连接'}
          </span>
        </Row>
        <Row>
          <button onClick={onTestConnection} disabled={testing} className="glass-btn" style={{ padding: '6px 14px', fontSize: 13 }}>
            {testing ? '测试中...' : '🔗 测试连接'}
          </button>
          <button onClick={onRefresh} className="glass-btn" style={{ padding: '6px 14px', fontSize: 13 }}>
            🔄 刷新状态
          </button>
        </Row>
      </Section>

      <Section title="模型设置">
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 6 }}>模型名称</label>
          <select value={model} onChange={onModelChange} className="glass-input" style={{ width: '100%', padding: '8px 12px', fontSize: 13 }}>
            <option value="mimo-v2.5-pro">mimo-v2.5-pro</option>
            <option value="mimo-v2-flash">mimo-v2-flash</option>
          </select>
        </div>
      </Section>

      <Section title="外观">
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 6 }}>主题</label>
          <select value={theme} onChange={onThemeChange} className="glass-input" style={{ width: '100%', padding: '8px 12px', fontSize: 13 }}>
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </div>
      </Section>

      <Section title="数据管理">
        <button
          onClick={onClearMessages}
          style={{
            padding: '6px 14px',
            border: '1px solid rgba(239, 83, 80, 0.3)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(239, 83, 80, 0.1)',
            color: 'var(--error)',
            cursor: 'pointer',
            fontSize: 13,
            transition: 'var(--transition)',
          }}
        >
          🗑️ 清除本地消息
        </button>
      </Section>
    </div>
  )
}

function AgentSettings() {
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [agentStatus, setAgentStatus] = useState({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [agentLogs, setAgentLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)

  useEffect(() => { fetchAgents() }, [])

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`)
      if (res.ok) {
        const data = await res.json()
        setAgents(data)
        if (data.length > 0 && !selectedAgent) selectAgent(data[0])
        // 获取所有 agent 状态
        fetchAllStatus(data)
      }
    } catch (err) {
      console.error('Failed to load agents:', err)
    }
    setLoading(false)
  }

  const fetchAllStatus = async (agentList) => {
    const statuses = {}
    for (const agent of agentList || agents) {
      try {
        const res = await fetch(`${API_BASE}/api/agents/${agent.id}/status`)
        if (res.ok) {
          statuses[agent.id] = await res.json()
        }
      } catch (err) {
        statuses[agent.id] = { status: 'unknown' }
      }
    }
    setAgentStatus(statuses)
  }

  const selectAgent = (agent) => {
    setSelectedAgent(agent)
    setEditForm({
      name: agent.name || '',
      role: agent.role || '',
      tmux: agent.tmux || '',
      profile: agent.profile || '',
      capabilities: (agent.capabilities || []).join(', '),
      api_key: agent.api_key || '',
      base_url: agent.base_url || '',
      model: agent.model || '',
    })
    setTestResult(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...editForm,
        capabilities: editForm.capabilities.split(',').map(c => c.trim()).filter(Boolean),
      }
      const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        alert('✅ 保存成功！')
        fetchAgents()
      } else {
        alert('❌ 保存失败')
      }
    } catch (err) {
      alert('❌ 保存失败: ' + err.message)
    }
    setSaving(false)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.id}/test`, {
        method: 'POST',
      })
      const result = await res.json()
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, message: err.message })
    }
    setTesting(false)
  }

  const handleStartAgent = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.id}/start`, {
        method: 'POST',
      })
      const result = await res.json()
      if (result.error) {
        alert(`❌ 启动失败: ${result.error}`)
      } else {
        alert(`✅ Agent 已启动！会话 ID: ${result.session_id}`)
        fetchAllStatus()
      }
    } catch (err) {
      alert(`❌ 启动失败: ${err.message}`)
    }
  }

  const handleStopAgent = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.id}/stop`, {
        method: 'POST',
      })
      const result = await res.json()
      alert(`⏹️ Agent ${result.status === 'stopped' ? '已停止' : '未在运行'}`)
      fetchAllStatus()
    } catch (err) {
      alert(`❌ 停止失败: ${err.message}`)
    }
  }

  const handleLoadLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.id}/logs`)
      if (res.ok) {
        const data = await res.json()
        setAgentLogs(data.logs || [])
        setShowLogs(true)
      }
    } catch (err) {
      console.error('加载日志失败:', err)
    }
  }

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20, fontSize: 13 }}>加载中...</div>
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>选择Agent</div>
        {agents.map(agent => {
          const status = agentStatus[agent.id]
          const isOnline = status?.status === 'online'

          return (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent)}
              style={{
                padding: '8px 12px',
                background: selectedAgent?.id === agent.id ? 'var(--glass-bg-hover)' : 'transparent',
                border: selectedAgent?.id === agent.id ? '1px solid var(--glass-border-hover)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                color: selectedAgent?.id === agent.id ? 'var(--accent-light)' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 13,
                textAlign: 'left',
                transition: 'var(--transition)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isOnline ? 'var(--success)' : 'var(--text-secondary)',
                boxShadow: isOnline ? '0 0 6px var(--success)' : 'none',
                flexShrink: 0,
              }} />
              {agent.name || agent.id}
            </button>
          )
        })}
      </div>

      {selectedAgent && (
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              编辑 {selectedAgent.name} ({selectedAgent.id})
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleStartAgent}
                className="glass-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: '1px solid var(--success)',
                  color: 'var(--success)',
                }}
              >
                ▶️ 启动
              </button>
              <button
                onClick={handleStopAgent}
                className="glass-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: '1px solid var(--error)',
                  color: 'var(--error)',
                }}
              >
                ⏹️ 停止
              </button>
              <button
                onClick={handleLoadLogs}
                className="glass-btn"
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                📋 日志
              </button>
            </div>
          </div>

          {/* 状态显示 */}
          <div className="glass-card" style={{ padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: agentStatus[selectedAgent.id]?.status === 'online' ? 'var(--success)' : 'var(--text-secondary)',
                boxShadow: agentStatus[selectedAgent.id]?.status === 'online' ? '0 0 8px var(--success)' : 'none',
              }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                {agentStatus[selectedAgent.id]?.status === 'online' ? '🟢 在线' : '🔴 离线'}
              </span>
              {agentStatus[selectedAgent.id]?.source && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 8px', background: 'var(--glass-bg)', borderRadius: 10 }}>
                  来源: {agentStatus[selectedAgent.id].source === 'tmux' ? 'tmux 会话' : agentStatus[selectedAgent.id].source === 'session' ? '活跃会话' : '未检测到'}
                </span>
              )}
              {agentStatus[selectedAgent.id]?.uptime != null && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {agentStatus[selectedAgent.id].source === 'session'
                    ? `${Math.floor(agentStatus[selectedAgent.id].uptime / 60)} 分钟前活跃`
                    : `运行 ${Math.floor(agentStatus[selectedAgent.id].uptime / 60)} 分钟`}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              💡 状态说明：在线 = 有活跃的 tmux 会话或最近5分钟内有对话活动
            </div>
          </div>

          {/* 测试连接 */}
          <div className="glass-card" style={{ padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="glass-btn"
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                {testing ? '测试中...' : '🔗 测试连接'}
              </button>
              {testResult && (
                <span style={{
                  fontSize: 13,
                  color: testResult.success ? 'var(--success)' : 'var(--error)',
                }}>
                  {testResult.success ? `✅ ${testResult.message}` : `❌ ${testResult.message}`}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              💡 测试连接验证 API Key 和 Base URL 是否有效，能否成功连接到 API 服务
            </div>
          </div>

          <FormField label="显示名称">
            <input value={editForm.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="glass-input" style={{ width: '100%' }} />
          </FormField>
          <FormField label="角色描述">
            <input value={editForm.role} onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))} className="glass-input" style={{ width: '100%' }} />
          </FormField>
          <FormField label="Tmux Session">
            <input value={editForm.tmux} onChange={e => setEditForm(prev => ({ ...prev, tmux: e.target.value }))} className="glass-input" style={{ width: '100%' }} placeholder="留空表示主Hermes" />
          </FormField>
          <FormField label="Profile">
            <input value={editForm.profile} onChange={e => setEditForm(prev => ({ ...prev, profile: e.target.value }))} className="glass-input" style={{ width: '100%' }} placeholder="留空表示无独立profile" />
          </FormField>
          <FormField label="能力列表">
            <input value={editForm.capabilities} onChange={e => setEditForm(prev => ({ ...prev, capabilities: e.target.value }))} className="glass-input" style={{ width: '100%' }} placeholder="用逗号分隔，如: coding, ocr_recognition" />
          </FormField>
          <FormField label="API Key">
            <div style={{ display: 'flex', gap: 8 }}>
              <input type={showKey ? 'text' : 'password'} value={editForm.api_key} onChange={e => setEditForm(prev => ({ ...prev, api_key: e.target.value }))} className="glass-input" style={{ flex: 1 }} placeholder="留空表示使用config.yaml中的配置" />
              <button onClick={() => setShowKey(!showKey)} className="glass-btn" style={{ padding: '8px', fontSize: 12 }}>{showKey ? '🙈' : '👁️'}</button>
            </div>
          </FormField>
          <FormField label="Base URL">
            <input value={editForm.base_url} onChange={e => setEditForm(prev => ({ ...prev, base_url: e.target.value }))} className="glass-input" style={{ width: '100%' }} placeholder="如: https://token-plan-cn.xiaomimimo.com/v1" />
          </FormField>
          <FormField label="模型名称">
            <input value={editForm.model} onChange={e => setEditForm(prev => ({ ...prev, model: e.target.value }))} className="glass-input" style={{ width: '100%' }} placeholder="如: mimo-v2.5-pro" />
          </FormField>

          <div style={{ marginTop: 16 }}>
            <button onClick={handleSave} disabled={saving} className="glass-btn-primary" style={{ padding: '8px 20px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {saving ? '保存中...' : '💾 保存配置'}
            </button>
          </div>

          {/* 日志面板 */}
          {showLogs && (
            <div className="glass-card" style={{ marginTop: 16, padding: '12px 14px', maxHeight: 300, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>📋 运行日志</span>
                <button onClick={() => setShowLogs(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>✕ 关闭</button>
              </div>
              {agentLogs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 12 }}>暂无日志</div>
              ) : (
                agentLogs.map((session, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      会话: {session.session_id?.slice(-8) || '未知'}
                    </div>
                    {session.messages?.map((msg, j) => (
                      <div key={j} style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        marginBottom: 2,
                        borderRadius: 4,
                        background: msg.role === 'user' ? 'var(--accent-glow)' : 'var(--glass-bg)',
                        color: 'var(--text-primary)',
                      }}>
                        <span style={{ fontWeight: 600 }}>{msg.role === 'user' ? '👤' : '🤖'}</span>{' '}
                        {msg.content}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AboutSection() {
  return (
    <div>
      <Section title="AgentDesk">
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
          <p>版本: v0.1.0</p>
          <p>基于 Hermes Agent 的桌面端智能体应用</p>
          <p>支持多Agent协同工作、任务分配、消息队列、实时状态同步</p>
        </div>
      </Section>
      <Section title="技术栈">
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
          <p>前端: React + Vite + Tauri</p>
          <p>后端: Node.js (proxy.cjs)</p>
          <p>Agent: Hermes Agent CLI</p>
          <p>通信: REST API + WebSocket</p>
        </div>
      </Section>
      <Section title="相关链接">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a href="https://hermes-agent.nousresearch.com/docs" target="_blank" style={{ color: 'var(--accent-light)', fontSize: 13, textDecoration: 'none' }}>
            📚 Hermes Agent 文档
          </a>
        </div>
      </Section>
    </div>
  )
}

/* ===== 通用子组件 ===== */

function Section({ title, children }) {
  return (
    <div className="glass-card" style={{ marginBottom: 16, padding: '16px 18px' }}>
      <h3 style={{
        margin: '0 0 12px',
        color: 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 600,
        borderBottom: '1px solid var(--glass-border)',
        paddingBottom: 8,
      }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {children}
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function StatusDot({ ok }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: ok === null ? 'var(--text-secondary)' : ok ? 'var(--success)' : 'var(--error)',
      marginRight: 8,
      boxShadow: ok === true ? '0 0 8px var(--success)' : ok === false ? '0 0 8px var(--error)' : 'none',
      transition: 'var(--transition)',
    }} />
  )
}
