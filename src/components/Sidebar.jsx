import { useState, useRef, useEffect } from 'react'
import { gsap } from '../utils/animations'

const navTabs = [
  { id: 'chat', icon: '💬', label: '对话' },
  { id: 'tasks', icon: '📋', label: '任务' },
  { id: 'files', icon: '📁', label: '文件' },
  { id: 'dashboard', icon: '📊', label: '看板' },
]

function groupSessions(sessions) {
  const now = Date.now()
  const day = 86400000
  const groups = { '今天': [], '昨天': [], '最近7天': [], '更早': [] }

  sessions.forEach(s => {
    let updatedAt = s.updatedAt
    if (!updatedAt && s.time) {
      const match = s.time.match(/(\d+)\/(\d+)\s+(\d+):(\d+)/)
      if (match) {
        const [, month, day, hour, minute] = match
        const date = new Date()
        date.setMonth(parseInt(month) - 1)
        date.setDate(parseInt(day))
        date.setHours(parseInt(hour), parseInt(minute), 0, 0)
        updatedAt = date.getTime()
      }
    }
    if (!updatedAt) updatedAt = Date.now()

    const diff = now - updatedAt
    if (diff < day) groups['今天'].push(s)
    else if (diff < 2 * day) groups['昨天'].push(s)
    else if (diff < 7 * day) groups['最近7天'].push(s)
    else groups['更早'].push(s)
  })

  return Object.entries(groups).filter(([, list]) => list.length > 0)
}

