import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:3001'

export default function SessionSearch({ isOpen, onClose, onLoadSession }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [fullSession, setFullSession] = useState(null)
  const [loadingFull, setLoadingFull] = useState(false)

  // 搜索会话
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/sessions/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data)
    } catch (err) {
      console.error('搜索失败:', err)
      setResults([])
    }
    setLoading(false)
  }, [query])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        handleSearch()
      } else {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, handleSearch])

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
        width: 700,
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
              {query.trim() ? '没有找到匹配的会话' : '输入关键词搜索历史会话'}
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
                    fontWeight: 500,
                    color: selectedSession === session.id ? 'var(--bg-primary)' : 'var(--text-primary)',
                    marginBottom: 4,
                  }}>
                    {session.title}
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
            }}>
              会话预览（{fullSession.userCount} 条用户消息，{fullSession.assistantCount} 条 AI 回复）
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
