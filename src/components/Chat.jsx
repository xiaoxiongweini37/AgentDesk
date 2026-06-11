import { useState, useRef, useEffect } from 'react'
import { gsap } from '../utils/animations'

// 简单的Markdown渲染
function renderMarkdown(text) {
  if (!text) return null
  
  const lines = text.split('\n')
  const elements = []
  let inList = false
  let listItems = []
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} style={{ margin: '4px 0', paddingLeft: 20 }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ marginBottom: 2, lineHeight: 1.6 }}>{item}</li>
          ))}
        </ul>
      )
      listItems = []
    }
    inList = false
  }
  
  lines.forEach((line, i) => {
    // 标题
    if (line.startsWith('### ')) {
      flushList()
      elements.push(<h4 key={i} style={{ margin: '12px 0 6px', fontSize: 14, fontWeight: 'bold' }}>{line.slice(4)}</h4>)
      return
    }
    if (line.startsWith('## ')) {
      flushList()
      elements.push(<h3 key={i} style={{ margin: '14px 0 8px', fontSize: 16, fontWeight: 'bold' }}>{line.slice(3)}</h3>)
      return
    }
    if (line.startsWith('# ')) {
      flushList()
      elements.push(<h2 key={i} style={{ margin: '16px 0 10px', fontSize: 18, fontWeight: 'bold' }}>{line.slice(2)}</h2>)
      return
    }
    
    // 列表项
    if (line.match(/^\s*[-*]\s/)) {
      inList = true
      const content = line.replace(/^\s*[-*]\s/, '')
      listItems.push(renderInline(content))
      return
    }
    
    // 代码块
    if (line.startsWith('```')) {
      flushList()
      // 简单处理，跳过语言标记
      return
    }
    
    // 空行
    if (!line.trim()) {
      flushList()
      elements.push(<div key={i} style={{ height: 8 }} />)
      return
    }
    
    // 普通段落
    flushList()
    elements.push(<p key={i} style={{ margin: '4px 0', lineHeight: 1.7 }}>{renderInline(line)}</p>)
  })
  
  flushList()
  return elements
}

// 渲染行内元素（粗体、斜体、代码）
function renderInline(text) {
  if (!text) return text
  
  // 简单处理：粗体、代码
  const parts = []
  let remaining = text
  let key = 0
  
  while (remaining) {
    // 匹配 **粗体**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // 匹配 `代码`
    const codeMatch = remaining.match(/`(.+?)`/)
    // 匹配 *斜体*
    const italicMatch = remaining.match(/\*(.+?)\*/)
    
    let firstMatch = null
    let matchType = null
    
    if (boldMatch && (!firstMatch || boldMatch.index < firstMatch.index)) {
      firstMatch = boldMatch
      matchType = 'bold'
    }
    if (codeMatch && (!firstMatch || codeMatch.index < firstMatch.index)) {
      firstMatch = codeMatch
      matchType = 'code'
    }
    if (italicMatch && (!firstMatch || italicMatch.index < firstMatch.index)) {
      firstMatch = italicMatch
      matchType = 'italic'
    }
    
    if (!firstMatch) {
      parts.push(remaining)
      break
    }
    
    // 匹配前的文本
    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index))
    }
    
    // 匹配的文本
    if (matchType === 'bold') {
      parts.push(<strong key={key++} style={{ fontWeight: 600 }}>{firstMatch[1]}</strong>)
    } else if (matchType === 'code') {
      parts.push(
        <code key={key++} style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '1px 4px', 
          borderRadius: 3, 
          fontSize: '0.9em',
          fontFamily: 'monospace' 
        }}>
          {firstMatch[1]}
        </code>
      )
    } else if (matchType === 'italic') {
      parts.push(<em key={key++}>{firstMatch[1]}</em>)
    }
    
    remaining = remaining.slice(firstMatch.index + firstMatch[0].length)
  }
  
  return parts
}

