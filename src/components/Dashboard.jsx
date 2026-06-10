import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

export default function Dashboard() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const outputRefs = useRef({})
  const containerRef = useRef(null)
  const cardsRef = useRef([])

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
    const interval = setInterval(fetchDashboard, 5000)
    return () => clearInterval(interval)
  }, [])

  // 卡片入场动画
  useEffect(() => {
    if (agents.length > 0 && containerRef.current) {
      gsap.from(cardsRef.current, {
        y: 30,
        autoAlpha: 0,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.1,
      })
    }
  }, [agents])

  // 自动滚动到底部
  useEffect(() => {
    agents.forEach(agent => {
      const ref = outputRefs.current[agent.id]
      if (ref) {
        ref.scrollTop = ref.scrollHeight
      }
    })
  }, [agents])

  const handleRefresh = () => {
    // 刷新按钮动画
    gsap.to('.refresh-btn', {
      rotation: 360,
      duration: 0.5,
      ease: 'power2.inOut',
    })
    fetchDashboard()
  }

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
        <div style={{
          fontSize: 24,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          🔄 加载中...
        </div>
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
    <div 
      ref={containerRef}
      style={{ 
        padding: 20, 
        overflowY: 'auto', 
        height: '100%',
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 20 
      }}>
        <h2 style={{ color: 'var(--text-primary)' }}>🤖 AI 团队看板</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className="refresh-btn"
            onClick={handleRefresh}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: 'var(--bg-primary)',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
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

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16 
      }}>
        {agents.map((agent, index) => (
          <div 
            key={agent.id}
            ref={el => cardsRef.current[index] = el}
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              gsap.to(e.currentTarget, {
                y: -4,
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                duration: 0.2,
                ease: 'power2.out',
              })
            }}
            onMouseLeave={(e) => {
              gsap.to(e.currentTarget, {
                y: 0,
                boxShadow: 'none',
                duration: 0.2,
                ease: 'power2.out',
              })
            }}
          >
            {/* 卡片头部 */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: agent.online ? 'var(--success)' : 'var(--text-secondary)',
                boxShadow: agent.online ? '0 0 8px var(--success)' : 'none',
              }} />
              <span style={{ 
                fontSize: 18, 
                fontWeight: 'bold',
                color: 'var(--text-primary)',
              }}>
                {agent.name}
              </span>
              <span style={{ 
                fontSize: 12, 
                color: 'var(--text-secondary)',
              }}>
                {agent.online ? '运行中' : '离线'}
              </span>
              <span style={{ 
                marginLeft: 'auto',
                fontSize: 13, 
                color: 'var(--text-secondary)',
              }}>
                {agent.role}
              </span>
            </div>

            {/* 任务状态 */}
            <div style={{
              padding: '8px 16px',
              background: 'var(--bg-secondary)',
              fontSize: 14,
              color: 'var(--accent)',
            }}>
              📋 {agent.task}
            </div>

            {/* 输出内容 */}
            <div 
              ref={el => outputRefs.current[agent.id] = el}
              style={{
                padding: '12px 16px',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 300,
                overflowY: 'auto',
                background: 'var(--bg-primary)',
              }}
            >
              {agent.output || '无输出'}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
