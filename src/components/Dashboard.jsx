import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

// 内容类型颜色配置（深色主题）
const CONTENT_COLORS_DARK = {
  user_input: { color: '#4fc3f7', bg: 'rgba(79,195,247,0.08)', icon: '👤', label: '用户输入' },
  agent_output: { color: '#a5d6a7', bg: 'rgba(165,214,167,0.08)', icon: '🤖', label: 'Agent 输出' },
  file_change: { color: '#ffcc80', bg: 'rgba(255,204,128,0.08)', icon: '📝', label: '文件改动' },
  error: { color: '#ef9a9a', bg: 'rgba(239,154,154,0.08)', icon: '❌', label: '错误' },
  thinking: { color: '#ce93d8', bg: 'rgba(206,147,216,0.08)', icon: '💭', label: '思考中' },
  tool_call: { color: '#90caf9', bg: 'rgba(144,202,249,0.08)', icon: '🔧', label: '工具调用' },
  default: { color: 'var(--text-secondary)', bg: 'transparent', icon: '📄', label: '' },
}

// 浅色主题颜色（更深更饱和）
const CONTENT_COLORS_LIGHT = {
  user_input: { color: '#0277bd', bg: 'rgba(2,119,189,0.08)', icon: '👤', label: '用户输入' },
  agent_output: { color: '#2e7d32', bg: 'rgba(46,125,50,0.1)', icon: '🤖', label: 'Agent 输出' },
  file_change: { color: '#e65100', bg: 'rgba(230,81,0,0.08)', icon: '📝', label: '文件改动' },
  error: { color: '#c62828', bg: 'rgba(198,40,40,0.08)', icon: '❌', label: '错误' },
  thinking: { color: '#7b1fa2', bg: 'rgba(123,31,162,0.08)', icon: '💭', label: '思考中' },
  tool_call: { color: '#1565c0', bg: 'rgba(21,101,192,0.08)', icon: '🔧', label: '工具调用' },
  default: { color: 'var(--text-secondary)', bg: 'transparent', icon: '📄', label: '' },
}

// 获取当前主题对应的颜色
function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  return isLight ? CONTENT_COLORS_LIGHT : CONTENT_COLORS_DARK
}

// 解析输出行，识别内容类型
function parseLineType(line) {
  const trimmed = line.trim()
  if (!trimmed) return null
  
  // 用户输入（以 > 或 ❯ 开头，或包含 "user:"）
  if (trimmed.startsWith('>') || trimmed.startsWith('❯') || trimmed.includes('[user]')) {
    return 'user_input'
  }
  
  // 错误信息
  if (trimmed.includes('Error') || trimmed.includes('error') || trimmed.includes('ERROR') || 
      trimmed.includes('❌') || trimmed.includes('failed') || trimmed.includes('Failed')) {
    return 'error'
  }
  
  // 文件改动（git diff、文件路径等）
  if (trimmed.includes('diff --git') || trimmed.includes('@@') || 
      trimmed.match(/^[+-]{2,3}\s/) || trimmed.includes('modified:') || 
      trimmed.includes('new file:') || trimmed.includes('deleted:') ||
      trimmed.includes('commit') || trimmed.includes('Committer')) {
    return 'file_change'
  }
  
  // 工具调用
  if (trimmed.includes('execute_code') || trimmed.includes('terminal(') || 
      trimmed.includes('read_file') || trimmed.includes('write_file') ||
      trimmed.includes('search_files') || trimmed.includes('browser_') ||
      trimmed.includes('🔧') || trimmed.includes('⚙️')) {
    return 'tool_call'
  }
  
  // 思考中
  if (trimmed.includes('deliberating') || trimmed.includes('💭') || 
      trimmed.includes('thinking') || trimmed.includes('🤔')) {
    return 'thinking'
  }
  
  // Agent 输出（包含特定标记或长文本）
  if (trimmed.includes('[assistant]') || trimmed.includes('✅') || 
      trimmed.includes('完成') || trimmed.length > 50) {
    return 'agent_output'
  }
  
  return 'default'
}

// 渲染带颜色的输出块
function ColoredOutput({ output, timestamp }) {
  const CONTENT_COLORS = getThemeColors()
  const lines = output.split('\n')
  const groups = []
  let currentGroup = null
  
  lines.forEach((line, i) => {
    const type = parseLineType(line)
    const style = CONTENT_COLORS[type] || CONTENT_COLORS.default
    
    if (!currentGroup || currentGroup.type !== type) {
      currentGroup = { type, lines: [line], style }
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
        const style = group.style
        return (
          <div key={gi} style={{
            padding: '4px 8px',
            marginBottom: 2,
            background: style.bg,
            borderLeft: style.color !== 'var(--text-secondary)' ? `3px solid ${style.color}` : 'none',
            borderRadius: '0 4px 4px 0',
          }}>
            {style.icon && style.icon !== '📄' && (
              <span style={{ marginRight: 6, fontSize: 11 }}>{style.icon}</span>
            )}
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
  const [autoScroll, setAutoScroll] = useState(true)
  const outputRefs = useRef({})
  const userScrolledRef = useRef({})

  // 检测用户是否手动滚动
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
        // 追加模式：合并新数据到旧数据
        setAgents(prev => {
          return data.map(newAgent => {
            const oldAgent = prev.find(a => a.id === newAgent.id)
            if (!oldAgent) return { 
              ...newAgent, 
              history: newAgent.output ? [{ text: newAgent.output, time: new Date().toLocaleTimeString() }] : [] 
            }
            
            // 如果输出有变化，追加到历史
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
        // 首次加载：初始化历史
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

  // 自动滚动到底部（只在用户没手动滚动时）
  useEffect(() => {
    agents.forEach(agent => {
      if (autoScroll && !userScrolledRef.current[agent.id]) {
        const ref = outputRefs.current[agent.id]
        if (ref) {
          ref.scrollTop = ref.scrollHeight
        }
      }
    })
  }, [agents, autoScroll])

  const handleRefresh = () => {
    fetchDashboard(true)
  }

  const handleClear = (agentId) => {
    setAgents(prev => prev.map(a => 
      a.id === agentId ? { ...a, history: [] } : a
    ))
    userScrolledRef.current[agentId] = false
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

      {/* 颜色图例 */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 16,
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {Object.entries(getThemeColors()).filter(([k]) => k !== 'default').map(([key, style]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{ 
              width: 12, 
              height: 12, 
              borderRadius: 2, 
              background: style.color,
              display: 'inline-block',
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>{style.label}</span>
          </span>
        ))}
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
                <button
                  onClick={() => handleClear(agent.id)}
                  title="清除历史"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: '2px 6px',
                  }}
                >
                  🗑️
                </button>
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
                onScroll={() => handleScroll(agent.id)}
                style={{
                  padding: '12px 16px',
                  fontSize: 12,
                  lineHeight: 1.5,
                  overflowY: 'auto',
                  background: 'var(--bg-primary)',
                  flex: 1,
                }}
              >
                {(agent.history || []).length > 0 ? (
                  agent.history.map((entry, i) => (
                    <ColoredOutput 
                      key={i} 
                      output={entry.text} 
                      timestamp={entry.time}
                    />
                  ))
                ) : (
                  <span style={{ opacity: 0.5, color: 'var(--text-secondary)' }}>无输出</span>
                )}
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
