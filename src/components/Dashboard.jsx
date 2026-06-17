/**
 * Dashboard - 看板组件
 *
 * 显示 Agent 状态和任务概览
 */

import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

export default function Dashboard() {
  const [agents, setAgents] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 10000) // 每 10 秒刷新
    return () => clearInterval(timer)
  }, [])

  const fetchData = async () => {
    try {
      const [agentsRes, tasksRes, runningRes] = await Promise.all([
        fetch(`${API_BASE}/api/agents`),
        fetch(`${API_BASE}/api/tasks`),
        fetch(`${API_BASE}/api/agents/running`),
      ])

      const agentsData = agentsRes.ok ? await agentsRes.json() : []
      const tasksData = tasksRes.ok ? await tasksRes.json() : []
      const runningData = runningRes.ok ? await runningRes.json() : {}

      // 合并运行状态
      const agentsWithStatus = agentsData.map(agent => ({
        ...agent,
        isRunning: !!runningData[agent.id],
        runningInfo: runningData[agent.id] || null,
      }))

      setAgents(agentsWithStatus)
      setTasks(tasksData)
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

  // Agent 统计
  const agentStats = {
    total: agents.length,
    running: agents.filter(a => a.isRunning).length,
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        加载中...
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24, color: 'var(--text-primary)', fontSize: 20, fontWeight: 600 }}>📊 看板</h2>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard icon="🤖" label="Agent 总数" value={agentStats.total} color="var(--accent)" />
        <StatCard icon="🟢" label="运行中" value={agentStats.running} color="var(--success)" />
        <StatCard icon="📋" label="任务总数" value={taskStats.total} color="var(--warning)" />
        <StatCard icon="✅" label="已完成" value={taskStats.completed} color="var(--success)" />
      </div>

      {/* Agent 状态 */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>
          🤖 Agent 状态
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {agents.map(agent => (
            <div
              key={agent.id}
              className="glass-card"
              style={{
                padding: 14,
                borderLeft: `3px solid ${agent.isRunning ? 'var(--success)' : 'var(--text-secondary)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: agent.isRunning ? 'var(--success)' : 'var(--text-secondary)',
                  boxShadow: agent.isRunning ? '0 0 6px var(--success)' : 'none',
                }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                  {agent.name || agent.id}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {agent.cli_type || 'hermes'} · {agent.isRunning ? '运行中' : '离线'}
              </div>
              {agent.runningInfo && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Session: {agent.runningInfo.sessionId?.substring(0, 8)}...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 任务概览 */}
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>
          📋 任务概览
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ textAlign: 'center', padding: 12, background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)' }}>{taskStats.pending}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>待处理</div>
          </div>
          <div style={{ textAlign: 'center', padding: 12, background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>{taskStats.in_progress}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>进行中</div>
          </div>
          <div style={{ textAlign: 'center', padding: 12, background: 'var(--glass-bg)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{taskStats.completed}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已完成</div>
          </div>
        </div>

        {/* 最近任务 */}
        {tasks.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
              最近任务
            </h4>
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
                    {task.status === 'completed' ? '已完成' :
                     task.status === 'in_progress' ? '进行中' : '待处理'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="glass-card" style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  )
}
