import { useState, useRef, useEffect } from 'react'
import { gsap } from '../utils/animations'

export default function Chat({ messages, onSend, onFileUpload, isLoading, streamingText, showContextPanel, onToggleContext }) {
  const [input, setInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastMessageRef = useRef(null)

  // 过滤系统消息
  const filteredMessages = messages.filter(msg => {
    const content = msg.content || ''
    // 过滤 Skill Curator 和其他系统消息
    if (content.startsWith('Review the conversation above')) return false
    if (content.startsWith('[IMPORTANT:')) return false
    if (content.includes('skill library')) return false
    if (content.includes('DELIVERY:')) return false
    if (content.includes('SILENT:')) return false
    return true
  }).map(msg => {
    // 处理包含图片描述的用户消息
    if (msg.role === 'user' && msg.content && msg.content.startsWith('[The user attached an image')) {
      const content = msg.content
      // 提取图片描述和实际用户输入
      const match = content.match(/\[The user attached an image\.\s*Here's what it contains:\s*([\s\S]*?)\]\s*([\s\S]*)/)
      if (match) {
        const imageDescription = match[1].trim()
        const userInput = match[2].trim()
        // 如果有实际用户输入，只显示用户输入，图片描述作为附件
        if (userInput) {
          return {
            ...msg,
            content: userInput,
            hasImage: true,
            imageDescription: imageDescription,
          }
        }
        // 如果只有图片描述，显示为图片消息
        return {
          ...msg,
          content: '📷 发送了一张图片',
          hasImage: true,
          imageDescription: imageDescription,
        }
      }
    }
    return msg
  })

  // 自动滚动到底部（只在用户没手动滚动时）
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    if (lastMessageRef.current && filteredMessages.length > 0) {
      gsap.fromTo(lastMessageRef.current, 
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }
      )
    }
  }, [messages, streamingText, autoScroll])

  // 检测用户滚动
  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return
    
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50
    setAutoScroll(atBottom)
    setShowScrollTop(container.scrollTop > 200)
  }

  // 回到顶部
  const scrollToTop = () => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 回到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setAutoScroll(true)
  }

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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0, overflow: 'hidden' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
          {/* 消息列表 */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              position: 'relative',
            }}
          >
            {filteredMessages.length === 0 && !streamingText && (
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

            {filteredMessages.map((msg, i) => (
              <div
                key={i}
                ref={i === filteredMessages.length - 1 ? lastMessageRef : null}
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
                  {msg.hasImage && (
                    <div style={{
                      fontSize: 11,
                      opacity: 0.7,
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      📷 图片
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}

            {/* 流式输出 */}
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

          {/* 滚动按钮 */}
          {(showScrollTop || !autoScroll) && (
            <div style={{
              position: 'absolute',
              right: 20,
              bottom: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              zIndex: 10,
            }}>
              {showScrollTop && (
                <button
                  onClick={scrollToTop}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                  title="回到顶部"
                >
                  ⬆
                </button>
              )}
              {!autoScroll && (
                <button
                  onClick={scrollToBottom}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    border: 'none',
                    color: 'var(--bg-primary)',
                    cursor: 'pointer',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                  title="回到底部"
                >
                  ⬇
                </button>
              )}
            </div>
          )}

          {/* 输入框 */}
          <form onSubmit={handleSubmit} style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
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
            <button
              type="button"
              onClick={onToggleContext}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: showContextPanel ? 'var(--accent)' : 'var(--bg-secondary)',
                color: showContextPanel ? 'var(--bg-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
              }}
              title={showContextPanel ? '隐藏面板' : '显示面板'}
            >
              ☰
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