export default function Sidebar({
  activeTab,
  onTabChange,
  onSettings,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onRefreshSessions,
  onToggleContext,
  onOpenSessionSearch,
  onOpenMessages,
  onOpenTasks,
  onOpenCollaboration,
}) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const sidebarRef = useRef(null)
  const editInputRef = useRef(null)

  useEffect(() => {
    if (sidebarRef.current) {
      gsap.to(sidebarRef.current, {
        width: expanded ? 280 : 60,
        duration: 0.3,
        ease: 'power2.inOut',
      })
    }
    if (expanded && onRefreshSessions) {
      onRefreshSessions()
    }
  }, [expanded])

  useEffect(() => {
    const close = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }
  }, [contextMenu])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const filtered = search.trim()
    ? sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions

  const grouped = groupSessions(filtered)

  const handleContextMenu = (e, session) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, session })
  }

  const handleStartRename = (session) => {
    setEditingId(session.id)
    setEditTitle(session.title)
    setContextMenu(null)
  }

  const handleConfirmRename = () => {
    if (editTitle.trim() && editingId) {
      onRenameSession(editingId, editTitle.trim())
    }
    setEditingId(null)
  }

  const handleClick = (e, tabId) => {
    gsap.to(e.currentTarget, {
      scale: 0.9, duration: 0.1, ease: 'power2.inOut',
      yoyo: true, repeat: 1,
    })
    onTabChange(tabId)
    if (tabId !== 'chat') setExpanded(false)
  }

  return (
    <aside
      ref={sidebarRef}
      className="glass-sidebar"
      style={{
        width: 60,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* 顶部区域 */}
      <div style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-md)',
            transition: 'var(--transition)',
          }}
          onClick={() => setExpanded(v => !v)}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            flexShrink: 0,
            boxShadow: '0 2px 8px var(--accent-glow)',
          }}>🤖</div>
          {expanded && (
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.3px',
            }}>
              AgentDesk
            </span>
          )}
        </div>

        {/* 新建会话 - 展开 */}
        {activeTab === 'chat' && expanded && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={onCreateSession}
              className="glass-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                fontSize: 13,
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              <span style={{ fontSize: 14 }}>✏️</span>
              新建对话
            </button>
            <button
              onClick={onOpenSessionSearch}
              title="搜索历史会话"
              className="glass-btn"
              style={{ padding: '8px 10px', fontSize: 14 }}
            >
              🔍
            </button>
          </div>
        )}

        {/* 新建会话 - 折叠 */}
        {activeTab === 'chat' && !expanded && (
          <button
            onClick={onCreateSession}
            title="新建对话"
            className="glass-btn"
            style={{
              width: 44, height: 36,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            ✏️
          </button>
        )}
      </div>

      {/* 搜索框 */}
      {activeTab === 'chat' && expanded && (
        <div style={{ padding: '0 8px 8px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索对话..."
            className="glass-input"
            style={{ width: '100%', padding: '7px 10px', fontSize: 13 }}
          />
        </div>
      )}

      {/* 会话列表 - 展开 */}
      {activeTab === 'chat' && expanded && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {grouped.length === 0 && (
            <div style={{
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: 12,
              padding: '20px 0',
              opacity: 0.6,
            }}>
              {search ? '没有匹配的对话' : '暂无对话历史'}
            </div>
          )}
          {grouped.map(([label, list]) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: 10,
                color: 'var(--text-secondary)',
                padding: '8px 6px 4px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1,
                opacity: 0.5,
              }}>
                {label}
              </div>
              {list.map(session => (
                <div
                  key={session.id}
                  onClick={() => { onSelectSession(session.id); onTabChange('chat') }}
                  onContextMenu={e => handleContextMenu(e, session)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: session.id === activeSessionId ? 'var(--accent-light)' : 'var(--text-primary)',
                    background: session.id === activeSessionId ? 'var(--glass-bg-hover)' : 'transparent',
                    border: session.id === activeSessionId ? '1px solid var(--glass-border-hover)' : '1px solid transparent',
                    marginBottom: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'var(--transition)',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (session.id !== activeSessionId)
                      e.currentTarget.style.background = 'var(--glass-bg)'
                  }}
                  onMouseLeave={e => {
                    if (session.id !== activeSessionId)
                      e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {editingId === session.id ? (
                    <input
                      ref={editInputRef}
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={handleConfirmRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirmRename()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="glass-input"
                      style={{ width: '100%', padding: '2px 6px', fontSize: 13, borderRadius: 6 }}
                    />
                  ) : (
                    session.title
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 折叠状态会话图标 */}
      {activeTab === 'chat' && !expanded && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          paddingTop: 8,
          overflowY: 'auto',
        }}>
          {sessions.slice(0, 8).map(s => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              title={s.title}
              style={{
                width: 36, height: 36,
                border: s.id === activeSessionId ? '1px solid var(--glass-border-hover)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                background: s.id === activeSessionId ? 'var(--glass-bg-hover)' : 'transparent',
                color: s.id === activeSessionId ? 'var(--accent-light)' : 'var(--text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition)',
              }}
            >
              💬
            </button>
          ))}
        </div>
      )}

      {activeTab !== 'chat' && <div style={{ flex: 1 }} />}

      {/* 导航标签 */}
      <div style={{
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: expanded ? 'stretch' : 'center',
      }}>
        {navTabs.map(tab => (
          <button
            key={tab.id}
            onClick={(e) => handleClick(e, tab.id)}
            title={tab.label}
            style={{
              width: expanded ? '100%' : 44,
              height: 40,
              border: activeTab === tab.id ? '1px solid rgba(108, 92, 231, 0.3)' : '1px solid transparent',
              borderRadius: 'var(--radius-md)',
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, var(--accent), var(--accent-light))'
                : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              fontSize: expanded ? 13 : 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: expanded ? 10 : 0,
              padding: expanded ? '0 12px' : 0,
              whiteSpace: 'nowrap',
              transition: 'var(--transition)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              boxShadow: activeTab === tab.id ? '0 2px 12px var(--accent-glow)' : 'none',
            }}
            onMouseEnter={e => {
              if (activeTab !== tab.id) e.currentTarget.style.background = 'var(--glass-bg)'
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: expanded ? 15 : 18 }}>{tab.icon}</span>
            {expanded && tab.label}
          </button>
        ))}
      </div>

      {/* 底部工具按钮 */}
      <div style={{
        padding: '4px 8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: expanded ? 'stretch' : 'center',
        borderTop: '1px solid var(--glass-border)',
        marginTop: 4,
      }}>
        {[
          { icon: '🔄', label: '协作流程', action: onOpenCollaboration },
          { icon: '💬', label: '消息中心', action: onOpenMessages },
          { icon: '📋', label: '任务管理', action: onOpenTasks },
        ].map((btn, i) => (
          <button
            key={i}
            title={btn.label}
            onClick={() => btn.action?.()}
            style={{
              width: expanded ? '100%' : 44,
              height: 36,
              border: '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: expanded ? 13 : 15,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: expanded ? 8 : 0,
              padding: expanded ? '0 12px' : 0,
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--glass-bg)'
              e.currentTarget.style.borderColor = 'var(--glass-border)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <span style={{ fontSize: expanded ? 14 : 15 }}>{btn.icon}</span>
            {expanded && btn.label}
          </button>
        ))}

        {/* 设置按钮 */}
        <button
          title="设置"
          onClick={() => onSettings?.()}
          style={{
            width: expanded ? '100%' : 44,
            height: 40,
            border: '1px solid transparent',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: expanded ? 14 : 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: expanded ? 'flex-start' : 'center',
            gap: expanded ? 10 : 0,
            padding: expanded ? '0 12px' : 0,
            transition: 'var(--transition)',
            marginTop: 4,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--glass-bg)'
            e.currentTarget.style.borderColor = 'var(--glass-border)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
          }}
        >
          <span style={{ fontSize: expanded ? 15 : 18 }}>⚙️</span>
          {expanded && '设置'}
        </button>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="glass-modal animate-fade-in"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            padding: '4px 0',
            zIndex: 1000,
            minWidth: 150,
          }}
        >
          <button
            onClick={() => handleStartRename(contextMenu.session)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ✏️ 重命名
          </button>
          <button
            onClick={() => { onDeleteSession(contextMenu.session.id); setContextMenu(null) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: 'var(--error)',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 83, 80, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            🗑️ 删除
          </button>
        </div>
      )}
    </aside>
  )
}
