import { useState, useEffect } from 'react'
import useAgentConfig from '../hooks/useAgentConfig'

const API_BASE = 'http://localhost:3001'

const MESSAGE_TYPES = [
  { value: 'task', label: '任务', color: '#ff9800', icon: '📋' },
  { value: 'question', label: '问题', color: '#2196f3', icon: '❓' },
  { value: 'result', label: '结果', color: '#4caf50', icon: '✅' },
  { value: 'error', label: '错误', color: '#f44336', icon: '❌' },
  { value: 'status', label: '状态', color: '#9e9e9e', icon: '📊' },
]

const AGENTS = [
  { id: 'commander', name: '总指挥', icon: '🎯', color: '#4fc3f7' },
  { id: 'worker', name: 'A号', icon: '⚡', color: '#ff9800' },
  { id: 'coder-b', name: 'B号', icon: '🔧', color: '#4caf50' },
  { id: 'coder-c', name: 'C号', icon: '🧪', color: '#9c27b0' },
]

export default function MessagePanel({ isOpen, onClose }) {
  const { agents, getAgent } = useAgentConfig()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [showSendModal, setShowSendModal] = useState(false)
  const [newMessage, setNewMessage] = useState({ to: '', type: 'task', content: '', priority: 'normal' })

  const fetchMessages = async () => {
    setLoading(true)
    try {
      const url = selectedAgent === 'all'
        ? `${API_BASE}/api/messages`
        : `${API_BASE}/api/messages/${selectedAgent}`
      const res = await fetch(url)
      setMessages(await res.json())
    } catch (err) { console.error('加载消息失败:', err) }
    setLoading(false)
  }

  useEffect(() => { if (isOpen) fetchMessages() }, [isOpen, selectedAgent])

  const handleSendMessage = async () => {
    if (!newMessage.to || !newMessage.content) return
    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'commander', ...newMessage }),
      })
      if (res.ok) {
        setShowSendModal(false)
        setNewMessage({ to: '', type: 'task', content: '', priority: 'normal' })
        fetchMessages()
      }
    } catch (err) { console.error('发送消息失败:', err) }
  }

  const handleMarkRead = async (msgId, agentId) => {
    try {
      await fetch(`${API_BASE}/api/messages/${agentId}/${msgId}/read`, { method: 'POST' })
      fetchMessages()
    } catch (err) { console.error('标记已读失败:', err) }
  }

  const getMsgType = (type) => MESSAGE_TYPES.find(t => t.value === type) || MESSAGE_TYPES[4]

  if (!isOpen) return null

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div className="glass-modal animate-slide-up" style={{ padding: 24, width: 800, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>💬 Agent 消息中心</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowSendModal(true)} className="glass-btn-primary" style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}>
              ✉️ 发送消息
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Agent筛选 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedAgent('all')}
            className={selectedAgent === 'all' ? 'glass-btn-primary' : 'glass-btn'}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer', color: selectedAgent === 'all' ? '#fff' : 'var(--text-secondary)' }}
          >全部</button>
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12,
                border: selectedAgent === agent.id ? 'none' : '1px solid var(--glass-border)',
                background: selectedAgent === agent.id ? agent.color : 'var(--glass-bg)',
                color: selectedAgent === agent.id ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'var(--transition)',
              }}
            >{agent.icon} {agent.name}</button>
          ))}
        </div>

        {/* 消息列表 */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>加载中...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13, opacity: 0.6 }}>暂无消息</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.map((msg, i) => {
                const fromAgent = getAgent(msg.from) || AGENTS[0]
                const toAgent = getAgent(msg.to) || AGENTS[0]
                const msgType = getMsgType(msg.type)
                return (
                  <div key={msg.id || i} className="glass-card" style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    border: msg.read ? '1px solid var(--glass-border)' : '1px solid rgba(108, 92, 231, 0.3)',
                    background: msg.read ? undefined : 'rgba(108, 92, 231, 0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: fromAgent.color + '15', borderRadius: 12, fontSize: 12, color: fromAgent.color }}>
                        {fromAgent.icon} {fromAgent.name}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>→</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: toAgent.color + '15', borderRadius: 12, fontSize: 12, color: toAgent.color }}>
                        {toAgent.icon} {toAgent.name}
                      </span>
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: msgType.color + '15', borderRadius: 12, fontSize: 11, color: msgType.color }}>
                        {msgType.icon} {msgType.label}
                      </span>
                      {msg.priority === 'high' && (
                        <span style={{ padding: '2px 6px', background: 'rgba(239, 83, 80, 0.15)', borderRadius: 12, fontSize: 10, color: 'var(--error)' }}>紧急</span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6 }}>{new Date(msg.timestamp * 1000).toLocaleTimeString()}</span>
                      {!msg.read && (
                        <button onClick={() => handleMarkRead(msg.id, msg.to)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: 11 }}>标记已读</button>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 统计 */}
        <div className="glass-card" style={{
          display: 'flex', gap: 16, padding: '8px 14px',
          borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <span>总计: {messages.length} 条</span>
          <span>未读: {messages.filter(m => !m.read).length} 条</span>
          <span>任务: {messages.filter(m => m.type === 'task').length} 条</span>
          <span>问题: {messages.filter(m => m.type === 'question').length} 条</span>
        </div>
      </div>

      {/* 发送消息模态框 */}
      {showSendModal && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => setShowSendModal(false)}>
          <div className="glass-modal animate-slide-up" style={{ padding: 24, width: 500 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>✉️ 发送消息</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>发送给</label>
              <select value={newMessage.to} onChange={e => setNewMessage(prev => ({ ...prev, to: e.target.value }))} className="glass-input" style={{ width: '100%', padding: '8px 12px' }}>
                <option value="">选择Agent</option>
                {AGENTS.filter(a => a.id !== 'commander').map(a => (<option key={a.id} value={a.id}>{a.icon} {a.name}</option>))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>消息类型</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {MESSAGE_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setNewMessage(prev => ({ ...prev, type: type.value }))}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12,
                      border: newMessage.type === type.value ? 'none' : '1px solid var(--glass-border)',
                      background: newMessage.type === type.value ? type.color : 'var(--glass-bg)',
                      color: newMessage.type === type.value ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer', transition: 'var(--transition)',
                    }}
                  >{type.icon} {type.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>优先级</label>
              <select value={newMessage.priority} onChange={e => setNewMessage(prev => ({ ...prev, priority: e.target.value }))} className="glass-input" style={{ width: '100%', padding: '8px 12px' }}>
                <option value="low">低</option>
                <option value="normal">中</option>
                <option value="high">高</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>消息内容</label>
              <textarea
                value={newMessage.content}
                onChange={e => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                placeholder="输入消息内容..."
                rows={4}
                className="glass-input"
                style={{ width: '100%', padding: '10px 14px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSendModal(false)} className="glass-btn" style={{ padding: '8px 16px', fontSize: 13 }}>取消</button>
              <button onClick={handleSendMessage} className="glass-btn-primary" style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}>发送</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
