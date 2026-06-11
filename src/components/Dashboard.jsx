import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

// 颜色配置
function getColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  if (isLight) {
    return {
      user: { color: '#0277bd', bg: 'rgba(2,119,189,0.1)', border: '#0277bd', icon: '👤' },
      assistant: { color: '#2e7d32', bg: 'rgba(46,125,50,0.1)', border: '#2e7d32', icon: '🤖' },
      tool: { color: '#e65100', bg: 'rgba(230,81,0,0.08)', border: '#e65100', icon: '🔧' },
      task: { color: '#7b1fa2', bg: 'rgba(123,31,162,0.1)', border: '#7b1fa2', icon: '📋' },
      message: { color: '#00838f', bg: 'rgba(0,131,143,0.1)', border: '#00838f', icon: '💬' },
    }
  }
  return {
    user: { color: '#4fc3f7', bg: 'rgba(79,195,247,0.08)', border: '#4fc3f7', icon: '👤' },
    assistant: { color: '#a5d6a7', bg: 'rgba(165,214,167,0.08)', border: '#a5d6a7', icon: '🤖' },
    tool: { color: '#ffcc80', bg: 'rgba(255,204,128,0.08)', border: '#ffcc80', icon: '🔧' },
    task: { color: '#ce93d8', bg: 'rgba(206,147,216,0.08)', border: '#ce93d8', icon: '📋' },
    message: { color: '#80deea', bg: 'rgba(128,222,234,0.08)', border: '#80deea', icon: '💬' },
  }
}

