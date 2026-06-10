import { useState } from 'react'

export default function ContextPanel({ sessionId, onClose }) {
  const [activeSection, setActiveSection] = useState('context')

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
        {activeSection === 'context' ? (
          <ContextContent sessionId={sessionId} />
        ) : (
          <ProgressContent sessionId={sessionId} />
        )}
      </div>
    </div>
  )
}

function ContextContent({ sessionId }) {
  return (
    <div>
      {/* 关联文件 */}
      <Section title="关联文件" icon="📎">
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
          <div>拖拽文件到此处添加</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>或点击下方按钮</div>
        </div>
        <button style={{
          width: '100%',
          padding: '8px',
          marginTop: 8,
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
        }}>
          + 添加文件
        </button>
      </Section>

      {/* 使用的工具 */}
      <Section title="使用的工具" icon="🔧" style={{ marginTop: 20 }}>
        <div style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          padding: '8px 0',
        }}>
          暂无工具调用记录
        </div>
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
          /home/jinzhong
        </div>
      </Section>
    </div>
  )
}

function ProgressContent({ sessionId }) {
  return (
    <div>
      {/* 任务状态 */}
      <Section title="任务状态" icon="📊">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg-primary)',
            fontSize: 18,
          }}>
            ✓
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              进行中
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              正在处理对话...
            </div>
          </div>
        </div>
      </Section>

      {/* 执行步骤 */}
      <Section title="执行步骤" icon="📝" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <StepItem status="completed" text="接收用户消息" />
          <StepItem status="completed" text="解析意图" />
          <StepItem status="active" text="生成回复..." />
          <StepItem status="pending" text="执行工具调用" />
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
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>12,345 tokens</span>
          </div>
          <div style={{
            height: 4,
            background: 'var(--border)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: '30%',
              height: '100%',
              background: 'var(--accent)',
              borderRadius: 2,
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            30% of 1M context
          </div>
        </div>
      </Section>
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

function StepItem({ status, text }) {
  const statusIcons = {
    completed: { icon: '✓', color: 'var(--success)', bg: 'rgba(0,255,136,0.1)' },
    active: { icon: '●', color: 'var(--accent)', bg: 'rgba(0,212,255,0.1)' },
    pending: { icon: '○', color: 'var(--text-secondary)', bg: 'transparent' },
  }

  const s = statusIcons[status] || statusIcons.pending

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      background: s.bg,
      borderRadius: 'var(--radius)',
      fontSize: 13,
    }}>
      <span style={{ color: s.color, fontSize: 14 }}>{s.icon}</span>
      <span style={{ color: status === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {text}
      </span>
    </div>
  )
}
