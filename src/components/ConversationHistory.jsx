import { useState, useEffect } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

export default function ConversationHistory({ isOpen, onToggle, onSelectSession }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/sessions`)
      const data = await res.json()
      setSessions(data)
      if (data.length > 0 && !activeId) {
        setActiveId(data[0].id)
      }
    } catch (err) {
      console.error('获取会话列表失败:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      fetchSessions()
    }
  }, [isOpen])

  const handleSelect = (session) => {
    setActiveId(session.id)
    onSelectSession?.(session)
  }

  const handleToggle = () => {
    onToggle?.()
    gsap.to('.conversation-sidebar', {
      width: isOpen ? 0 : 260,
      duration: 0.3,
      ease: 'power2.inOut',
    })
  }

  return (
    <div 
      className="conversation-sidebar"
      style={{
        width: isOpen ? 260 : 0,
        overflow: 'hidden',
        borderRight: isOpen ? '1px solid var(--border)' : 'none',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
      }}
    >
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          color: 'var(--text-primary)' 
        }}>
          📋 会话历史
        </span>
        <button
          onClick={handleToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '2px 6px',
            borderRadius: 4,
          }}
          title="收起"
        >
          ✕
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
      }}>
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 20, 
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}>
            加载中...
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 20, 
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}>
            暂无会话记录
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              onClick={() => handleSelect(session)}
              style={{
                padding: '10px 12px',
                marginBottom: 4,
                borderRadius: 'var(--radius)',
                background: activeId === session.id ? 'var(--accent)' : 'transparent',
                color: activeId === session.id ? 'var(--bg-primary)' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 13,
                lineHeight: 1.4,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (activeId !== session.id) {
                  e.currentTarget.style.background = 'var(--bg-card)'
                }
              }}
              onMouseLeave={(e) => {
                if (activeId !== session.id) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <div style={{ 
                fontWeight: 500, 
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {session.title || '未命名会话'}
              </div>
              <div style={{ 
                fontSize: 11, 
                opacity: 0.7,
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>{session.messageCount} 条消息</span>
                <span>{session.time}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => {
            setActiveId(null)
            onSelectSession?.(null)
          }}
          style={{
            width: '100%',
            padding: '8px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: 'var(--bg-primary)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          ➕ 新会话
        </button>
      </div>
    </div>
  )
}
