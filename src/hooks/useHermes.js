import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'  // 代理服务器
const HERMES_SESSION_ID = '20260608_165429_4c8909'  // 共享CLI会话

export function useHermes() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const sendMessage = useCallback(async (messages) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer hermes-secret-key-2026',
          'X-Hermes-Session-Id': HERMES_SESSION_ID,  // 共享session
        },
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
  }, [])

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
    checkHealth,
    isLoading,
    error,
    sessionId: HERMES_SESSION_ID,
  }
}
