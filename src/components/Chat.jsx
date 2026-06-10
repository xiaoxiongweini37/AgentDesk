import { useState, useRef, useEffect } from 'react'
import { gsap } from '../utils/animations'

export default function Chat({ messages, onSend, onFileUpload, isLoading }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 新消息入场动画
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = containerRef.current?.lastElementChild
      if (lastMessage) {
        gsap.from(lastMessage, {
          y: 20,
          autoAlpha: 0,
          duration: 0.4,
          ease: 'power2.out',
        })
      }
    }
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      // 发送按钮动画
      gsap.to(inputRef.current, {
        scale: 0.95,
        duration: 0.1,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1,
      })
      
      onSend(input.trim())
      setInput('')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      // 拖拽提示动画
      gsap.from(e.currentTarget, {
        borderColor: 'var(--accent)',
        duration: 0.5,
        ease: 'power2.out',
      })
      onFileUpload(files)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  return (
    <div 
      style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Messages */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 && (
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

        {isLoading && (
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

      {/* Input */}
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
          ref={inputRef}
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
    </div>
  )
}
