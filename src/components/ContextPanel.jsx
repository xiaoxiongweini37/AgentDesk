import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

export default function ContextPanel({ sessionId, onClose }) {
  const [activeSection, setActiveSection] = useState('context')
  const [contextData, setContextData] = useState(null)
  const [loading, setLoading] = useState(true)

  // 获取上下文数据
  useEffect(() => {
    if (!sessionId) return
    
    const fetchContext = async () => {
      setLoading(true)
      try {
        // 获取会话消息
        const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`)
        if (res.ok) {
          const messages = await res.json()
          const data = analyzeContext(messages)
          setContextData(data)
        }
      } catch (err) {
        console.error('Failed to fetch context:', err)
      }
      setLoading(false)
    }
    
    fetchContext()
  }, [sessionId])

  // 分析上下文
  const analyzeContext = (messages) => {
    const files = new Set()
    const tools = new Set()
    let toolCalls = []
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
      
      // 提取工作目录
      const dirMatch = content.match(/(?:cd|chdir)\s+([^\s]+)/)
      if (dirMatch) {
        currentDir = dirMatch[1]
      }
      
      // 估算token（粗略）
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
          <ContextContent data={contextData} />
        ) : (
          <ProgressContent data={contextData} />
        )}
      </div>
    </div>
  )
}

function ContextContent({ data }) {
  if (!data) return <div style={{ color: 'var(--text-secondary)' }}>无数据</div>
  
  return (
    <div>
      {/* 关联文件 */}
      <Section title="关联文件" icon="📎">
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
