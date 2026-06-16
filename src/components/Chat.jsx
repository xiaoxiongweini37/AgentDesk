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
    if (line.startsWith('### ')) {
      flushList()
      elements.push(<h4 key={i} style={{ margin: '12px 0 6px', fontSize: 14, fontWeight: 600 }}>{line.slice(4)}</h4>)
      return
    }
    if (line.startsWith('## ')) {
      flushList()
      elements.push(<h3 key={i} style={{ margin: '14px 0 8px', fontSize: 16, fontWeight: 600 }}>{line.slice(3)}</h3>)
      return
    }
    if (line.startsWith('# ')) {
      flushList()
      elements.push(<h2 key={i} style={{ margin: '16px 0 10px', fontSize: 18, fontWeight: 600 }}>{line.slice(2)}</h2>)
      return
    }
    if (line.match(/^\s*[-*]\s/)) {
      inList = true
      const content = line.replace(/^\s*[-*]\s/, '')
      listItems.push(renderInline(content))
      return
    }
    if (line.startsWith('```')) {
      flushList()
      return
    }
    if (!line.trim()) {
      flushList()
      elements.push(<div key={i} style={{ height: 8 }} />)
      return
    }
    flushList()
    elements.push(<p key={i} style={{ margin: '4px 0', lineHeight: 1.7 }}>{renderInline(line)}</p>)
  })

  flushList()
  return elements
}

