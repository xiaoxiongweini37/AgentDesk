import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

const AGENTS = [
  { id: 'commander', name: '总指挥', icon: '🎯', color: '#4fc3f7', x: 400, y: 50 },
  { id: 'worker', name: 'A号', icon: '⚡', color: '#ff9800', x: 150, y: 200 },
  { id: 'coder-b', name: 'B号', icon: '🔧', color: '#4caf50', x: 400, y: 200 },
  { id: 'coder-c', name: 'C号', icon: '🧪', color: '#9c27b0', x: 650, y: 200 },
  { id: 'claude-code', name: 'Claude', icon: '🤖', color: '#e91e63', x: 400, y: 350 },
]

export default function CollaborationFlow({ isOpen, onClose }) {
  const [agents, setAgents] = useState(AGENTS)
  const [messages, setMessages] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [msgRes, taskRes] = await Promise.all([
        fetch(`${API_BASE}/api/messages`),
        fetch(`${API_BASE}/api/tasks`),
      ])
      setMessages(await msgRes.json())
      setTasks(await taskRes.json())
    } catch (err) { console.error('加载数据失败:', err) }
    setLoading(false)
  }

  useEffect(() => { if (isOpen) fetchData() }, [isOpen])

  const getAgentStatus = (agentId) => {
    const agentTasks = tasks.filter(t => t.assigned_to === agentId)
    const agentMsgs = messages.filter(m => m.to === agentId && !m.read)
    return {
      tasks: agentTasks.length,
      activeTasks: agentTasks.filter(t => t.status === 'in_progress').length,
      unreadMessages: agentMsgs.length,
    }
  }

  const getConnections = () => {
    const connections = []
    messages.slice(-20).forEach(msg => {
      const from = AGENTS.find(a => a.id === msg.from)
      const to = AGENTS.find(a => a.id === msg.to)
      if (from && to) {
        connections.push({
          from, to, type: msg.type,
          color: msg.type === 'task' ? '#ff9800' : msg.type === 'error' ? '#f44336' : '#4caf50',
        })
      }
    })
    return connections
  }

  if (!isOpen) return null
  const connections = getConnections()

  return (
    <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="glass-modal animate-slide-up" style={{ padding: 24, width: 900, height: 600, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>🔄 协作流程可视化</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchData} className="glass-btn-primary" style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}>🔄 刷新</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* SVG 流程图 */}
        <div className="glass-card" style={{ flex: 1, borderRadius: 'var(--radius-md)', position: 'relative', overflow: 'hidden' }}>
          <svg width="100%" height="100%" viewBox="0 0 800 450">
            {/* 连线 */}
            {connections.map((conn, i) => {
              const fromX = conn.from.x, fromY = conn.from.y + 30
              const toX = conn.to.x, toY = conn.to.y - 10
              return (
                <g key={i}>
                  <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke={conn.color} strokeWidth={2} strokeDasharray="5,5" opacity={0.5} />
                  <polygon points={`${toX},${toY} ${toX-5},${toY-10} ${toX+5},${toY-10}`} fill={conn.color} opacity={0.7} />
                </g>
              )
            })}

            {/* Agent 节点 */}
            {AGENTS.map(agent => {
              const status = getAgentStatus(agent.id)
              const isSelected = selectedAgent === agent.id
              return (
                <g key={agent.id} onClick={() => setSelectedAgent(isSelected ? null : agent.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={agent.x} cy={agent.y} r={35} fill={agent.color + '15'} stroke={isSelected ? agent.color : 'rgba(255,255,255,0.1)'} strokeWidth={isSelected ? 2 : 1} />
                  <text x={agent.x} y={agent.y - 5} textAnchor="middle" dominantBaseline="middle" fontSize={24}>{agent.icon}</text>
                  <text x={agent.x} y={agent.y + 25} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill={agent.color} fontWeight="600">{agent.name}</text>
                  {status.activeTasks > 0 && <circle cx={agent.x + 25} cy={agent.y - 25} r={8} fill="#4caf50" opacity={0.8} />}
                  {status.unreadMessages > 0 && <circle cx={agent.x - 25} cy={agent.y - 25} r={8} fill="#f44336" opacity={0.8} />}
                </g>
              )
            })}
          </svg>

          {/* 选中Agent详情 */}
          {selectedAgent && (
            <div className="glass-card animate-fade-in" style={{
              position: 'absolute', top: 12, right: 12, padding: 16, borderRadius: 'var(--radius-md)', width: 240,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>{AGENTS.find(a => a.id === selectedAgent)?.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{AGENTS.find(a => a.id === selectedAgent)?.name}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {(() => {
                  const status = getAgentStatus(selectedAgent)
                  return (
                    <>
                      <div>📋 任务: {status.tasks} 个</div>
                      <div>⚡ 进行中: {status.activeTasks} 个</div>
                      <div>💬 未读消息: {status.unreadMessages} 条</div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* 图例 */}
        <div className="glass-card" style={{ display: 'flex', gap: 16, marginTop: 12, padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>🟠 任务消息</span>
          <span>🟢 结果消息</span>
          <span>🔴 错误消息</span>
          <span>⚡ 进行中任务</span>
          <span>💬 未读消息</span>
        </div>
      </div>
    </div>
  )
}
