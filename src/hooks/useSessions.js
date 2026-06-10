import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'
const STORAGE_KEY = 'agentdesk_sessions'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [loading, setLoading] = useState(true)

  // 从代理服务器加载会话列表
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`)
      if (!res.ok) throw new Error('Failed to fetch sessions')
      const data = await res.json()
      setSessions(data)
      setLoading(false)
    } catch (err) {
      console.error('获取会话列表失败:', err)
      // 如果获取失败，尝试从 localStorage 加载
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) setSessions(JSON.parse(raw))
      } catch {}
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // 本地创建新会话
  const createSession = useCallback(() => {
    const id = generateId()
    const session = {
      id,
      title: '新对话',
      messages: [],
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      platform: 'local',
    }
    setSessions(prev => [session, ...prev])
    setActiveSessionId(id)
    // 保存到 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify([session, ...sessions]))
    return id
  }, [sessions])

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    setActiveSessionId(prev => prev === id ? null : prev)
  }, [])

  const updateSessionMessages = useCallback((id, messages) => {
    setSessions(prev => prev.map(s =>
      s.id === id
        ? { ...s, messages, messageCount: messages.length, updatedAt: Date.now() }
        : s
    ))
    // 保存到 localStorage
    const updated = sessions.map(s =>
      s.id === id ? { ...s, messages, messageCount: messages.length, updatedAt: Date.now() } : s
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }, [sessions])

  const renameSession = useCallback((id, title) => {
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, title } : s
    ))
  }, [])

  // 刷新会话列表
  const refreshSessions = useCallback(() => {
    fetchSessions()
  }, [fetchSessions])

  const activeSession = sessions.find(s => s.id === activeSessionId) || null

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    updateSessionMessages,
    renameSession,
    refreshSessions,
    loading,
  }
}