function renderInline(text) {
  if (!text) return text
  const parts = []
  let remaining = text
  let key = 0

  while (remaining) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const codeMatch = remaining.match(/`(.+?)`/)
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

    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index))
    }

    if (matchType === 'bold') {
      parts.push(<strong key={key++} style={{ fontWeight: 600 }}>{firstMatch[1]}</strong>)
    } else if (matchType === 'code') {
      parts.push(
        <code key={key++} style={{
          background: 'rgba(108, 92, 231, 0.15)',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: '0.88em',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          border: '1px solid rgba(108, 92, 231, 0.2)',
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

        result.push({ ...msg, content: processedContent, hasImage, imageDescription })
        i++
        continue
      }

      if (msg.role === 'assistant') {
        const thinkingMessages = []
        let finalMessage = null

        while (i < msgs.length && msgs[i].role === 'assistant') {
          const currentContent = msgs[i].content || ''
          if (!currentContent.trim()) { i++; continue }
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

      if (msg.role === 'tool') { i++; continue }
      result.push(msg)
      i++
    }

    return result
  }

  const processedMessages = processMessages(messages)

  const toggleThinking = (thinkingId) => {
    setExpandedThinking(prev => ({ ...prev, [thinkingId]: !prev[thinkingId] }))
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

  const scrollToTop = () => messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setAutoScroll(true) }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => onSend(`[图片: ${file.name || 'pasted-image.png'}]\n${reader.result}`)
          reader.readAsDataURL(file)
        }
        return
      }
    }
  }

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => onSend(`[图片: ${file.name}]\n${reader.result}`)
        reader.readAsDataURL(file)
      } else {
        const reader = new FileReader()
        reader.onload = () => onSend(`[文件: ${file.name}]\n\`\`\`\n${reader.result}\n\`\`\``)
        reader.readAsText(file)
      }
    }
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = () => onSend(`[图片: ${file.name}]\n${reader.result}`)
          reader.readAsDataURL(file)
        } else {
          const reader = new FileReader()
          reader.onload = () => onSend(`[文件: ${file.name}]\n\`\`\`\n${reader.result}\n\`\`\``)
          reader.readAsText(file)
        }
      })
    }
  }

  const handleDragOver = (e) => e.preventDefault()
  const interrupted = isSessionInterrupted()

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0, overflow: 'hidden' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* 中断提示 */}
      {interrupted && !isLoading && (
        <div className="animate-fade-in" style={{
          padding: '12px 20px',
          background: 'rgba(255, 167, 38, 0.08)',
          borderBottom: '1px solid rgba(255, 167, 38, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>会话似乎被中断了</span>
          </div>
          <button
            onClick={handleResume}
            className="glass-btn-primary"
            style={{ padding: '6px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff' }}
          >
            🔄 重新发送
          </button>
        </div>
      )}

      {/* 消息区域 */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'relative',
        }}
      >
        {/* 空状态 */}
        {processedMessages.length === 0 && !streamingText && (
          <div className="animate-fade-in" style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            marginTop: 100,
          }}>
            <div style={{
              width: 80,
              height: 80,
              margin: '0 auto 20px',
              borderRadius: 24,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              boxShadow: '0 8px 32px var(--accent-glow)',
            }}>🤖</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 22, fontWeight: 600 }}>AgentDesk</h2>
            <p style={{ fontSize: 14, opacity: 0.7 }}>开始对话，或拖拽文件到此处上传</p>
            <div style={{
              display: 'inline-block',
              marginTop: 16,
              padding: '6px 16px',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 20,
              fontSize: 12,
              color: 'var(--accent-light)',
            }}>
              ✓ 已连接 Hermes API
            </div>
          </div>
        )}

        {/* 消息列表 */}
        {processedMessages.map((msg, i) => (
          <div
            key={i}
            ref={i === processedMessages.length - 1 ? lastMessageRef : null}
            className="animate-fade-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {/* 用户消息 */}
            {msg.role === 'user' && (
              <div style={{
                padding: '10px 16px',
                borderRadius: '18px 18px 4px 18px',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                color: '#fff',
                fontSize: 14,
                lineHeight: 1.6,
                maxWidth: '100%',
                wordBreak: 'break-word',
                boxShadow: '0 2px 12px var(--accent-glow)',
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
                {msg.hasThinking && (
                  <button
                    onClick={() => toggleThinking(msg.thinkingId)}
                    className="glass-btn"
                    style={{
                      marginBottom: 6,
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
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
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10,
                    }}>
                      {msg.thinkingContent.split('\n').length}
                    </span>
                  </button>
                )}

                {msg.hasThinking && expandedThinking[msg.thinkingId] && (
                  <div className="glass-card" style={{
                    marginBottom: 8,
                    padding: '12px 14px',
                    width: '100%',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    maxHeight: 200,
                    overflowY: 'auto',
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    lineHeight: 1.6,
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {msg.thinkingContent}
                    </pre>
                  </div>
                )}

                <div className="glass-card" style={{
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  maxWidth: '100%',
                  wordBreak: 'break-word',
                }}>
                  {renderMarkdown(msg.content)}
                </div>
              </>
            )}
          </div>
        ))}

        {/* 流式输出 */}
        {streamingText && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: '80%' }}>
            <div
              ref={lastMessageRef}
              className="glass-card animate-fade-in"
              style={{
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                color: 'var(--text-primary)',
                fontSize: 14,
                lineHeight: 1.6,
                maxWidth: '100%',
                wordBreak: 'break-word',
              }}
            >
              {renderMarkdown(streamingText)}
              <span style={{
                display: 'inline-block',
                width: 6,
                height: 14,
                background: 'linear-gradient(180deg, var(--accent), var(--accent-light))',
                marginLeft: 2,
                animation: 'blink 1s infinite',
                borderRadius: 1,
              }} />
            </div>
          </div>
        )}

        {/* 加载中 */}
        {isLoading && !streamingText && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="glass-card" style={{
              padding: '12px 16px',
              borderRadius: '18px 18px 18px 4px',
              color: 'var(--text-secondary)',
              fontSize: 14,
            }}>
              <span style={{ animation: 'pulse 1.5s infinite' }}>思考中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 滚动按钮 */}
      {(showScrollTop || !autoScroll) && (
        <div style={{
          position: 'absolute',
          right: 24,
          bottom: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 10,
        }}>
          {showScrollTop && (
            <button onClick={scrollToTop} className="glass-btn" style={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }} title="回到顶部">⬆</button>
          )}
          {!autoScroll && (
            <button onClick={scrollToBottom} className="glass-btn-primary" style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#fff', cursor: 'pointer',
            }} title="回到底部">⬇</button>
          )}
        </div>
      )}

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} style={{
        padding: '14px 20px',
        borderTop: '1px solid var(--glass-border)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        background: 'rgba(15, 15, 26, 0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          multiple
          accept="image/*,.txt,.md,.py,.js,.jsx,.ts,.tsx,.json,.yaml,.yml,.csv,.log,.html,.css,.sh"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="glass-btn-ghost"
          style={{
            padding: '8px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 18,
            transition: 'var(--transition)',
          }}
          title="上传文件或图片"
        >📎</button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          placeholder="输入消息... (支持粘贴图片)"
          disabled={isLoading}
          className="glass-input"
          style={{
            flex: 1,
            borderRadius: 24,
            opacity: isLoading ? 0.7 : 1,
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() && !isLoading}
          className={input.trim() && !isLoading ? 'glass-btn-primary' : 'glass-btn'}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: 24,
            cursor: (input.trim() && !isLoading) ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: 14,
            color: (input.trim() && !isLoading) ? '#fff' : 'var(--text-secondary)',
            opacity: (input.trim() && !isLoading) ? 1 : 0.5,
          }}
        >
          {isLoading ? '...' : '发送'}
        </button>
        <button
          type="button"
          onClick={onToggleContext}
          className="glass-btn"
          style={{
            padding: '8px 12px',
            border: showContextPanel ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)',
            background: showContextPanel ? 'var(--accent-glow)' : 'transparent',
            color: showContextPanel ? 'var(--accent-light)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
          }}
          title={showContextPanel ? '隐藏上下文面板' : '显示上下文面板'}
        >
          ☰
        </button>
      </form>
    </div>
  )
}
