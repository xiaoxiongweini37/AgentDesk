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

  // 获取上下文数据和挂载
  useEffect(() => {
    if (!sessionId) return
    
    const fetchData = async () => {
      setLoading(true)
      try {
        // 获取会话消息
        const msgRes = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`)
        if (msgRes.ok) {
          const messages = await msgRes.json()
          const data = analyzeContext(messages)
          setContextData(data)
        }
        
        // 获取挂载列表
        const mountRes = await fetch(`${API_BASE}/api/mounts?session=${sessionId}`)
        if (mountRes.ok) {
          const mountData = await mountRes.json()
          setMounts(mountData)
        }
      } catch (err) {
        console.error('Failed to fetch context:', err)
      }
      setLoading(false)
    }
    
    fetchData()
  }, [sessionId])

  // 分析上下文
  const analyzeContext = (messages) => {
    const files = new Set()
    const tools = new Set()
    let currentDir = '/home/jinzhong'
    let totalTokens = 0
    
    messages.forEach(msg => {
      const content = msg.content || ''
      
      // 提取文件路径
      const fileMatches = content.match(/(?:\/mnt\/[^\s"'`]+|\/home\/[^\s"'`]+|~\/[^\s"'`]+)/g)
      if (fileMatches) {
        fileMatches.forEach(f => files.add(f.split('/').pop()))
      }
      
      // 提取工具调用
      const toolMatch = content.match(/(?:using|calling|executing)\s+(\w+)/i)
      if (toolMatch) {
        tools.add(toolMatch[1])
      }
      
      // 估算token
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

  // 添加挂载
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
        if (result.error) {
          alert(result.error)
        } else {
          setMounts(prev => [...prev, result.mount])
        }
      }
    } catch (err) {
      console.error('Failed to add mount:', err)
    }
  }

  // 移除挂载
  const handleRemoveMount = async (mountId) => {
    try {
      await fetch(`${API_BASE}/api/mounts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, mount_id: mountId }),
      })
      setMounts(prev => prev.filter(m => m.id !== mountId))
    } catch (err) {
      console.error('Failed to remove mount:', err)
    }
  }

  return (
    <div style={{
      width: 280,
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* 顶部标签 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => setActiveSection('context')}
            style={{
              background: 'none',
              border: 'none',
              color: activeSection === 'context' ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeSection === 'context' ? 600 : 400,
              borderBottom: activeSection === 'context' ? '2px solid var(--accent)' : 'none',
              paddingBottom: 4,
            }}
          >
            Context
          </button>
          <button
            onClick={() => setActiveSection('progress')}
            style={{
              background: 'none',
              border: 'none',
              color: activeSection === 'progress' ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeSection === 'progress' ? 600 : 400,
              borderBottom: activeSection === 'progress' ? '2px solid var(--accent)' : 'none',
              paddingBottom: 4,
            }}
          >
            Progress
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>

      {/* 内容区域 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 20 }}>
            加载中...
          </div>
        ) : activeSection === 'context' ? (
          <ContextContent 
            data={contextData} 
            mounts={mounts}
            onAddMount={() => setShowMountModal(true)}
            onRemoveMount={handleRemoveMount}
          />
        ) : (
          <ProgressContent data={contextData} />
        )}
      </div>

      {/* 文件浏览器 */}
      <FileBrowser
        isOpen={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelect={handleAddMount}
        mode={browseMode}
      />
    </div>
  )
}

function ContextContent({ data, mounts, onAddMount, onRemoveMount }) {
  if (!data) return <div style={{ color: 'var(--text-secondary)' }}>无数据</div>
  
  return (
    <div>
      {/* 挂载文件 */}
      <Section title="挂载文件" icon="📁">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {mounts.map((mount) => (
            <div key={mount.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 14 }}>
                {mount.type === 'directory' ? '📂' : '📄'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {mount.name}
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {mount.path}
                </div>
              </div>
              <button
                onClick={() => onRemoveMount(mount.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: '2px 4px',
                }}
                title="移除挂载"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => {
            setBrowseMode('directory')
            setShowFileBrowser(true)
          }} style={{
            flex: 1,
            padding: '8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}>
            📁 挂载文件夹
          </button>
          <button onClick={() => {
            setBrowseMode('file')
            setShowFileBrowser(true)
          }} style={{
            flex: 1,
            padding: '8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}>
            📄 挂载文件
          </button>
        </div>
      </Section>

      {/* 关联文件 */}
      <Section title="关联文件" icon="📎" style={{ marginTop: 20 }}>
        {data.files.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.files.map((file, i) => (
              <div key={i} style={{
                padding: '6px 10px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                fontSize: 12,
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                📄 {file}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '12px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
            <div>暂无关联文件</div>
          </div>
        )}
      </Section>

      {/* 使用的工具 */}
      <Section title="使用的工具" icon="🔧" style={{ marginTop: 20 }}>
        {data.tools.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.tools.map((tool, i) => (
              <span key={i} style={{
                padding: '4px 8px',
                background: 'rgba(255,152,0,0.1)',
                border: '1px solid rgba(255,152,0,0.3)',
                borderRadius: 12,
                fontSize: 11,
                color: '#ff9800',
              }}>
                {tool}
              </span>
            ))}
          </div>
        ) : (
          <div style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            padding: '8px 0',
          }}>
            暂无工具调用记录
          </div>
        )}
      </Section>

      {/* 工作目录 */}
      <Section title="工作目录" icon="📂" style={{ marginTop: 20 }}>
        <div style={{
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontFamily: 'monospace',
        }}>
          {data.currentDir}
        </div>
      </Section>
    </div>
  )
}

function ProgressContent({ data }) {
  if (!data) return <div style={{ color: 'var(--text-secondary)' }}>无数据</div>
  
  const tokenPercent = Math.min(100, (data.totalTokens / 1000000) * 100)
  
  return (
    <div>
      {/* 会话统计 */}
      <Section title="会话统计" icon="📊">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}>
          <StatCard label="总消息" value={data.messageCount} icon="💬" />
          <StatCard label="用户消息" value={data.userMessages} icon="👤" />
          <StatCard label="AI回复" value={data.assistantMessages} icon="🤖" />
          <StatCard label="关联文件" value={data.files.length} icon="📎" />
        </div>
      </Section>

      {/* Token 使用 */}
      <Section title="Token 使用" icon="⚡" style={{ marginTop: 20 }}>
        <div style={{
          padding: '12px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>本次对话</span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              {data.totalTokens.toLocaleString()} tokens
            </span>
          </div>
          <div style={{
            height: 6,
            background: 'var(--border)',
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${tokenPercent}%`,
              height: '100%',
              background: tokenPercent > 80 ? '#f44336' : tokenPercent > 50 ? '#ff9800' : 'var(--accent)',
              borderRadius: 3,
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            {tokenPercent.toFixed(1)}% of 1M context
          </div>
        </div>
      </Section>

      {/* 工具使用统计 */}
      {data.tools.length > 0 && (
        <Section title="工具使用" icon="🔧" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.tools.map((tool, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{tool}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>已调用</span>
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
    <div style={{
      padding: '10px',
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  )
}

function Section({ title, icon, children, style = {} }) {
  return (
    <div style={style}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}
