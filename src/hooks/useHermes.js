import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

export function useHermes() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [streamingText, setStreamingText] = useState('')

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

  // 流式发送消息
  const sendMessageStream = useCallback(async (messages, onChunk) => {
    setIsLoading(true)
    setError(null)
    setStreamingText('')

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer hermes-secret-key-2026',
      }
      
      if (sessionId) {
        headers['X-Hermes-Session-Id'] = sessionId
      }

      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'mimo-v2.5-pro',
          messages: messages,
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
  }, [sessionId])

  // 非流式发送消息（备用）
  const sendMessage = useCallback(async (messages) => {
    setIsLoading(true)
    setError(null)

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer hermes-secret-key-2026',
      }
      
      if (sessionId) {
        headers['X-Hermes-Session-Id'] = sessionId
      }

      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'mimo-v2.5-pro',
          messages: messages,
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
  }, [sessionId])

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
