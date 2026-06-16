import { useState, useEffect } from 'react'
import FileBrowser from './FileBrowser'

const API_BASE = 'http://localhost:3001'

export default function ContextPanel({ sessionId, onClose }) {
  const [activeSection, setActiveSection] = useState('context')
  const [contextData, setContextData] = useState(null)
  const [mounts, setMounts] = useState([])
  const [workDir, setWorkDir] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showMountModal, setShowMountModal] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [showWorkDirBrowser, setShowWorkDirBrowser] = useState(false)
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
        const workdirRes = await fetch(`${API_BASE}/api/workdir?session=${sessionId}`)
        if (workdirRes.ok) setWorkDir(await workdirRes.json())
      } catch (err) {
        console.error('Failed to fetch context:', err)
      }
      setLoading(false)
    }
    fetchData()
  }, [sessionId])

  const analyzeContext = (messages) => {
    const files = new Set()
    const toolCounts = {}
    let currentDir = '/home/jinzhong'
    let totalTokens = 0
    let firstTimestamp = null
    let lastTimestamp = null

    messages.forEach(msg => {
      const content = msg.content || ''

      // 提取文件路径
      const fileMatches = content.match(/(?:\/mnt\/[^\s"'`]+|\/home\/[^\s"'`]+|~\/[^\s"'`]+)/g)
      if (fileMatches) fileMatches.forEach(f => files.add(f.split('/').pop()))

      // 提取工具调用（统计次数）
      const toolMatches = content.match(/(?:using|calling|executing)\s+(\w+)/gi)
      if (toolMatches) {
        toolMatches.forEach(tc => {
          const tool = tc.split(/\s+/)[1].toLowerCase()
          toolCounts[tool] = (toolCounts[tool] || 0) + 1
        })
      }

      // 更准确的 token 估算（中文 1 token ≈ 2 字符，英文 1 token ≈ 4 字符）
      const chineseChars = (content.match(/[一-龥]/g) || []).length
      const otherChars = content.length - chineseChars
      totalTokens += Math.ceil(chineseChars / 2 + otherChars / 4)

      // 时间戳
      if (msg.timestamp) {
        const ts = new Date(msg.timestamp)
        if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts
        if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts
      }
    })

    // 计算会话时长（分钟）
    const durationMinutes = firstTimestamp && lastTimestamp
      ? Math.round((lastTimestamp - firstTimestamp) / 60000)
      : 0

    // 工具统计（按调用次数排序）
    const tools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))

    return {
      files: Array.from(files).slice(0, 20),
      tools,
      currentDir,
      totalTokens,
      messageCount: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      durationMinutes,
      toolCallsTotal: Object.values(toolCounts).reduce((a, b) => a + b, 0),
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

  const handleSetWorkDir = async (selectedPath) => {
    if (!selectedPath) return
    try {
      const res = await fetch(`${API_BASE}/api/workdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, path: selectedPath }),
      })
      if (res.ok) {
        const result = await res.json()
        if (result.error) alert(result.error)
        else setWorkDir(result)
      }
    } catch (err) { console.error('Failed to set workdir:', err) }
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
            workDir={workDir}
            onAddMount={() => setShowMountModal(true)}
            onRemoveMount={handleRemoveMount}
            onBrowseFile={() => { setBrowseMode('file'); setShowFileBrowser(true) }}
            onBrowseFolder={() => { setBrowseMode('directory'); setShowFileBrowser(true) }}
            onChangeWorkDir={() => setShowWorkDirBrowser(true)}
          />
        ) : (
          <ProgressContent data={contextData} sessionId={sessionId} />
        )}
      </div>

      <FileBrowser
        isOpen={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelect={handleAddMount}
        mode={browseMode}
      />

      <FileBrowser
        isOpen={showWorkDirBrowser}
        onClose={() => setShowWorkDirBrowser(false)}
        onSelect={handleSetWorkDir}
        mode="directory"
      />
    </div>
  )
}

function ContextContent({ data, mounts, workDir, onAddMount, onRemoveMount, onBrowseFile, onBrowseFolder, onChangeWorkDir }) {
  if (!data) return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>无数据</div>

  return (
    <div>
      {/* 工作目录 */}
      <Section title="工作目录" icon="📂">
        <div className="glass-card" style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {workDir?.path || data.currentDir}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, opacity: 0.7 }}>
              Agent 会话的实际工作目录
            </div>
          </div>
          <button
            onClick={onChangeWorkDir}
            className="glass-btn-ghost"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              borderRadius: 'var(--radius-sm)',
              whiteSpace: 'nowrap',
            }}
          >
            切换
          </button>
        </div>
      </Section>

      {/* 挂载文件 */}
      <Section title="挂载文件" icon="📎" style={{ marginTop: 16 }}>
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
              }}>{tool.name} ({tool.count})</span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0', opacity: 0.6 }}>暂无工具调用记录</div>
        )}
      </Section>
    </div>
  )
}

