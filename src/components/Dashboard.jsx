import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

export default function Dashboard() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const outputRefs = useRef({})

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard`)
      if (!response.ok) throw new Error('Failed to fetch dashboard')
      const data = await response.json()
      setAgents(data)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  useEffect(() => {
    agents.forEach(agent => {
      const ref = outputRefs.current[agent.id]
      if (ref) {
        ref.scrollTop = ref.scrollHeight
      }
    })
  }, [loading])

  const handleRefresh = () => {
    fetchDashboard()
  }

  const handleCardMouseEnter = (e) => {
    gsap.to(e.currentTarget, {
      y: -4,
      boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
      duration: 0.2,
      ease: 'power2.out',
    })
  }

  const handleCardMouseLeave = (e) => {
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: 'none',
      duration: 0.2,
      ease: 'power2.out',
    })
  }

  const handleRefreshHover = (e) => {
    gsap.to(e.currentTarget, { scale: 1.05, duration: 0.2 })
  }

  const handleRefreshLeave = (e) => {
    gsap.to(e.currentTarget, { scale: 1, duration: 0.2 })
  }

  // 只显示在线的agent
  const onlineAgents = agents.filter(a => a.online)
  const offlineAgents = agents.filter(a => !a.online)

  if (loading) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}>
        🔄 加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        color: 'var(--error)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 18, marginBottom: 8 }}>错误</div>
        <div style={{ fontSize: 14 }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 20,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>🤖 AI 团队看板</h2>
          <span style={{ 
            fontSize: 14, 
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)',
            padding: '4px 12px',
            borderRadius: 'var(--radius)',
          }}>
            {onlineAgents.length} 在线 / {agents.length} 总计
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={handleRefresh}
            onMouseEnter={handleRefreshHover}
            onMouseLeave={handleRefreshLeave}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: 'var(--bg-primary)',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            🔄 刷新
          </button>
          {lastUpdate && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              更新于 {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* 在线agent - 动态均分 */}
      {onlineAgents.length > 0 ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${onlineAgents.length}, 1fr)`,
          gap: 16,
          flex: 1,
          minHeight: 0,
        }}>
          {onlineAgents.map(agent => (
            <div 
              key={agent.id}
              onMouseEnter={handleCardMouseEnter}
              onMouseLeave={handleCardMouseLeave}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                cursor: 'default',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  boxShadow: '0 0 8px var(--success)',
                }} />
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 'bold',
                  color: 'var(--text-primary)',
                }}>
                  {agent.name}
                </span>
                <span style={{ 
                  marginLeft: 'auto',
                  fontSize: 13, 
                  color: 'var(--text-secondary)',
                }}>
                  {agent.role}
                </span>
              </div>

              <div style={{
                padding: '8px 16px',
                background: 'var(--bg-secondary)',
                fontSize: 14,
                color: 'var(--accent)',
                flexShrink: 0,
              }}>
                📋 {agent.task}
              </div>

              <div 
                ref={el => outputRefs.current[agent.id] = el}
                style={{
                  padding: '12px 16px',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  overflowY: 'auto',
                  background: 'var(--bg-primary)',
                  flex: 1,
                }}
              >
                {agent.output || '无输出'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
        }}>
          暂无在线的智能体
        </div>
      )}

      {/* 离线agent - 底部小字 */}
      {offlineAgents.length > 0 && (
        <div style={{ 
          marginTop: 16, 
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 16,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            离线：
          </span>
          {offlineAgents.map(agent => (
            <span key={agent.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {agent.name} ({agent.role})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
