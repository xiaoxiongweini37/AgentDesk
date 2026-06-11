import { useState, useRef, useEffect } from 'react'
import { gsap } from '../utils/animations'

export default function Chat({ messages, onSend, onFileUpload, isLoading, streamingText, showContextPanel, onToggleContext }) {
  const [input, setInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [expandedThinking, setExpandedThinking] = useState({})
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastMessageRef = useRef(null)

  // 检测会话是否中断
  const isSessionInterrupted = () => {
    if (messages.length === 0) return false
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'user') return true
    if (lastMsg.role === 'assistant' && lastMsg.content?.startsWith('❌')) return true
    return false
  }

  // 获取最后一条用户消息
  const getLastUserMessage = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content
    }
    return null
  }

  const handleResume = () => {
    const lastUserMsg = getLastUserMessage()
    if (lastUserMsg && !isLoading) {
      onSend(lastUserMsg)
    }
  }

  // 处理消息：合并assistant的思考过程为可折叠
  const processMessages = (msgs) => {
    const result = []
    let i = 0
    
    while (i < msgs.length) {
      const msg = msgs[i]
      const content = msg.content || ''
      
      // 过滤系统消息
      if (content.startsWith('Review the conversation above')) { i++; continue }
      if (content.startsWith('[IMPORTANT:')) { i++; continue }
      if (content.includes('skill library')) { i++; continue }
      if (content.includes('DELIVERY:')) { i++; continue }
      if (content.includes('SILENT:')) { i++; continue }
      
      // 处理用户消息
      if (msg.role === 'user') {
        let processedContent = content
        let hasImage = false
        let imageDescription = ''
        
        // 处理图片消息
        if (content.startsWith('[The user attached an image')) {
          const match = content.match(/\[The user attached an image\.\s*Here's what it contains:\s*([\s\S]*?)\]\s*([\s\S]*)/)
          if (match) {
            imageDescription = match[1].trim()
            processedContent = match[2].trim() || '📷 发送了一张图片'
            hasImage = true
          }
        }
        
        result.push({
          ...msg,
          content: processedContent,
          hasImage,
          imageDescription,
        })
        i++
        continue
      }
      
      // 处理assistant消息：收集连续的assistant消息，最后一个作为主回复，前面的作为思考过程
      if (msg.role === 'assistant') {
        const thinkingMessages = []
        let finalMessage = null
        
        // 收集连续的assistant消息
        while (i < msgs.length && msgs[i].role === 'assistant') {
          const currentContent = msgs[i].content || ''
          
          // 跳过空消息
          if (!currentContent.trim()) {
            i++
            continue
          }
          
          // 检查是否是最后一条有实质内容的消息
          const isLastInGroup = (i + 1 >= msgs.length || msgs[i + 1].role !== 'assistant')
          
          if (isLastInGroup) {
            finalMessage = msgs[i]
          } else {
            thinkingMessages.push(msgs[i])
          }
          i++
        }
        
        // 如果有思考过程，创建可折叠结构
        if (thinkingMessages.length > 0 && finalMessage) {
          const thinkingId = `thinking_${result.length}`
          result.push({
            ...finalMessage,
            thinkingId,
            thinkingContent: thinkingMessages.map(m => m.content).join('\n'),
            hasThinking: true,
          })
        } else if (finalMessage) {
          result.push(finalMessage)
        }
        continue
      }
      
      // tool消息：作为思考过程的一部分
      if (msg.role === 'tool') {
        // 跳过tool消息，它们通常包含在assistant的思考中
        i++
        continue
      }
      
      result.push(msg)
      i++
    }
    
    return result
  }

  const processedMessages = processMessages(messages)

  // 切换思考过程显示
  const toggleThinking = (thinkingId) => {
    setExpandedThinking(prev => ({
      ...prev,
      [thinkingId]: !prev[thinkingId],
    }))
  }

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    if (lastMessageRef.current && processedMessages.length > 0) {
      gsap.fromTo(lastMessageRef.current, 
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }
      )
    }
  }, [messages, streamingText, autoScroll])

  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50
    setAutoScroll(atBottom)
    setShowScrollTop(container.scrollTop > 200)
  }

  const scrollToTop = () => {
    messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  const interrupted = isSessionInterrupted()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0, overflow: 'hidden' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
          {/* 会话中断恢复提示 */}
          {interrupted && !isLoading && (
            <div style={{
              padding: '12px 20px',
              background: 'rgba(255, 152, 0, 0.1)',
              borderBottom: '1px solid rgba(255, 152, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                  会话似乎被中断了
                </span>
              </div>
              <button
                onClick={handleResume}
                style={{
                  padding: '6px 16px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  color: 'var(--bg-primary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 'bold',
                }}
              >
                🔄 重新发送
              </button>
            </div>
          )}

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
            {processedMessages.length === 0 && !streamingText && (
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

            {processedMessages.map((msg, i) => (
              <div
                key={i}
                ref={i === processedMessages.length - 1 ? lastMessageRef : null}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {/* 思考过程折叠按钮 */}
                {msg.hasThinking && (
                  <button
                    onClick={() => toggleThinking(msg.thinkingId)}
                    style={{
                      marginBottom: 4,
                      padding: '2px 8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ 
                      transform: expandedThinking[msg.thinkingId] ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      display: 'inline-block',
                    }}>
                      ▶
                    </span>
                    思考过程 ({msg.thinkingContent.split('\n').length} 行)
                  </button>
                )}
                
                {/* 思考过程内容 */}
                {msg.hasThinking && expandedThinking[msg.thinkingId] && (
                  <div style={{
                    marginBottom: 8,
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    maxWidth: '90%',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}>
                    {msg.thinkingContent}
                  </div>
                )}
                
                {/* 主消息 */}
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
