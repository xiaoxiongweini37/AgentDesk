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
  const [selectedAgent, setSelectedAgent] = useState(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !selectedAgent) { setResults([]); return }
    setLoading(true)
    try {
      let url = `${API_BASE}/api/sessions/search?q=${encodeURIComponent(query)}`
      if (selectedAgent) url += `&agent=${selectedAgent}`
      const res = await fetch(url)
      setResults(await res.json())
    } catch (err) {
      console.error('搜索失败:', err)
      setResults([])
    }
    setLoading(false)
  }, [query, selectedAgent])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() || selectedAgent) handleSearch()
      else setResults([])
    }, 300)
    return () => clearTimeout(timer)
  }, [query, selectedAgent, handleSearch])

  const handleLoadFullSession = async (sessionId) => {
    setLoadingFull(true)
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/full`)
      setFullSession(await res.json())
      setSelectedSession(sessionId)
    } catch (err) {
      console.error('加载会话失败:', err)
      setFullSession(null)
    }
    setLoadingFull(false)
  }

  const handleUseSession = () => {
    if (fullSession && onLoadSession) { onLoadSession(fullSession); onClose() }
  }

  const getAgentName = (agentId) => (AGENTS.find(a => a.id === agentId)?.name || '总指挥')
  const getAgentIcon = (agentId) => (AGENTS.find(a => a.id === agentId)?.icon || '🎯')

  if (!isOpen) return null

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="glass-modal animate-slide-up"
        style={{
          padding: 24, width: 750, maxHeight: '80vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>🔍 搜索历史会话</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Agent 筛选器 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedAgent(null)}
            className={!selectedAgent ? 'glass-btn-primary' : 'glass-btn'}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12,
              border: 'none', cursor: 'pointer',
              fontWeight: !selectedAgent ? 600 : 400,
              color: !selectedAgent ? '#fff' : 'var(--text-secondary)',
            }}
          >全部</button>
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
              className={selectedAgent === agent.id ? 'glass-btn-primary' : 'glass-btn'}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12,
                border: 'none', cursor: 'pointer',
                fontWeight: selectedAgent === agent.id ? 600 : 400,
                color: selectedAgent === agent.id ? '#fff' : 'var(--text-secondary)',
              }}
            >{agent.icon} {agent.name}</button>
          ))}
        </div>

        {/* 搜索框 */}
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索会话标题或内容..."
          className="glass-input"
          style={{ width: '100%', marginBottom: 16, padding: '10px 14px', fontSize: 14 }}
          autoFocus
        />

        {/* 搜索结果 */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>搜索中...</div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13, opacity: 0.6 }}>
              {query.trim() || selectedAgent ? '没有找到匹配的会话' : '输入关键词或选择 Agent 搜索历史会话'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {results.map(session => (
                <div
                  key={session.id}
                  onClick={() => handleLoadFullSession(session.id)}
                  className="glass-card"
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-md)',
                    border: selectedSession === session.id ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                    background: selectedSession === session.id ? 'var(--accent-glow)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{getAgentIcon(session.agentId)}</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{session.title}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, padding: '2px 8px',
                      background: 'var(--glass-bg)', borderRadius: 12, color: 'var(--text-secondary)',
                    }}>{getAgentName(session.agentId)}</span>
                  </div>
                  {session.matchPreview && session.matchPreview !== session.title && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, opacity: 0.7 }}>
                      {session.matchPreview}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 12, opacity: 0.6 }}>
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
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{getAgentIcon(fullSession.agentId)}</span>
              <span>会话预览（{fullSession.userCount} 条用户消息，{fullSession.assistantCount} 条 AI 回复）</span>
              <span style={{ padding: '2px 8px', background: 'var(--glass-bg)', borderRadius: 12, fontSize: 11 }}>{getAgentName(fullSession.agentId)}</span>
            </div>
            <div className="glass-card" style={{ maxHeight: 200, overflowY: 'auto', padding: 12, borderRadius: 'var(--radius-md)' }}>
              {fullSession.messages.slice(0, 10).map((msg, i) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: msg.role === 'user' ? 'var(--accent-light)' : 'var(--text-primary)' }}>
                    {msg.role === 'user' ? '用户' : 'AI'}:
                  </span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>{msg.content.substring(0, 100)}...</span>
                </div>
              ))}
              {fullSession.messages.length > 10 && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6 }}>... 还有 {fullSession.messages.length - 10} 条消息</div>
              )}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="glass-btn" style={{ padding: '8px 16px', fontSize: 13 }}>取消</button>
          <button
            onClick={handleUseSession}
            disabled={!fullSession}
            className={fullSession ? 'glass-btn-primary' : 'glass-btn'}
            style={{
              padding: '8px 16px', border: 'none', fontSize: 13, fontWeight: 600,
              cursor: fullSession ? 'pointer' : 'not-allowed',
              color: fullSession ? '#fff' : 'var(--text-secondary)',
              opacity: fullSession ? 1 : 0.5,
            }}
          >加载此会话</button>
        </div>
      </div>
    </div>
  )
}
