import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:3001'

const AGENTS = [
  { id: 'commander', name: '总指挥', icon: '🎯' },
  { id: 'worker', name: 'A号', icon: '⚡' },
  { id: 'coder-b', name: 'B号', icon: '🔧' },
  { id: 'coder-c', name: 'C号', icon: '🧪' },
]

export default function SessionSearch({ isOpen, onClose, onLoadSession }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [fullSession, setFullSession] = useState(null)
  const [loadingFull, setLoadingFull] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null) // null = 全部

  // 搜索会话
  const handleSearch = useCallback(async () => {
    if (!query.trim() && !selectedAgent) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      let url = `${API_BASE}/api/sessions/search?q=${encodeURIComponent(query)}`
      if (selectedAgent) {
        url += `&agent=${selectedAgent}`
      }
      const res = await fetch(url)
      const data = await res.json()
      setResults(data)
    } catch (err) {
      console.error('搜索失败:', err)
      setResults([])
    }
    setLoading(false)
  }, [query, selectedAgent])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() || selectedAgent) {
        handleSearch()
      } else {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, selectedAgent, handleSearch])

  // 加载完整会话
  const handleLoadFullSession = async (sessionId) => {
    setLoadingFull(true)
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/full`)
      const data = await res.json()
      setFullSession(data)
      setSelectedSession(sessionId)
    } catch (err) {
      console.error('加载会话失败:', err)
      setFullSession(null)
    }
    setLoadingFull(false)
  }

  // 使用会话
  const handleUseSession = () => {
    if (fullSession && onLoadSession) {
      onLoadSession(fullSession)
      onClose()
    }
  }

  // 获取 Agent 名称
  const getAgentName = (agentId) => {
    const agent = AGENTS.find(a => a.id === agentId)
    return agent ? agent.name : '总指挥'
  }

  const getAgentIcon = (agentId) => {
    const agent = AGENTS.find(a => a.id === agentId)
    return agent ? agent.icon : '🎯'
  }

  if (!isOpen) return null

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
        width: 750,
        maxHeight: '80vh',
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
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>🔍 搜索历史会话</h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 20,
            cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Agent 筛选器 */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setSelectedAgent(null)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: !selectedAgent ? 'var(--accent)' : 'var(--bg-secondary)',
              color: !selectedAgent ? 'var(--bg-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: !selectedAgent ? 'bold' : 'normal',
            }}
          >
            全部
          </button>
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: selectedAgent === agent.id ? 'var(--accent)' : 'var(--bg-secondary)',
                color: selectedAgent === agent.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: selectedAgent === agent.id ? 'bold' : 'normal',
              }}
            >
              {agent.icon} {agent.name}
            </button>
          ))}
        </div>

        {/* 搜索框 */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
        }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索会话标题或内容..."
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
            }}
            autoFocus
          />
        </div>

        {/* 搜索结果 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: 16,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>
              搜索中...
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>
              {query.trim() || selectedAgent ? '没有找到匹配的会话' : '输入关键词或选择 Agent 搜索历史会话'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map(session => (
                <div
                  key={session.id}
                  onClick={() => handleLoadFullSession(session.id)}
                  style={{
                    padding: '12px 16px',
                    background: selectedSession === session.id ? 'var(--accent)' : 'var(--bg-secondary)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    border: selectedSession === session.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 14 }}>
                      {getAgentIcon(session.agentId)}
                    </span>
                    <span style={{
                      fontWeight: 500,
                      color: selectedSession === session.id ? 'var(--bg-primary)' : 'var(--text-primary)',
                    }}>
                      {session.title}
                    </span>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      padding: '2px 6px',
                      background: 'var(--bg-primary)',
                      borderRadius: 4,
                      color: 'var(--text-secondary)',
                    }}>
                      {getAgentName(session.agentId)}
                    </span>
                  </div>
                  {session.matchPreview && session.matchPreview !== session.title && (
                    <div style={{
                      fontSize: 12,
                      color: selectedSession === session.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      marginBottom: 4,
                      opacity: 0.8,
                    }}>
                      {session.matchPreview}
                    </div>
                  )}
                  <div style={{
                    fontSize: 11,
                    color: selectedSession === session.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    gap: 12,
                  }}>
                    <span>{session.messageCount} 条消息</span>
                    <span>{session.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 完整会话预览 */}
        {selectedSession && fullSession && (
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 16,
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>{getAgentIcon(fullSession.agentId)}</span>
              <span>
                会话预览（{fullSession.userCount} 条用户消息，{fullSession.assistantCount} 条 AI 回复）
              </span>
              <span style={{
                padding: '2px 8px',
                background: 'var(--bg-secondary)',
                borderRadius: 4,
                fontSize: 11,
              }}>
                {getAgentName(fullSession.agentId)}
              </span>
            </div>
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              padding: 12,
            }}>
              {fullSession.messages.slice(0, 10).map((msg, i) => (
                <div key={i} style={{
                  marginBottom: 8,
                  fontSize: 12,
                }}>
                  <span style={{
                    fontWeight: 500,
                    color: msg.role === 'user' ? 'var(--accent)' : 'var(--text-primary)',
                  }}>
                    {msg.role === 'user' ? '用户' : 'AI'}:
                  </span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>
                    {msg.content.substring(0, 100)}...
                  </span>
                </div>
              ))}
              {fullSession.messages.length > 10 && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  ... 还有 {fullSession.messages.length - 10} 条消息
                </div>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}>
            取消
          </button>
          <button
            onClick={handleUseSession}
            disabled={!fullSession}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: fullSession ? 'var(--accent)' : 'var(--border)',
              color: fullSession ? 'var(--bg-primary)' : 'var(--text-secondary)',
              cursor: fullSession ? 'pointer' : 'not-allowed',
            }}
          >
            加载此会话
          </button>
        </div>
      </div>
    </div>
  )
}
