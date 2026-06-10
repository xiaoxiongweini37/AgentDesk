import { useState, useEffect } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

export default function Settings({ onClose }) {
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
    // TODO: 实际切换主题
  }

  const clearLocalMessages = () => {
    if (confirm('确定清除本地消息记录？（不会影响 CLI 会话）')) {
      localStorage.removeItem('agentdesk-messages')
      alert('已清除')
    }
  }

  const StatusDot = ({ ok }) => (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: ok === null ? 'var(--text-secondary)' : ok ? '#4caf50' : '#f44336',
      marginRight: 8,
    }} />
  )

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        padding: 24,
        width: 480,
        maxHeight: '80vh',
        overflowY: 'auto',
        border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>⚙️ 设置</h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 20,
            cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* 连接状态 */}
        <Section title="连接状态">
          <Row>
            <StatusDot ok={health.proxy} />
            <span style={{ color: 'var(--text-primary)' }}>代理服务器 (localhost:3001)</span>
          </Row>
          <Row>
            <StatusDot ok={health.api} />
            <span style={{ color: 'var(--text-primary)' }}>Hermes API (localhost:8642)</span>
          </Row>
          <Row>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              当前会话: {sessionId || '未连接'}
            </span>
          </Row>
          <Row>
            <button onClick={testConnection} disabled={testing} style={btnStyle}>
              {testing ? '测试中...' : '🔗 测试连接'}
            </button>
            <button onClick={() => { checkHealth(); fetchSessionId() }} style={btnStyle}>
              🔄 刷新状态
            </button>
          </Row>
        </Section>

        {/* 模型设置 */}
        <Section title="模型设置">
          <Row>
            <label style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 4 }}>
              模型名称
            </label>
            <select value={model} onChange={handleModelChange} style={selectStyle}>
              <option value="mimo-v2.5-pro">mimo-v2.5-pro</option>
              <option value="mimo-v2-flash">mimo-v2-flash</option>
            </select>
          </Row>
        </Section>

        {/* 外观 */}
        <Section title="外观">
          <Row>
            <label style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 4 }}>
              主题
            </label>
            <select value={theme} onChange={handleThemeChange} style={selectStyle}>
              <option value="dark">深色</option>
              <option value="light">浅色</option>
            </select>
          </Row>
        </Section>

        {/* 数据管理 */}
        <Section title="数据管理">
          <Row>
            <button onClick={clearLocalMessages} style={{ ...btnStyle, background: '#f44336' }}>
              🗑️ 清除本地消息
            </button>
          </Row>
        </Section>

        {/* 关于 */}
        <Section title="关于">
          <Row>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              AgentDesk v0.1.0 — 基于 Hermes Agent 的桌面端智能体应用
            </span>
          </Row>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{
        margin: '0 0 12px',
        color: 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 600,
        borderBottom: '1px solid var(--border)',
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

const btnStyle = {
  padding: '6px 14px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 13,
}

const selectStyle = {
  padding: '6px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 13,
  width: '100%',
}
