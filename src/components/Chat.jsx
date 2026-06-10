import { useState, useRef, useEffect } from 'react'
import { gsap } from '../utils/animations'

export default function Chat({ messages, onSend, onFileUpload, isLoading, streamingText }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastMessageRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // 新消息入场动画
    if (lastMessageRef.current && messages.length > 0) {
      gsap.fromTo(lastMessageRef.current, 
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }
      )
    }
  }, [messages, streamingText])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      onFileUpload(files)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleSendHover = (e) => {
    if (!isLoading && input.trim()) {
      gsap.to(e.currentTarget, { scale: 1.05, duration: 0.2 })
    }
  }

  const handleSendLeave = (e) => {
    gsap.to(e.currentTarget, { scale: 1, duration: 0.2 })
  }

  return (
    <div 
      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && !streamingText && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            marginTop: 100,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>AgentDesk</h2>
            <p>开始对话，或拖拽文件到此处上传</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>已连接 Hermes API</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            ref={i === messages.length - 1 ? lastMessageRef : null}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: 'var(--radius)',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
              color: msg.role === 'user' ? 'var(--bg-primary)' : 'var(--text-primary)',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* 流式输出显示 */}
        {streamingText && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              ref={lastMessageRef}
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {streamingText}
              <span style={{ 
                display: 'inline-block',
                width: 8,
                height: 16,
                background: 'var(--accent)',
                marginLeft: 2,
                animation: 'blink 1s infinite',
              }} />
            </div>
          </div>
        )}

        {isLoading && !streamingText && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
            }}>
              思考中...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 12,
      }}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={(e) => onFileUpload(Array.from(e.target.files))}
          multiple
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.1, duration: 0.2 })}
          onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.2 })}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 18,
          }}
          title="上传文件"
        >
          📎
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息... (拖拽文件可直接上传)"
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 14,
            outline: 'none',
            opacity: isLoading ? 0.7 : 1,
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          onMouseEnter={handleSendHover}
          onMouseLeave={handleSendLeave}
          style={{
            padding: '8px 20px',
            border: 'none',
            borderRadius: 'var(--radius)',
            background: (input.trim() && !isLoading) ? 'var(--accent)' : 'var(--border)',
            color: (input.trim() && !isLoading) ? 'var(--bg-primary)' : 'var(--text-secondary)',
            cursor: (input.trim() && !isLoading) ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
          }}
        >
          {isLoading ? '等待中...' : '发送'}
        </button>
      </form>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