export default function Chat({ messages, onSend, onFileUpload, isLoading, streamingText, showContextPanel, onToggleContext }) {
  const [input, setInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [expandedThinking, setExpandedThinking] = useState({})
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastMessageRef = useRef(null)

  const isSessionInterrupted = () => {
    if (messages.length === 0) return false
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'user') return true
    if (lastMsg.role === 'assistant' && lastMsg.content?.startsWith('❌')) return true
    return false
  }

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

  const processMessages = (msgs) => {
    const result = []
    let i = 0
    
    while (i < msgs.length) {
      const msg = msgs[i]
      const content = msg.content || ''
      
      if (content.startsWith('Review the conversation above')) { i++; continue }
      if (content.startsWith('[IMPORTANT:')) { i++; continue }
      if (content.includes('skill library')) { i++; continue }
      if (content.includes('DELIVERY:')) { i++; continue }
      if (content.includes('SILENT:')) { i++; continue }
      
      if (msg.role === 'user') {
        let processedContent = content
        let hasImage = false
        let imageDescription = ''
        
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
      
      if (msg.role === 'assistant') {
        const thinkingMessages = []
        let finalMessage = null
        
        while (i < msgs.length && msgs[i].role === 'assistant') {
          const currentContent = msgs[i].content || ''
          
          if (!currentContent.trim()) {
            i++
            continue
          }
          
          const isLastInGroup = (i + 1 >= msgs.length || msgs[i + 1].role !== 'assistant')
          
          if (isLastInGroup) {
            finalMessage = msgs[i]
          } else {
            thinkingMessages.push(msgs[i])
          }
          i++
        }
        
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
      
      if (msg.role === 'tool') {
        i++
        continue
      }
      
      result.push(msg)
      i++
    }
    
    return result
  }

  const processedMessages = processMessages(messages)

  const toggleThinking = (thinkingId) => {
    setExpandedThinking(prev => ({
      ...prev,
      [thinkingId]: !prev[thinkingId],
    }))
  }

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

  // 粘贴图片支持
  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          // 转为base64
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = reader.result
            // 发送图片消息
            onSend(`[图片: ${file.name || 'pasted-image.png'}]\n${base64}`)
          }
          reader.readAsDataURL(file)
        }
        return
      }
    }
  }

  // 文件选择（📎按钮）
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        // 图片转base64发送
        const reader = new FileReader()
        reader.onload = () => {
          onSend(`[图片: ${file.name}]\n${reader.result}`)
        }
        reader.readAsDataURL(file)
      } else {
        // 文本文件读取内容
        const reader = new FileReader()
        reader.onload = () => {
          const content = reader.result
          onSend(`[文件: ${file.name}]\n\`\`\`\n${content}\n\`\`\``)
        }
        reader.readAsText(file)
      }
    }
    
    // 清空input，允许重复选择同一文件
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      // 直接触发文件选择逻辑
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = () => {
            onSend(`[图片: ${file.name}]\n${reader.result}`)
          }
          reader.readAsDataURL(file)
        } else {
          const reader = new FileReader()
          reader.onload = () => {
            onSend(`[文件: ${file.name}]\n\`\`\`\n${reader.result}\n\`\`\``)
          }
          reader.readAsText(file)
        }
      })
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
                <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>会话似乎被中断了</span>
              </div>
              <button onClick={handleResume} style={{
                padding: '6px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius)',
                color: 'var(--bg-primary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 'bold',
              }}>🔄 重新发送</button>
            </div>
          )}

          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
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
                  maxWidth: '85%',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {/* 用户消息 */}
                {msg.role === 'user' && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '16px 16px 4px 16px',
                    background: 'var(--accent)',
                    color: 'var(--bg-primary)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    maxWidth: '100%',
                    wordBreak: 'break-word',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}>
                    {msg.hasImage && (
                      <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>📷 图片</div>
                    )}
                    {msg.content}
                  </div>
                )}
                
                {/* AI消息 */}
                {msg.role === 'assistant' && (
                  <>
                    {/* 思考过程折叠按钮 */}
                    {msg.hasThinking && (
                      <button
                        onClick={() => toggleThinking(msg.thinkingId)}
                        style={{
                          marginBottom: 6,
                          padding: '4px 10px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--bg-card)'
                          e.currentTarget.style.borderColor = 'var(--accent)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                          e.currentTarget.style.borderColor = 'var(--border)'
                        }}
                      >
                        <span style={{ 
                          transform: expandedThinking[msg.thinkingId] ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                          display: 'inline-block',
                          fontSize: 10,
                        }}>▶</span>
                        <span style={{ opacity: 0.7 }}>思考过程</span>
                        <span style={{ 
                          background: 'var(--accent)', 
                          color: 'var(--bg-primary)', 
                          padding: '0 4px', 
                          borderRadius: 8, 
                          fontSize: 10 
                        }}>
                          {msg.thinkingContent.split('\n').length}
                        </span>
                      </button>
                    )}
                    
                    {/* 思考过程内容 */}
                    {msg.hasThinking && expandedThinking[msg.thinkingId] && (
                      <div style={{
                        marginBottom: 8,
                        padding: '10px 14px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        width: '100%',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        maxHeight: 200,
                        overflowY: 'auto',
                        fontFamily: 'monospace',
                        lineHeight: 1.6,
                      }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {msg.thinkingContent}
                        </pre>
                      </div>
                    )}
                    
                    {/* AI回复 - 使用Markdown渲染 */}
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '16px 16px 16px 4px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      lineHeight: 1.6,
                      maxWidth: '100%',
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      border: '1px solid var(--border)',
                    }}>
                      {renderMarkdown(msg.content)}
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* 流式输出 */}
            {streamingText && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: '85%' }}>
                <div
                  ref={lastMessageRef}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '16px 16px 16px 4px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    maxWidth: '100%',
                    wordBreak: 'break-word',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {renderMarkdown(streamingText)}
                  <span style={{ 
                    display: 'inline-block',
                    width: 6,
                    height: 14,
                    background: 'var(--accent)',
                    marginLeft: 2,
                    animation: 'blink 1s infinite',
                    borderRadius: 1,
                  }} />
                </div>
              </div>
            )}

            {isLoading && !streamingText && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ animation: 'pulse 1.5s infinite' }}>思考中...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

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
                <button onClick={scrollToTop} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }} title="回到顶部">⬆</button>
              )}
              {!autoScroll && (
                <button onClick={scrollToBottom} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--accent)', border: 'none',
                  color: 'var(--bg-primary)', cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }} title="回到底部">⬇</button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: 'var(--bg-secondary)',
          }}>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }}
              onChange={handleFileSelect} multiple accept="image/*,.txt,.md,.py,.js,.jsx,.ts,.tsx,.json,.yaml,.yml,.csv,.log,.html,.css,.sh" />
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{
              padding: '8px', border: 'none', borderRadius: 'var(--radius)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18,
            }} title="上传文件或图片">📎</button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder="输入消息... (支持粘贴图片)"
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: 20,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                opacity: isLoading ? 0.7 : 1,
              }}
            />
            <button type="submit" disabled={!input.trim() && !isLoading} style={{
              padding: '8px 16px', border: 'none', borderRadius: 20,
              background: (input.trim() && !isLoading) ? 'var(--accent)' : 'var(--border)',
              color: (input.trim() && !isLoading) ? 'var(--bg-primary)' : 'var(--text-secondary)',
              cursor: (input.trim() && !isLoading) ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', fontSize: 14,
            }}>
              {isLoading ? '...' : '发送'}
            </button>
            <button
              type="button"
              onClick={onToggleContext}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: showContextPanel ? 'var(--accent)' : 'transparent',
                color: showContextPanel ? 'var(--bg-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
              }}
              title={showContextPanel ? '隐藏上下文面板' : '显示上下文面板'}
            >
              ☰
            </button>
          </form>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
