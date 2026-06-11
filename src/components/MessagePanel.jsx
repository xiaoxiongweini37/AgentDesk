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

export default function MessagePanel({ isOpen, onClose }) {
  const { agents, getAgent } = useAgentConfig()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [showSendModal, setShowSendModal] = useState(false)
  const [newMessage, setNewMessage] = useState({
    to: '',
    type: 'task',
    content: '',
    priority: 'normal',
  })

  // 加载消息
  const fetchMessages = async () => {
    setLoading(true)
    try {
      const url = selectedAgent === 'all' 
        ? `${API_BASE}/api/messages`
        : `${API_BASE}/api/messages/${selectedAgent}`
      const res = await fetch(url)
      const data = await res.json()
      setMessages(data)
    } catch (err) {
      console.error('加载消息失败:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) fetchMessages()
  }, [isOpen, selectedAgent])

  // 发送消息
  const handleSendMessage = async () => {
    if (!newMessage.to || !newMessage.content) return
    
    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'commander',
          ...newMessage,
        }),
      })
      
      if (res.ok) {
        setShowSendModal(false)
        setNewMessage({ to: '', type: 'task', content: '', priority: 'normal' })
        fetchMessages()
      }
    } catch (err) {
      console.error('发送消息失败:', err)
    }
  }

  // 标记已读
  const handleMarkRead = async (msgId, agentId) => {
    try {
      await fetch(`${API_BASE}/api/messages/${agentId}/${msgId}/read`, {
        method: 'POST',
      })
      fetchMessages()
    } catch (err) {
      console.error('标记已读失败:', err)
    }
  }

  // 获取消息类型信息
  const getMsgType = (type) => MESSAGE_TYPES.find(t => t.value === type) || MESSAGE_TYPES[4]

  if (!isOpen) return null

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
        width: 800,
        maxHeight: '80vh',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>💬 Agent 消息中心</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowSendModal(true)} style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: 'var(--bg-primary)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}>
              ✉️ 发送消息
            </button>
            <button onClick={onClose} style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 20,
              cursor: 'pointer',
            }}>✕</button>
          </div>
        </div>

        {/* Agent筛选 */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setSelectedAgent('all')}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: selectedAgent === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: selectedAgent === 'all' ? 'var(--bg-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            全部
          </button>
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: selectedAgent === agent.id ? agent.color : 'var(--bg-secondary)',
                color: selectedAgent === agent.id ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {agent.icon} {agent.name}
            </button>
          ))}
        </div>

        {/* 消息列表 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: 16,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>
              加载中...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>
              暂无消息
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map((msg, i) => {
                const fromAgent = getAgent(msg.from)
                const toAgent = getAgent(msg.to)
                const msgType = getMsgType(msg.type)
                
                return (
                  <div key={msg.id || i} style={{
                    padding: '12px 16px',
                    background: msg.read ? 'var(--bg-secondary)' : 'rgba(79,195,247,0.08)',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${msg.read ? 'var(--border)' : 'rgba(79,195,247,0.3)'}`,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}>
                      {/* 发送者 */}
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        background: fromAgent.color + '20',
                        borderRadius: 4,
                        fontSize: 12,
                        color: fromAgent.color,
                      }}>
                        {fromAgent.icon} {fromAgent.name}
                      </span>
                      
                      {/* 箭头 */}
                      <span style={{ color: 'var(--text-secondary)' }}>→</span>
                      
                      {/* 接收者 */}
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        background: toAgent.color + '20',
                        borderRadius: 4,
                        fontSize: 12,
                        color: toAgent.color,
                      }}>
                        {toAgent.icon} {toAgent.name}
                      </span>
                      
                      {/* 消息类型 */}
                      <span style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        background: msgType.color + '20',
                        borderRadius: 4,
                        fontSize: 11,
                        color: msgType.color,
                      }}>
                        {msgType.icon} {msgType.label}
                      </span>
                      
                      {/* 优先级 */}
                      {msg.priority === 'high' && (
                        <span style={{
                          padding: '2px 6px',
                          background: '#f4433620',
                          borderRadius: 4,
                          fontSize: 10,
                          color: '#f44336',
                        }}>
                          紧急
                        </span>
                      )}
                      
                      {/* 时间 */}
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                      </span>
                      
                      {/* 标记已读 */}
                      {!msg.read && (
                        <button
                          onClick={() => handleMarkRead(msg.id, msg.to)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          标记已读
                        </button>
                      )}
                    </div>
                    
                    {/* 消息内容 */}
                    <div style={{
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 统计 */}
        <div style={{
          display: 'flex',
          gap: 16,
          padding: '8px 12px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          <span>总计: {messages.length} 条</span>
          <span>未读: {messages.filter(m => !m.read).length} 条</span>
          <span>任务: {messages.filter(m => m.type === 'task').length} 条</span>
          <span>问题: {messages.filter(m => m.type === 'question').length} 条</span>
        </div>
      </div>

      {/* 发送消息模态框 */}
      {showSendModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
        }} onClick={() => setShowSendModal(false)}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            padding: 24,
            width: 500,
            border: '1px solid var(--border)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>✉️ 发送消息</h3>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                发送给
              </label>
              <select
                value={newMessage.to}
                onChange={e => setNewMessage(prev => ({ ...prev, to: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">选择Agent</option>
                {AGENTS.filter(a => a.id !== 'commander').map(a => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                消息类型
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {MESSAGE_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setNewMessage(prev => ({ ...prev, type: type.value }))}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      background: newMessage.type === type.value ? type.color : 'var(--bg-secondary)',
                      color: newMessage.type === type.value ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                优先级
              </label>
              <select
                value={newMessage.priority}
                onChange={e => setNewMessage(prev => ({ ...prev, priority: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="low">低</option>
                <option value="normal">中</option>
                <option value="high">高</option>
              </select>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                消息内容
              </label>
              <textarea
                value={newMessage.content}
                onChange={e => setNewMessage(prev => ({ ...prev, content: e.target.value }))}
                placeholder="输入消息内容..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSendModal(false)} style={{
                padding: '8px 16px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
                取消
              </button>
              <button onClick={handleSendMessage} style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 'var(--radius)',
                background: 'var(--accent)',
                color: 'var(--bg-primary)',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}>
                发送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
