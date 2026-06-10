import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'agentdesk_sessions'

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function extractTitle(messages) {
  if (!messages || messages.length === 0) return '新对话'
  const first = messages.find(m => m.role === 'user')
  if (!first) return '新对话'
  const text = first.content.trim()
  return text.length > 30 ? text.slice(0, 30) + '...' : text
}

export function useSessions() {
  const [sessions, setSessions] = useState(() => loadSessions())
  const [activeSessionId, setActiveSessionId] = useState(null)

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  const createSession = useCallback(() => {
    const id = generateId()
    const session = {
      id,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setSessions(prev => [session, ...prev])
    setActiveSessionId(id)
    return id
  }, [])

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    setActiveSessionId(prev => prev === id ? null : prev)
  }, [])

  const updateSessionMessages = useCallback((id, messages) => {
    setSessions(prev => prev.map(s =>
      s.id === id
        ? { ...s, messages, title: extractTitle(messages), updatedAt: Date.now() }
        : s
    ))
  }, [])

  const renameSession = useCallback((id, title) => {
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, title } : s
    ))
  }, [])

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
  }
}