function ProgressContent({ data, sessionId }) {
  if (!data) return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>无数据</div>
  const tokenPercent = Math.min(100, (data.totalTokens / 1000000) * 100)
  const [compressionInfo, setCompressionInfo] = useState(null)
  const [compressing, setCompressing] = useState(false)

  // 加载压缩状态
  useEffect(() => {
    if (!sessionId) return
    const fetchCompression = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/sessions/${sessionId}/compression`)
        if (res.ok) {
          const info = await res.json()
          setCompressionInfo(info)
        }
      } catch (err) {
        console.error('获取压缩状态失败:', err)
      }
    }
    fetchCompression()
  }, [sessionId])

  // 手动压缩
  const handleCompress = async () => {
    if (!sessionId || compressing) return
    setCompressing(true)
    try {
      const res = await fetch(`http://localhost:3001/api/sessions/${sessionId}/compress`, {
        method: 'POST',
      })
      const result = await res.json()
      if (result.compressed) {
        alert(`✅ 压缩完成！\n消息数: ${result.before} → ${result.after}\n使用率: ${result.usageBefore?.toFixed(1)}% → ${result.usageAfter?.toFixed(1)}%`)
        // 刷新压缩状态
        const infoRes = await fetch(`http://localhost:3001/api/sessions/${sessionId}/compression`)
        if (infoRes.ok) setCompressionInfo(await infoRes.json())
      } else {
        alert(`ℹ️ ${result.message || '不需要压缩'}`)
      }
    } catch (err) {
      alert(`❌ 压缩失败: ${err.message}`)
    }
    setCompressing(false)
  }

  return (
    <div>
      <Section title="会话统计" icon="📊">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatCard label="总消息" value={data.messageCount} icon="💬" />
          <StatCard label="用户消息" value={data.userMessages} icon="👤" />
          <StatCard label="AI回复" value={data.assistantMessages} icon="🤖" />
          <StatCard label="会话时长" value={`${data.durationMinutes}分`} icon="⏱️" />
        </div>
      </Section>

      <Section title="Token 使用" icon="⚡" style={{ marginTop: 16 }}>
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

        {/* 压缩状态和控制 */}
        <div className="glass-card" style={{ padding: 12, borderRadius: 'var(--radius-sm)', marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>上下文压缩</span>
            <button
              onClick={handleCompress}
              disabled={compressing}
              className="glass-btn"
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              {compressing ? '压缩中...' : '🗜️ 手动压缩'}
            </button>
          </div>
          {compressionInfo ? (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>状态: {compressionInfo.compressed ? '✅ 已压缩' : '⏳ 未压缩'}</div>
              {compressionInfo.compressionCount > 0 && (
                <div>压缩次数: {compressionInfo.compressionCount}</div>
              )}
              {compressionInfo.lastCompressed && (
                <div>上次压缩: {new Date(compressionInfo.lastCompressed).toLocaleString()}</div>
              )}
              <div>压缩阈值: {compressionInfo.threshold}%</div>
              {tokenPercent > compressionInfo.threshold && (
                <div style={{ color: 'var(--warning)', marginTop: 4 }}>
                  ⚠️ 当前使用率 ({tokenPercent.toFixed(1)}%) 已超过阈值，建议压缩
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7 }}>
              加载中...
            </div>
          )}
        </div>
      </Section>

      {data.tools.length > 0 && (
        <Section title="工具使用" icon="🔧" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.tools.map((tool, i) => (
              <div key={i} className="glass-card" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{tool.name}</span>
                <span style={{ fontSize: 11, color: 'var(--accent-light)', opacity: 0.7 }}>{tool.count} 次</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>
            共 {data.toolCallsTotal} 次调用
          </div>
        </Section>
      )}

      {data.files.length > 0 && (
        <Section title="关联文件" icon="📎" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.files.slice(0, 10).map((file, i) => (
              <span key={i} style={{
                padding: '3px 8px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 12,
                fontSize: 10,
                color: 'var(--text-secondary)',
              }}>📄 {file}</span>
            ))}
            {data.files.length > 10 && (
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>
                +{data.files.length - 10} 更多
              </span>
            )}
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
