import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

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

function MessageItem({ msg }) {
  const COLORS = getColors()
  const style = COLORS[msg.role] || COLORS.assistant
  const content = msg.content || ''
  const displayContent = msg.role === 'tool' && content.length > 300 ? content.substring(0, 300) + '...' : content
  if (!displayContent.trim()) return null

  return (
    <div style={{ padding: '8px 12px', marginBottom: 6, background: style.bg, borderLeft: `3px solid ${style.border}`, borderRadius: '0 8px 8px 0' }}>
      <div style={{ fontSize: 10, color: style.color, opacity: 0.8, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{style.icon}</span>
        <span>{msg.role === 'user' ? '用户' : msg.role === 'assistant' ? 'Agent' : '工具'}</span>
        {msg.timestamp && <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{new Date(msg.timestamp * 1000).toLocaleTimeString()}</span>}
      </div>
      <div style={{ color: style.color, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>{displayContent}</div>
    </div>
  )
}

function TaskItem({ task }) {
  const COLORS = getColors()
  const style = COLORS.task
  const statusColors = { pending: '#ff9800', assigned: '#2196f3', in_progress: '#4caf50', completed: '#8bc34a', failed: '#f44336' }

  return (
    <div style={{ padding: '8px 12px', marginBottom: 6, background: style.bg, borderLeft: `3px solid ${statusColors[task.status] || style.border}`, borderRadius: '0 8px 8px 0' }}>
      <div style={{ fontSize: 10, color: style.color, opacity: 0.8, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{style.icon}</span>
        <span style={{ fontWeight: 600 }}>{task.title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 6px', background: statusColors[task.status] || '#666', borderRadius: 10, color: '#fff' }}>{task.status}</span>
      </div>
      <div style={{ color: style.color, fontSize: 11, opacity: 0.7 }}>{task.description?.substring(0, 80)}...</div>
    </div>
  )
}

function AgentMessageItem({ msg }) {
  const COLORS = getColors()
  const style = COLORS.message
  return (
    <div style={{ padding: '8px 12px', marginBottom: 6, background: style.bg, borderLeft: `3px solid ${style.border}`, borderRadius: '0 8px 8px 0' }}>
      <div style={{ fontSize: 10, color: style.color, opacity: 0.8, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{style.icon}</span>
        <span>{msg.from} → {msg.to}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 6px', background: msg.type === 'task' ? '#ff9800' : msg.type === 'error' ? '#f44336' : '#4caf50', borderRadius: 10, color: '#fff' }}>{msg.type}</span>
      </div>
      <div style={{ color: style.color, fontSize: 11 }}>{msg.content?.substring(0, 100)}</div>
    </div>
  )
}

function TmuxOutput({ output }) {
  return (
    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
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
    userScrolledRef.current[agentId] = !(el.scrollHeight - el.scrollTop - el.clientHeight < 30)
  }

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/agents/status`)
      if (response.ok) {
        const statusData = await response.json()
        setAgents(prev => prev.map(agent => ({ ...agent, realTimeStatus: statusData[agent.id] || null })))
      }
    } catch {}
  }

  const fetchDashboard = async (append = false) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard`)
      if (!response.ok) throw new Error('Failed to fetch dashboard')
      const data = await response.json()
      setLastUpdate(new Date())
      setError(null)

      if (append) {
        setAgents(prev => data.map(newAgent => {
          const oldAgent = prev.find(a => a.id === newAgent.id)
          if (!oldAgent) return { ...newAgent, history: [] }
          if (newAgent.messages && newAgent.messages.length > 0) {
            const oldHistory = oldAgent.history || []
            const newMessages = newAgent.messages
            if (newMessages.length > (oldAgent._msgCount || 0)) {
              return { ...newAgent, history: [...oldHistory, { messages: newMessages.slice(oldAgent._msgCount || 0), time: new Date().toLocaleTimeString() }], _msgCount: newMessages.length }
            }
            return { ...oldAgent, ...newAgent, _msgCount: newMessages.length }
          }
          const lastOutput = oldAgent.history?.[oldAgent.history.length - 1]?.output
          if (newAgent.output && newAgent.output !== lastOutput) {
            return { ...newAgent, history: [...(oldAgent.history || []), { output: newAgent.output, time: new Date().toLocaleTimeString() }] }
          }
          return { ...oldAgent, ...newAgent }
        }))
      } else {
        setAgents(data.map(agent => {
          if (agent.messages && agent.messages.length > 0) {
            return { ...agent, history: [{ messages: agent.messages, time: new Date().toLocaleTimeString() }], _msgCount: agent.messages.length }
          }
          return { ...agent, history: agent.output ? [{ output: agent.output, time: new Date().toLocaleTimeString() }] : [] }
        }))
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchDashboard(false)
    const statusInterval = setInterval(fetchStatus, 5000)
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

  const handleCreateTask = async () => {
    if (!newTask.title || !selectedAgent) return
    try {
      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTask, assigned_to: selectedAgent }),
      })
      if (response.ok) { setShowTaskModal(false); setNewTask({ title: '', description: '', priority: 'normal' }); fetchDashboard(false) }
    } catch (err) { console.error('创建任务失败:', err) }
  }

  const onlineAgents = agents.filter(a => a.online)
  const offlineAgents = agents.filter(a => !a.online)

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>🔄</div>
          <div style={{ fontSize: 14 }}>加载中...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="animate-fade-in" style={{ padding: 20, textAlign: 'center', color: 'var(--error)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 18, marginBottom: 8 }}>错误</div>
        <div style={{ fontSize: 14 }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 20, fontWeight: 600 }}>🤖 AI 团队看板</h2>
          <span className="glass-card" style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '4px 14px', borderRadius: 20 }}>
            {onlineAgents.length} 在线 / {agents.length} 总计
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setSelectedAgent(null); setShowTaskModal(true) }} className="glass-btn-primary" style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}>
            📋 新建任务
          </button>
          <button onClick={handleRefresh} className="glass-btn" style={{ padding: '8px 16px', fontSize: 13 }}>🔄 刷新</button>
          {lastUpdate && <span style={{ color: 'var(--text-secondary)', fontSize: 11, opacity: 0.6 }}>更新于 {lastUpdate.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* 图例 */}
      <div className="glass-card" style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '8px 14px', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}>
        {[{ color: '#4fc3f7', label: '用户输入' }, { color: '#a5d6a7', label: 'Agent 输出' }, { color: '#ffcc80', label: '工具调用' }, { color: '#ce93d8', label: '任务' }, { color: '#80deea', label: '消息' }].map(item => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
          </span>
        ))}
      </div>

      {/* Agent 卡片 */}
      {onlineAgents.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${onlineAgents.length}, 1fr)`, gap: 12, flex: 1, minHeight: 0 }}>
          {onlineAgents.map(agent => (
            <div key={agent.id} className="glass-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{agent.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', opacity: 0.7 }}>{agent.role}</span>
                <button onClick={() => { setSelectedAgent(agent.id); setShowTaskModal(true) }} title="分配任务" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>📋</button>
                <button onClick={() => handleClear(agent.id)} title="清除历史" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>🗑️</button>
              </div>

              {agent.agentTasks && agent.agentTasks.length > 0 && (
                <div style={{ padding: '5px 16px', background: 'rgba(206,147,216,0.08)', fontSize: 11, color: '#ce93d8', flexShrink: 0 }}>
                  📋 {agent.agentTasks.filter(t => t.status === 'in_progress').length} 进行中 / {agent.agentTasks.length} 总计
                </div>
              )}

              {agent.agentMessages && agent.agentMessages.length > 0 && (
                <div style={{ padding: '5px 16px', background: 'rgba(128,222,234,0.08)', fontSize: 11, color: '#80deea', flexShrink: 0 }}>
                  💬 {agent.agentMessages.filter(m => !m.read).length} 未读 / {agent.agentMessages.length} 总计
                </div>
              )}

              <div style={{ padding: '8px 16px', background: 'rgba(108, 92, 231, 0.06)', fontSize: 13, color: 'var(--accent-light)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--glass-border)' }}>
                <span>📋 {agent.realTimeStatus?.detail || agent.task}</span>
                {agent.realTimeStatus && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 20,
                    background: agent.realTimeStatus.activity === 'working' || agent.realTimeStatus.activity === 'executing' ? 'rgba(76,175,80,0.15)' :
                               agent.realTimeStatus.activity === 'thinking' || agent.realTimeStatus.activity === 'preparing' ? 'rgba(255,152,0,0.15)' :
                               agent.realTimeStatus.activity === 'error' ? 'rgba(244,67,54,0.15)' :
                               agent.realTimeStatus.activity === 'idle' ? 'rgba(33,150,243,0.15)' : 'rgba(158,158,158,0.15)',
                    color: agent.realTimeStatus.activity === 'working' || agent.realTimeStatus.activity === 'executing' ? '#4caf50' :
                           agent.realTimeStatus.activity === 'thinking' || agent.realTimeStatus.activity === 'preparing' ? '#ff9800' :
                           agent.realTimeStatus.activity === 'error' ? '#f44336' :
                           agent.realTimeStatus.activity === 'idle' ? '#2196f3' : '#9e9e9e',
                    fontWeight: 600,
                  }}>
                    {agent.realTimeStatus.activity === 'idle' ? '💤 空闲' :
                     agent.realTimeStatus.activity === 'working' ? '⚡ 工作中' :
                     agent.realTimeStatus.activity === 'thinking' ? '💭 思考中' :
                     agent.realTimeStatus.activity === 'executing' ? '⚙️ 执行中' :
                     agent.realTimeStatus.activity === 'error' ? '❌ 错误' :
                     agent.realTimeStatus.activity === 'offline' ? '⚫ 离线' :
                     agent.realTimeStatus.detail || ''}
                  </span>
                )}
              </div>

              <div ref={el => outputRefs.current[agent.id] = el} onScroll={() => handleScroll(agent.id)}
                style={{ padding: '12px 16px', fontSize: 12, lineHeight: 1.5, overflowY: 'auto', flex: 1 }}>
                {(agent.history || []).length > 0 ? (
                  agent.history.map((entry, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.4, marginBottom: 8 }}>── {entry.time} ──</div>
                      {entry.messages ? entry.messages.map((msg, j) => <MessageItem key={j} msg={msg} />) : <TmuxOutput output={entry.output} />}
                    </div>
                  ))
                ) : (
                  <span style={{ opacity: 0.4, color: 'var(--text-secondary)' }}>无输出</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', opacity: 0.5 }}>暂无在线的智能体</div>
      )}

      {offlineAgents.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5 }}>离线：</span>
          {offlineAgents.map(agent => (
            <span key={agent.id} style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5 }}>{agent.name} ({agent.role})</span>
          ))}
        </div>
      )}

      {/* 任务创建模态框 */}
      {showTaskModal && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTaskModal(false)}>
          <div className="glass-modal animate-slide-up" style={{ padding: 24, width: 500 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>📋 创建任务</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>分配给</label>
              <select value={selectedAgent || ''} onChange={e => setSelectedAgent(e.target.value)} className="glass-input" style={{ width: '100%', padding: '8px 12px' }}>
                <option value="">选择Agent</option>
                {agents.filter(a => a.id !== 'commander').map(a => (<option key={a.id} value={a.id}>{a.name} ({a.role})</option>))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>任务标题</label>
              <input value={newTask.title} onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))} placeholder="输入任务标题" className="glass-input" style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>任务描述</label>
              <textarea value={newTask.description} onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))} placeholder="输入任务描述" rows={3} className="glass-input" style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>优先级</label>
              <select value={newTask.priority} onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))} className="glass-input" style={{ width: '100%', padding: '8px 12px' }}>
                <option value="low">低</option>
                <option value="normal">中</option>
                <option value="high">高</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowTaskModal(false)} className="glass-btn" style={{ padding: '8px 16px', fontSize: 13 }}>取消</button>
              <button onClick={handleCreateTask} className="glass-btn-primary" style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
