import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

// 简化：只区分用户输入和 Agent 输出
function getColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  if (isLight) {
    return {
      user: { color: '#0277bd', bg: 'rgba(2,119,189,0.1)', border: '#0277bd' },
      agent: { color: '#2e7d32', bg: 'rgba(46,125,50,0.1)', border: '#2e7d32' },
      default: { color: 'var(--text-secondary)', bg: 'transparent', border: 'transparent' },
    }
  }
  return {
    user: { color: '#4fc3f7', bg: 'rgba(79,195,247,0.08)', border: '#4fc3f7' },
    agent: { color: '#a5d6a7', bg: 'rgba(165,214,167,0.08)', border: '#a5d6a7' },
    default: { color: 'var(--text-secondary)', bg: 'transparent', border: 'transparent' },
  }
}

// 检测是否是用户输入行
function isUserLine(line) {
  const t = line.trim()
  if (!t) return false
  // 明确的用户输入标记
  if (t.startsWith('>') || t.startsWith('❯') || t.includes('[user]')) return true
  return false
}

// 检测是否是 Agent 输出行
function isAgentLine(line) {
  const t = line.trim()
  if (!t) return false
  // Agent 前缀
  if (/^[a-zA-Z-]+[》>]/.test(t)) return true
  // Agent 特征
  if (t.includes('[assistant]') || t.includes('Hermes') || t.includes('✅') ||
      t.startsWith('---') || t.startsWith('===') ||
      t.includes('已提交') || t.includes('已推送') || t.includes('完成') ||
      t.includes('Self-improvement') || t.includes('musing') ||
      t.includes('deliberating') || t.includes('💭') || t.includes('🤔')) {
    return true
  }
  return false
}

// 渲染带颜色的输出
function ColoredOutput({ output, timestamp }) {
  const COLORS = getColors()
  const lines = output.split('\n')
  const groups = []
  let currentGroup = null

  lines.forEach((line) => {
    let type = 'default'
    if (isUserLine(line)) type = 'user'
    else if (isAgentLine(line)) type = 'agent'

    if (!currentGroup || currentGroup.type !== type) {
      currentGroup = { type, lines: [line] }
      groups.push(currentGroup)
    } else {
      currentGroup.lines.push(line)
    }
  })

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ 
        fontSize: 10, 
        color: 'var(--text-secondary)', 
        opacity: 0.6,
        marginBottom: 4,
      }}>
        [{timestamp}]
      </div>
      {groups.map((group, gi) => {
        const style = COLORS[group.type]
        const isSpecial = group.type !== 'default'
        return (
          <div key={gi} style={{
            padding: isSpecial ? '6px 10px' : '2px 0',
            marginBottom: 2,
            background: style.bg,
            borderLeft: isSpecial ? `3px solid ${style.border}` : 'none',
            borderRadius: isSpecial ? '0 4px 4px 0' : 0,
          }}>
            <span style={{ 
              color: style.color, 
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {group.lines.join('\n')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const outputRefs = useRef({})
  const userScrolledRef = useRef({})

  const handleScroll = (agentId) => {
    const el = outputRefs.current[agentId]
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
    userScrolledRef.current[agentId] = !atBottom
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
            if (!oldAgent) return { 
              ...newAgent, 
              history: newAgent.output ? [{ text: newAgent.output, time: new Date().toLocaleTimeString() }] : [] 
            }
            const lastText = oldAgent.history?.[oldAgent.history.length - 1]?.text
            if (newAgent.output && newAgent.output !== lastText) {
              return {
                ...newAgent,
                history: [...(oldAgent.history || []), { text: newAgent.output, time: new Date().toLocaleTimeString() }],
              }
            }
            return { ...oldAgent, ...newAgent }
          })
        })
      } else {
        setAgents(data.map(agent => ({
          ...agent,
          history: agent.output ? [{ text: agent.output, time: new Date().toLocaleTimeString() }] : [],
        })))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard(false)
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
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, history: [] } : a))
    userScrolledRef.current[agentId] = false
  }

  const handleCardMouseEnter = (e) => {
    gsap.to(e.currentTarget, { y: -4, boxShadow: '0 8px 16px rgba(0,0,0,0.3)', duration: 0.2, ease: 'power2.out' })
  }
  const handleCardMouseLeave = (e) => {
    gsap.to(e.currentTarget, { y: 0, boxShadow: 'none', duration: 0.2, ease: 'power2.out' })
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
          <button onClick={handleRefresh} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg-primary)', cursor: 'pointer', fontWeight: 'bold' }}>
            🔄 刷新
          </button>
          {lastUpdate && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>更新于 {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* 简化图例 */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', flexShrink: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: '#4fc3f7' }} />
          <span style={{ color: 'var(--text-secondary)' }}>用户输入</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: '#a5d6a7' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Agent 输出</span>
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
                <button onClick={() => handleClear(agent.id)} title="清除历史" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>🗑️</button>
              </div>
              <div style={{ padding: '8px 16px', background: 'var(--bg-secondary)', fontSize: 14, color: 'var(--accent)', flexShrink: 0 }}>📋 {agent.task}</div>
              <div ref={el => outputRefs.current[agent.id] = el} onScroll={() => handleScroll(agent.id)}
                style={{ padding: '12px 16px', fontSize: 12, lineHeight: 1.5, overflowY: 'auto', background: 'var(--bg-primary)', flex: 1 }}>
                {(agent.history || []).length > 0 ? (
                  agent.history.map((entry, i) => (
                    <ColoredOutput key={i} output={entry.text} timestamp={entry.time} />
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
    </div>
  )
}
