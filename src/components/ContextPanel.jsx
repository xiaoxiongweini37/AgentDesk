import { useState, useEffect } from 'react'
import FileBrowser from './FileBrowser'

const API_BASE = 'http://localhost:3001'

export default function ContextPanel({ sessionId, onClose }) {
  const [activeSection, setActiveSection] = useState('context')
  const [contextData, setContextData] = useState(null)
  const [mounts, setMounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMountModal, setShowMountModal] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [browseMode, setBrowseMode] = useState('both')

  useEffect(() => {
    if (!sessionId) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const msgRes = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`)
        if (msgRes.ok) {
          const messages = await msgRes.json()
          setContextData(analyzeContext(messages))
        }
        const mountRes = await fetch(`${API_BASE}/api/mounts?session=${sessionId}`)
        if (mountRes.ok) setMounts(await mountRes.json())
      } catch (err) {
        console.error('Failed to fetch context:', err)
      }
      setLoading(false)
    }
    fetchData()
  }, [sessionId])

  const analyzeContext = (messages) => {
    const files = new Set()
    const tools = new Set()
    let currentDir = '/home/jinzhong'
    let totalTokens = 0
    messages.forEach(msg => {
      const content = msg.content || ''
      const fileMatches = content.match(/(?:\/mnt\/[^\s"'`]+|\/home\/[^\s"'`]+|~\/[^\s"'`]+)/g)
      if (fileMatches) fileMatches.forEach(f => files.add(f.split('/').pop()))
      const toolMatch = content.match(/(?:using|calling|executing)\s+(\w+)/i)
      if (toolMatch) tools.add(toolMatch[1])
      totalTokens += Math.ceil(content.length / 4)
    })
    return {
      files: Array.from(files).slice(0, 20),
      tools: Array.from(tools),
      currentDir,
      totalTokens,
      messageCount: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
    }
  }

  const handleAddMount = async (selectedPath) => {
    if (!selectedPath) return
    try {
      const res = await fetch(`${API_BASE}/api/mounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, path: selectedPath }),
      })
      if (res.ok) {
        const result = await res.json()
        if (result.error) alert(result.error)
        else setMounts(prev => [...prev, result.mount])
      }
    } catch (err) { console.error('Failed to add mount:', err) }
  }

  const handleRemoveMount = async (mountId) => {
    try {
      await fetch(`${API_BASE}/api/mounts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, mount_id: mountId }),
      })
      setMounts(prev => prev.filter(m => m.id !== mountId))
    } catch (err) { console.error('Failed to remove mount:', err) }
  }

  return (
    <div
      className="glass-sidebar"
      style={{
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        borderLeft: '1px solid var(--glass-border)',
      }}
    >
      {/* 顶部标签 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {['context', 'progress'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              style={{
                background: 'none',
                border: 'none',
                color: activeSection === tab ? 'var(--accent-light)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeSection === tab ? 600 : 400,
                borderBottom: activeSection === tab ? '2px solid var(--accent)' : '2px solid transparent',
                paddingBottom: 4,
                transition: 'var(--transition)',
              }}
            >
              {tab === 'context' ? 'Context' : 'Progress'}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontSize: 14, padding: '2px 6px', borderRadius: 6,
            transition: 'var(--transition)',
          }}
        >✕</button>
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20, fontSize: 13 }}>加载中...</div>
        ) : activeSection === 'context' ? (
          <ContextContent
            data={contextData}
            mounts={mounts}
            onAddMount={() => setShowMountModal(true)}
            onRemoveMount={handleRemoveMount}
            onBrowseFile={() => { setBrowseMode('file'); setShowFileBrowser(true) }}
            onBrowseFolder={() => { setBrowseMode('directory'); setShowFileBrowser(true) }}
          />
        ) : (
          <ProgressContent data={contextData} />
        )}
      </div>

      <FileBrowser
        isOpen={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelect={handleAddMount}
        mode={browseMode}
      />
    </div>
  )
}

function ContextContent({ data, mounts, onAddMount, onRemoveMount, onBrowseFile, onBrowseFolder }) {
  if (!data) return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>无数据</div>

  return (
    <div>
      <Section title="挂载文件" icon="📁">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {mounts.map(mount => (
            <div key={mount.id} className="glass-card" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{ fontSize: 14 }}>{mount.type === 'directory' ? '📂' : '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mount.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mount.path}
                </div>
              </div>
              <button onClick={() => onRemoveMount(mount.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }} title="移除挂载">✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onBrowseFolder} className="glass-btn" style={{ flex: 1, padding: '8px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            📁 挂载文件夹
          </button>
          <button onClick={onBrowseFile} className="glass-btn" style={{ flex: 1, padding: '8px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            📄 挂载文件
          </button>
        </div>
      </Section>

      <Section title="使用的工具" icon="🔧" style={{ marginTop: 20 }}>
        {data.tools.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.tools.map((tool, i) => (
              <span key={i} style={{
                padding: '4px 10px',
                background: 'rgba(255, 167, 38, 0.1)',
                border: '1px solid rgba(255, 167, 38, 0.2)',
                borderRadius: 20,
                fontSize: 11,
                color: 'var(--warning)',
              }}>{tool}</span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0', opacity: 0.6 }}>暂无工具调用记录</div>
        )}
      </Section>

      <Section title="工作目录" icon="📂" style={{ marginTop: 20 }}>
        <div className="glass-card" style={{
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          borderRadius: 'var(--radius-sm)',
        }}>
          {data.currentDir}
        </div>
      </Section>
    </div>
  )
}

function ProgressContent({ data }) {
  if (!data) return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>无数据</div>
  const tokenPercent = Math.min(100, (data.totalTokens / 1000000) * 100)

  return (
    <div>
      <Section title="会话统计" icon="📊">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatCard label="总消息" value={data.messageCount} icon="💬" />
          <StatCard label="用户消息" value={data.userMessages} icon="👤" />
          <StatCard label="AI回复" value={data.assistantMessages} icon="🤖" />
          <StatCard label="关联文件" value={data.files.length} icon="📎" />
        </div>
      </Section>

      <Section title="Token 使用" icon="⚡" style={{ marginTop: 20 }}>
        <div className="glass-card" style={{ padding: 12, borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>本次对话</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{data.totalTokens.toLocaleString()} tokens</span>
          </div>
          <div style={{ height: 6, background: 'var(--glass-bg)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${tokenPercent}%`, height: '100%',
              background: tokenPercent > 80 ? 'var(--error)' : tokenPercent > 50 ? 'var(--warning)' : 'var(--accent)',
              borderRadius: 3, transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, opacity: 0.7 }}>
            {tokenPercent.toFixed(1)}% of 1M context
          </div>
        </div>
      </Section>

      {data.tools.length > 0 && (
        <Section title="工具使用" icon="🔧" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.tools.map((tool, i) => (
              <div key={i} className="glass-card" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{tool}</span>
                <span style={{ fontSize: 11, color: 'var(--accent-light)', opacity: 0.7 }}>已调用</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="glass-card" style={{ padding: 10, textAlign: 'center', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>{label}</div>
    </div>
  )
}

function Section({ title, icon, children, style = {} }) {
  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}
