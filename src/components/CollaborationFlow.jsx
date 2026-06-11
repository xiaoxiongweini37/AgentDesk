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

  // 加载数据
  const fetchData = async () => {
    setLoading(true)
    try {
      const [msgRes, taskRes] = await Promise.all([
        fetch(`${API_BASE}/api/messages`),
        fetch(`${API_BASE}/api/tasks`),
      ])
      const msgData = await msgRes.json()
      const taskData = await taskRes.json()
      setMessages(msgData)
      setTasks(taskData)
    } catch (err) {
      console.error('加载数据失败:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen])

  // 获取Agent状态
  const getAgentStatus = (agentId) => {
    const agentTasks = tasks.filter(t => t.assigned_to === agentId)
    const agentMsgs = messages.filter(m => m.to === agentId && !m.read)
    
    return {
      tasks: agentTasks.length,
      activeTasks: agentTasks.filter(t => t.status === 'in_progress').length,
      unreadMessages: agentMsgs.length,
    }
  }

  // 获取连线（消息流）
  const getConnections = () => {
    const connections = []
    
    // 基于最近的消息创建连线
    const recentMsgs = messages.slice(-20)
    recentMsgs.forEach(msg => {
      const from = AGENTS.find(a => a.id === msg.from)
      const to = AGENTS.find(a => a.id === msg.to)
      
      if (from && to) {
        connections.push({
          from: from,
          to: to,
          type: msg.type,
          color: msg.type === 'task' ? '#ff9800' : msg.type === 'error' ? '#f44336' : '#4caf50',
        })
      }
    })
    
    return connections
  }

  if (!isOpen) return null

  const connections = getConnections()

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
        width: 900,
        height: 600,
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
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>🔄 协作流程可视化</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchData} style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: 'var(--bg-primary)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}>
              🔄 刷新
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

        {/* SVG 流程图 */}
        <div style={{
          flex: 1,
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <svg width="100%" height="100%" viewBox="0 0 800 450">
            {/* 连线 */}
            {connections.map((conn, i) => {
              const fromX = conn.from.x
              const fromY = conn.from.y + 30
              const toX = conn.to.x
              const toY = conn.to.y - 10
              
              return (
                <g key={i}>
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke={conn.color}
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    opacity={0.6}
                  />
                  {/* 箭头 */}
                  <polygon
                    points={`${toX},${toY} ${toX-5},${toY-10} ${toX+5},${toY-10}`}
                    fill={conn.color}
                    opacity={0.8}
                  />
                </g>
              )
            })}

            {/* Agent 节点 */}
            {AGENTS.map(agent => {
              const status = getAgentStatus(agent.id)
              const isSelected = selectedAgent === agent.id
              
              return (
                <g
                  key={agent.id}
                  onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* 背景圆 */}
                  <circle
                    cx={agent.x}
                    cy={agent.y}
                    r={35}
                    fill={agent.color + '20'}
                    stroke={isSelected ? agent.color : 'var(--border)'}
                    strokeWidth={isSelected ? 3 : 1}
                  />
                  
                  {/* 图标 */}
                  <text
                    x={agent.x}
                    y={agent.y - 5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={24}
                  >
                    {agent.icon}
                  </text>
                  
                  {/* 名称 */}
                  <text
                    x={agent.x}
                    y={agent.y + 25}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={12}
                    fill={agent.color}
                    fontWeight="bold"
                  >
                    {agent.name}
                  </text>
                  
                  {/* 状态指示器 */}
                  {status.activeTasks > 0 && (
                    <circle
                      cx={agent.x + 25}
                      cy={agent.y - 25}
                      r={8}
                      fill="#4caf50"
                    />
                  )}
                  {status.unreadMessages > 0 && (
                    <circle
                      cx={agent.x - 25}
                      cy={agent.y - 25}
                      r={8}
                      fill="#f44336"
                    />
                  )}
                </g>
              )
            })}
          </svg>

          {/* 选中Agent的详情 */}
          {selectedAgent && (
            <div style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              padding: 16,
              border: '1px solid var(--border)',
              width: 250,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}>
                <span style={{ fontSize: 24 }}>
                  {AGENTS.find(a => a.id === selectedAgent)?.icon}
                </span>
                <span style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: 'var(--text-primary)',
                }}>
                  {AGENTS.find(a => a.id === selectedAgent)?.name}
                </span>
              </div>
              
              <div style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}>
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
        <div style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
          padding: '8px 12px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
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
