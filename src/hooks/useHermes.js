import { useState, useCallback } from 'react'

// 直接连接 API 服务器
const API_BASE = 'http://localhost:8642'

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
  }
}
