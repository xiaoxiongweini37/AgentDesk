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
    // 尝试解析时间字符串
    let updatedAt = s.updatedAt
    if (!updatedAt && s.time) {
      // 解析 "6/10 14:18" 格式
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
}) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const sidebarRef = useRef(null)
  const editInputRef = useRef(null)

  // 展开/折叠动画
  useEffect(() => {
    if (sidebarRef.current) {
      gsap.to(sidebarRef.current, {
        width: expanded ? 280 : 60,
        duration: 0.3,
        ease: 'power2.inOut',
      })
    }
    // 展开时刷新会话列表
    if (expanded && onRefreshSessions) {
      onRefreshSessions()
    }
  }, [expanded])

  // 点击外部关闭右键菜单
  useEffect(() => {
    const close = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }
  }, [contextMenu])

  // 编辑标题时聚焦
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
      style={{
        width: 60,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* 顶部区域 */}
      <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Logo + 展开按钮 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          padding: '4px',
          borderRadius: 'var(--radius)',
        }}
          onClick={() => setExpanded(v => !v)}
        >
          <span style={{ fontSize: 22, flexShrink: 0, textAlign: 'center', width: 28 }}>🤖</span>
          {expanded && (
            <span style={{
              fontSize: 15,
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}>
              AgentDesk
            </span>
          )}
        </div>

        {/* 新建会话按钮 - 仅 chat tab 且展开时显示 */}
        {activeTab === 'chat' && expanded && (
          <button
            onClick={onCreateSession}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 16 }}>✏️</span>
            新建对话
          </button>
        )}
        {/* 折叠状态下的新建按钮 */}
        {activeTab === 'chat' && !expanded && (
          <button
            onClick={onCreateSession}
            title="新建对话"
            style={{
              width: 44, height: 36,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
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

      {/* 搜索框 - 仅展开且在 chat tab 时 */}
      {activeTab === 'chat' && expanded && (
        <div style={{ padding: '0 8px 8px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索对话..."
            style={{
              width: '100%',
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* 会话列表 - 仅展开且在 chat tab 时 */}
      {activeTab === 'chat' && expanded && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 8px',
        }}>
          {grouped.length === 0 && (
            <div style={{
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: 12,
              padding: '20px 0',
            }}>
              {search ? '没有匹配的对话' : '暂无对话历史'}
            </div>
          )}
          {grouped.map(([label, list]) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                padding: '6px 4px 2px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {label}
              </div>
              {list.map(session => (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id)
                    onTabChange('chat')
                  }}
                  onContextMenu={e => handleContextMenu(e, session)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: session.id === activeSessionId
                      ? 'var(--accent)'
                      : 'var(--text-primary)',
                    background: session.id === activeSessionId
                      ? 'var(--bg-card)'
                      : 'transparent',
                    marginBottom: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (session.id !== activeSessionId)
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
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
                      style={{
                        width: '100%',
                        padding: '2px 4px',
                        border: '1px solid var(--accent)',
                        borderRadius: 4,
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        outline: 'none',
                      }}
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

      {/* chat tab 折叠状态：显示会话数 */}
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
                border: 'none',
                borderRadius: 'var(--radius)',
                background: s.id === activeSessionId ? 'var(--bg-card)' : 'transparent',
                color: s.id === activeSessionId ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              💬
            </button>
          ))}
        </div>
      )}

      {/* 非 chat tab 时，中间留空 */}
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
              border: 'none',
              borderRadius: 'var(--radius)',
              background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
              fontSize: expanded ? 14 : 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: expanded ? 10 : 0,
              padding: expanded ? '0 12px' : 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: expanded ? 16 : 20 }}>{tab.icon}</span>
            {expanded && tab.label}
          </button>
        ))}
      </div>

      {/* 设置按钮 */}
      <div style={{ padding: '4px 8px 12px', display: 'flex', justifyContent: expanded ? 'stretch' : 'center' }}>
        <button
          title="设置"
          onClick={() => onSettings?.()}
          style={{
            width: expanded ? '100%' : 44,
            height: 40,
            border: 'none',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: expanded ? 14 : 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: expanded ? 'flex-start' : 'center',
            gap: expanded ? 10 : 0,
            padding: expanded ? '0 12px' : 0,
          }}
        >
          <span style={{ fontSize: expanded ? 16 : 20 }}>⚙️</span>
          {expanded && '设置'}
        </button>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '4px 0',
            zIndex: 1000,
            minWidth: 140,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <button
            onClick={() => handleStartRename(contextMenu.session)}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ✏️ 重命名
          </button>
          <button
            onClick={() => {
              onDeleteSession(contextMenu.session.id)
              setContextMenu(null)
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: 'var(--error)',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            🗑️ 删除
          </button>
        </div>
      )}
    </aside>
  )
}
