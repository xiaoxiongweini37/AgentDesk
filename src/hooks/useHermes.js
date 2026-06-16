import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

export function useHermes(agentConfig = null) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [streamingText, setStreamingText] = useState('')

  // 从 agentConfig 获取配置，或使用默认值
  const getApiKey = useCallback(() => {
    return agentConfig?.api_key || 'hermes-secret-key-2026'
  }, [agentConfig])

  const getModel = useCallback(() => {
    return agentConfig?.model || 'mimo-v2.5-pro'
  }, [agentConfig])

  // 启动时获取当前 CLI session ID
  useEffect(() => {
    fetch(`${API_BASE}/api/session-id`)
      .then(r => r.json())
      .then(data => {
        if (data.session_id) {
          setSessionId(data.session_id)
          console.log('共享会话ID:', data.session_id)
        }
      })
      .catch(err => console.error('获取 session ID 失败:', err))
  }, [])

  // 获取挂载文件上下文
  const getMountContext = useCallback(async () => {
    if (!sessionId) return ''
    try {
      const res = await fetch(`${API_BASE}/api/mounts?session=${sessionId}`)
      if (!res.ok) return ''
      const mounts = await res.json()
      if (mounts.length === 0) return ''
      
      // 获取挂载内容
      const contextRes = await fetch(`${API_BASE}/api/mounts/context?session=${sessionId}`)
      if (contextRes.ok) {
        return await contextRes.text()
      }
    } catch (err) {
      console.error('Failed to get mount context:', err)
    }
    return ''
  }, [sessionId])

  // 流式发送消息
  const sendMessageStream = useCallback(async (messages, onChunk) => {
    setIsLoading(true)
    setError(null)
    setStreamingText('')

    try {
      // 获取挂载上下文
      const mountContext = await getMountContext()
      
      // 如果有挂载上下文，添加到系统消息
      let enhancedMessages = [...messages]
      if (mountContext) {
        // 检查是否已有系统消息
        const hasSystem = enhancedMessages.some(m => m.role === 'system')
        if (!hasSystem) {
          enhancedMessages.unshift({
            role: 'system',
            content: mountContext,
          })
        } else {
          // 追加到现有系统消息
          enhancedMessages = enhancedMessages.map(m => {
            if (m.role === 'system') {
              return { ...m, content: m.content + '\n\n' + mountContext }
            }
            return m
          })
        }
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey()}`,
      }

      if (sessionId) {
        headers['X-Hermes-Session-Id'] = sessionId
      }

      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: getModel(),
          messages: enhancedMessages,
          stream: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullText += content
                setStreamingText(fullText)
                if (onChunk) onChunk(content, fullText)
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      return fullText
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
      setStreamingText('')
    }
  }, [sessionId, getMountContext, getApiKey, getModel])

  // 非流式发送消息（备用）
  const sendMessage = useCallback(async (messages) => {
    setIsLoading(true)
    setError(null)

    try {
      // 获取挂载上下文
      const mountContext = await getMountContext()
      
      // 如果有挂载上下文，添加到系统消息
      let enhancedMessages = [...messages]
      if (mountContext) {
        const hasSystem = enhancedMessages.some(m => m.role === 'system')
        if (!hasSystem) {
          enhancedMessages.unshift({
            role: 'system',
            content: mountContext,
          })
        } else {
          enhancedMessages = enhancedMessages.map(m => {
            if (m.role === 'system') {
              return { ...m, content: m.content + '\n\n' + mountContext }
            }
            return m
          })
        }
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getApiKey()}`,
      }

      if (sessionId) {
        headers['X-Hermes-Session-Id'] = sessionId
      }

      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: getModel(),
          messages: enhancedMessages,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, getMountContext, getApiKey, getModel])

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/health`)
      return response.ok
    } catch {
      return false
    }
  }, [])

  return {
    sendMessage,
    sendMessageStream,
    checkHealth,
    isLoading,
    error,
    sessionId,
    streamingText,
  }
}
