/**
 * CollaborationFlow - 协作流程组件
 *
 * 显示 Agent 间的通信和协作状态
 */

import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

export default function CollaborationFlow({ isOpen, onClose }) {
  const [agents, setAgents] = useState([])
  const [messages, setMessages] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [agentsRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/agents`),
        fetch(`${API_BASE}/api/tasks`),
      ])

      if (agentsRes.ok) setAgents(await agentsRes.json())
      if (tasksRes.ok) setTasks(await tasksRes.json())
    } catch (err) {
      console.error('加载数据失败:', err)
    }
    setLoading(false)
  }

  // 任务统计
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }

  if (!isOpen) return null

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="glass-modal animate-slide-up"
        style={{ padding: 24, width: 700, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>🔄 协作流程</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchData} className="glass-btn" style={{ padding: '6px 12px', fontSize: 12 }}>🔄 刷新</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>加载中...</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Agent 状态 */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
                🤖 Agent 团队
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {agents.map(agent => (
                  <div
                    key={agent.id}
                    className="glass-card"
                    style={{
                      padding: 14,
                      textAlign: 'center',
                      borderLeft: `3px solid ${agent.cli_type === 'claude' ? '#e91e63' : '#4fc3f7'}`,
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>
                      {agent.cli_type === 'claude' ? '🧠' : '🤖'}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>
                      {agent.name || agent.id}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {agent.cli_type || 'hermes'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {agent.role || '通用 Agent'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 任务统计 */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
                📋 协作任务
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ textAlign: 'center', padding: 12, background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{taskStats.total}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>总任务</div>
                </div>
                <div style={{ textAlign: 'center', padding: 12, background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)' }}>{taskStats.pending}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>待处理</div>
                </div>
                <div style={{ textAlign: 'center', padding: 12, background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>{taskStats.in_progress}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>进行中</div>
                </div>
                <div style={{ textAlign: 'center', padding: 12, background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{taskStats.completed}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>已完成</div>
                </div>
              </div>

              {/* 最近任务 */}
              {tasks.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13 }}>最近任务</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {tasks.slice(0, 5).map(task => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: task.status === 'completed' ? 'var(--success)' :
                                     task.status === 'in_progress' ? 'var(--warning)' : 'var(--text-secondary)',
                        }} />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{task.title}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {task.assignedTo || '未分配'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 协作说明 */}
            <div className="glass-card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
                💡 协作流程
              </h3>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p>1. <strong>下达任务</strong>：在任务列表中创建任务</p>
                <p>2. <strong>智能分配</strong>：编排器根据 Agent 能力自动分配</p>
                <p>3. <strong>执行任务</strong>：Agent 执行任务并报告进度</p>
                <p>4. <strong>协作沟通</strong>：Agent 间可以发送消息和共享文件</p>
                <p>5. <strong>完成任务</strong>：任务完成后自动通知相关 Agent</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