// 渲染单条消息
function MessageItem({ msg }) {
  const COLORS = getColors()
  const style = COLORS[msg.role] || COLORS.assistant
  const content = msg.content || ''
  
  // 截断过长的 tool 消息
  const displayContent = msg.role === 'tool' && content.length > 300 
    ? content.substring(0, 300) + '...' 
    : content
  
  if (!displayContent.trim()) return null
  
  return (
    <div style={{
      padding: '8px 12px',
      marginBottom: 6,
      background: style.bg,
      borderLeft: `3px solid ${style.border}`,
      borderRadius: '0 6px 6px 0',
    }}>
      <div style={{ 
        fontSize: 10, 
        color: style.color, 
        opacity: 0.8,
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span>{style.icon}</span>
        <span>{msg.role === 'user' ? '用户' : msg.role === 'assistant' ? 'Agent' : '工具'}</span>
        {msg.timestamp && (
          <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
            {new Date(msg.timestamp * 1000).toLocaleTimeString()}
          </span>
        )}
      </div>
      <div style={{ 
        color: style.color, 
        fontSize: 12,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        lineHeight: 1.6,
      }}>
        {displayContent}
      </div>
    </div>
  )
}

// 渲染任务项
function TaskItem({ task }) {
  const COLORS = getColors()
  const style = COLORS.task
  
  const statusColors = {
    pending: '#ff9800',
    assigned: '#2196f3',
    in_progress: '#4caf50',
    completed: '#8bc34a',
    failed: '#f44336',
  }
  
  return (
    <div style={{
      padding: '8px 12px',
      marginBottom: 6,
      background: style.bg,
      borderLeft: `3px solid ${statusColors[task.status] || style.border}`,
      borderRadius: '0 6px 6px 0',
    }}>
      <div style={{ 
        fontSize: 10, 
        color: style.color, 
        opacity: 0.8,
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span>{style.icon}</span>
        <span style={{ fontWeight: 'bold' }}>{task.title}</span>
        <span style={{ 
          marginLeft: 'auto', 
          fontSize: 9,
          padding: '1px 4px',
          background: statusColors[task.status] || '#666',
          borderRadius: 3,
          color: '#fff',
        }}>
          {task.status}
        </span>
      </div>
      <div style={{ 
        color: style.color, 
        fontSize: 11,
        opacity: 0.7,
      }}>
        {task.description?.substring(0, 80)}...
      </div>
    </div>
  )
}

// 渲染消息项
function AgentMessageItem({ msg }) {
  const COLORS = getColors()
  const style = COLORS.message
  
  return (
    <div style={{
      padding: '8px 12px',
      marginBottom: 6,
      background: style.bg,
      borderLeft: `3px solid ${style.border}`,
      borderRadius: '0 6px 6px 0',
    }}>
      <div style={{ 
        fontSize: 10, 
        color: style.color, 
        opacity: 0.8,
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span>{style.icon}</span>
        <span>{msg.from} → {msg.to}</span>
        <span style={{ 
          marginLeft: 'auto', 
          fontSize: 9,
          padding: '1px 4px',
          background: msg.type === 'task' ? '#ff9800' : msg.type === 'error' ? '#f44336' : '#4caf50',
          borderRadius: 3,
          color: '#fff',
        }}>
          {msg.type}
        </span>
      </div>
      <div style={{ 
        color: style.color, 
        fontSize: 11,
      }}>
        {msg.content?.substring(0, 100)}
      </div>
    </div>
  )
}

// 渲染 tmux 纯文本输出（备用，用于非 Hermes agent）
function TmuxOutput({ output }) {
  const COLORS = getColors()
  return (
    <div style={{ 
      padding: '8px 12px',
      fontSize: 12,
      color: 'var(--text-secondary)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      lineHeight: 1.5,
    }}>
      {output || '无输出'}
    </div>
  )
}

export default function Dashboard() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'normal' })
  const outputRefs = useRef({})
  const userScrolledRef = useRef({})

  const handleScroll = (agentId) => {
    const el = outputRefs.current[agentId]
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
    userScrolledRef.current[agentId] = !atBottom
  }

  // 获取实时状态
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/agents/status`)
      if (response.ok) {
        const statusData = await response.json()
        setAgents(prev => prev.map(agent => ({
          ...agent,
          realTimeStatus: statusData[agent.id] || null,
        })))
      }
    } catch (err) {
      // 静默失败
    }
  }

  const fetchDashboard = async (append = false) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard`)
      if (!response.ok) throw new Error('Failed to fetch dashboard')
      const data = await response.json()
      setLastUpdate(new Date())
      setError(null)

      if (append) {
        setAgents(prev => {
          return data.map(newAgent => {
            const oldAgent = prev.find(a => a.id === newAgent.id)
            if (!oldAgent) return { ...newAgent, history: [] }
            
            // 对于有结构化消息的 agent（总指挥）
            if (newAgent.messages && newAgent.messages.length > 0) {
              const oldHistory = oldAgent.history || []
              const newMessages = newAgent.messages
              
              // 合并：保留旧历史，追加新消息
              // 简单方案：如果新消息数量 > 旧消息数量，追加差额
              if (newMessages.length > (oldAgent._msgCount || 0)) {
                return {
                  ...newAgent,
                  history: [...oldHistory, { 
                    messages: newMessages.slice(oldAgent._msgCount || 0),
                    time: new Date().toLocaleTimeString() 
                  }],
                  _msgCount: newMessages.length,
                }
              }
              return { ...oldAgent, ...newAgent, _msgCount: newMessages.length }
            }
            
            // 对于 tmux 输出的 agent
            const lastOutput = oldAgent.history?.[oldAgent.history.length - 1]?.output
            if (newAgent.output && newAgent.output !== lastOutput) {
              return {
                ...newAgent,
                history: [...(oldAgent.history || []), { output: newAgent.output, time: new Date().toLocaleTimeString() }],
              }
            }
            return { ...oldAgent, ...newAgent }
          })
        })
      } else {
        // 首次加载
        setAgents(data.map(agent => {
          if (agent.messages && agent.messages.length > 0) {
            return {
              ...agent,
              history: [{ messages: agent.messages, time: new Date().toLocaleTimeString() }],
              _msgCount: agent.messages.length,
            }
          }
          return {
            ...agent,
            history: agent.output ? [{ output: agent.output, time: new Date().toLocaleTimeString() }] : [],
          }
        }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard(false)
    // 定时刷新状态
    const statusInterval = setInterval(fetchStatus, 5000) // 每5秒刷新
    return () => clearInterval(statusInterval)
  }, [])

  useEffect(() => {
    agents.forEach(agent => {
      if (!userScrolledRef.current[agent.id]) {
        const ref = outputRefs.current[agent.id]
        if (ref) ref.scrollTop = ref.scrollHeight
      }
    })
  }, [agents])

  const handleRefresh = () => fetchDashboard(true)
  const handleClear = (agentId) => {
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, history: [], _msgCount: 0 } : a))
    userScrolledRef.current[agentId] = false
  }

  const handleCardMouseEnter = (e) => {
    gsap.to(e.currentTarget, { y: -4, boxShadow: '0 8px 16px rgba(0,0,0,0.3)', duration: 0.2, ease: 'power2.out' })
  }
  const handleCardMouseLeave = (e) => {
    gsap.to(e.currentTarget, { y: 0, boxShadow: 'none', duration: 0.2, ease: 'power2.out' })
  }

  // 创建任务
  const handleCreateTask = async () => {
    if (!newTask.title || !selectedAgent) return
    
    try {
      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          assigned_to: selectedAgent,
        }),
      })
      
      if (response.ok) {
        setShowTaskModal(false)
        setNewTask({ title: '', description: '', priority: 'normal' })
        fetchDashboard(false)
      }
    } catch (err) {
      console.error('创建任务失败:', err)
    }
  }

  // 发送消息
  const handleSendMessage = async (toAgent, content) => {
    try {
      const response = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'commander',
          to: toAgent,
          type: 'task',
          content,
        }),
      })
      
      if (response.ok) {
        fetchDashboard(false)
      }
    } catch (err) {
      console.error('发送消息失败:', err)
    }
  }

  const onlineAgents = agents.filter(a => a.online)
  const offlineAgents = agents.filter(a => !a.online)

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        🔄 加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--error)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 18, marginBottom: 8 }}>错误</div>
        <div style={{ fontSize: 14 }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>🤖 AI 团队看板</h2>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 'var(--radius)' }}>
            {onlineAgents.length} 在线 / {agents.length} 总计
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setSelectedAgent(null); setShowTaskModal(true) }} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg-primary)', cursor: 'pointer', fontWeight: 'bold' }}>
            📋 新建任务
          </button>
          <button onClick={handleRefresh} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg-primary)', cursor: 'pointer', fontWeight: 'bold' }}>
            🔄 刷新
          </button>
          {lastUpdate && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>更新于 {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', flexShrink: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: '#4fc3f7' }} />
          <span style={{ color: 'var(--text-secondary)' }}>用户输入</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: '#a5d6a7' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Agent 输出</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: '#ffcc80' }} />
          <span style={{ color: 'var(--text-secondary)' }}>工具调用</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: '#ce93d8' }} />
          <span style={{ color: 'var(--text-secondary)' }}>任务</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: '#80deea' }} />
          <span style={{ color: 'var(--text-secondary)' }}>消息</span>
        </span>
      </div>

      {onlineAgents.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${onlineAgents.length}, 1fr)`, gap: 16, flex: 1, minHeight: 0 }}>
          {onlineAgents.map(agent => (
            <div key={agent.id} onMouseEnter={handleCardMouseEnter} onMouseLeave={handleCardMouseLeave}
              style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', cursor: 'default', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
                <span style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--text-primary)' }}>{agent.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>{agent.role}</span>
                <button onClick={() => { setSelectedAgent(agent.id); setShowTaskModal(true) }} title="分配任务" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>📋</button>
                <button onClick={() => handleClear(agent.id)} title="清除历史" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>🗑️</button>
              </div>
              
              {/* 任务统计 */}
              {agent.agentTasks && agent.agentTasks.length > 0 && (
                <div style={{ padding: '6px 16px', background: 'rgba(206,147,216,0.1)', fontSize: 11, color: '#ce93d8', flexShrink: 0 }}>
                  📋 {agent.agentTasks.filter(t => t.status === 'in_progress').length} 进行中 / {agent.agentTasks.length} 总计
                </div>
              )}
              
              {/* 消息统计 */}
              {agent.agentMessages && agent.agentMessages.length > 0 && (
                <div style={{ padding: '6px 16px', background: 'rgba(128,222,234,0.1)', fontSize: 11, color: '#80deea', flexShrink: 0 }}>
                  💬 {agent.agentMessages.filter(m => !m.read).length} 未读 / {agent.agentMessages.length} 总计
                </div>
              )}
              
              <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', fontSize: 14, color: 'var(--accent)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📋 {agent.task}</span>
                {agent.realTimeStatus && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    padding: '2px 8px',
                    background: agent.realTimeStatus.activity === 'working' ? 'rgba(76,175,80,0.2)' :
                               agent.realTimeStatus.activity === 'thinking' ? 'rgba(255,152,0,0.2)' :
                               agent.realTimeStatus.activity === 'error' ? 'rgba(244,67,54,0.2)' :
                               'rgba(158,158,158,0.2)',
                    color: agent.realTimeStatus.activity === 'working' ? '#4caf50' :
                           agent.realTimeStatus.activity === 'thinking' ? '#ff9800' :
                           agent.realTimeStatus.activity === 'error' ? '#f44336' :
                           '#9e9e9e',
                    borderRadius: 4,
                  }}>
                    {agent.realTimeStatus.detail || agent.realTimeStatus.activity || ''}
                  </span>
                )}
              </div>
              <div ref={el => outputRefs.current[agent.id] = el} onScroll={() => handleScroll(agent.id)}
                style={{ padding: '12px 16px', fontSize: 12, lineHeight: 1.5, overflowY: 'auto', background: 'var(--bg-primary)', flex: 1 }}>
                {(agent.history || []).length > 0 ? (
                  agent.history.map((entry, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.5, marginBottom: 8 }}>
                        ── {entry.time} ──
                      </div>
                      {entry.messages ? (
                        // 结构化消息（从会话文件读取）
                        entry.messages.map((msg, j) => (
                          <MessageItem key={j} msg={msg} />
                        ))
                      ) : (
                        // tmux 纯文本输出（备用）
                        <TmuxOutput output={entry.output} />
                      )}
                    </div>
                  ))
                ) : (
                  <span style={{ opacity: 0.5, color: 'var(--text-secondary)' }}>无输出</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>暂无在线的智能体</div>
      )}

      {offlineAgents.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>离线：</span>
          {offlineAgents.map(agent => (
            <span key={agent.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{agent.name} ({agent.role})</span>
          ))}
        </div>
      )}

      {/* 任务创建模态框 */}
      {showTaskModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowTaskModal(false)}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            padding: 24,
            width: 500,
            border: '1px solid var(--border)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>📋 创建任务</h3>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>分配给</label>
              <select
                value={selectedAgent || ''}
                onChange={e => setSelectedAgent(e.target.value)}
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
                {agents.filter(a => a.id !== 'commander').map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>任务标题</label>
              <input
                value={newTask.title}
                onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="输入任务标题"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>任务描述</label>
              <textarea
                value={newTask.description}
                onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入任务描述"
                rows={3}
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
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>优先级</label>
              <select
                value={newTask.priority}
                onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
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
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowTaskModal(false)} style={{
                padding: '8px 16px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
                取消
              </button>
              <button onClick={handleCreateTask} style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 'var(--radius)',
                background: 'var(--accent)',
                color: 'var(--bg-primary)',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
