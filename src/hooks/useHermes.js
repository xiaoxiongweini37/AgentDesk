import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'  // 代理服务器

export function useHermes() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sessionId, setSessionId] = useState(null)

  // 启动时获取当前CLI session ID
  useEffect(() => {
    fetch(`${API_BASE}/api/session-id`)
      .then(r => r.json())
      .then(data => {
        if (data.session_id) {
          setSessionId(data.session_id)
          console.log('共享会话ID:', data.session_id)
        }
      })
      .catch(err => console.error('获取session ID失败:', err))
  }, [])

  const sendMessage = useCallback(async (messages) => {
    setIsLoading(true)
    setError(null)

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer hermes-secret-key-2026',
      }
      
      // 如果有session ID，添加到请求头
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

  // 刷新session ID
  const refreshSessionId = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/session-id`)
      const data = await response.json()
      if (data.session_id) {
        setSessionId(data.session_id)
        return data.session_id
      }
    } catch (err) {
      console.error('刷新session ID失败:', err)
    }
    return null
  }, [])

  return {
    sendMessage,
    checkHealth,
    isLoading,
    error,
    sessionId,
    refreshSessionId,
  }
}
