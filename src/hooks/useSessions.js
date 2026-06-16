import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'
const STORAGE_KEY = 'agentdesk_sessions'
const ACTIVE_SESSION_KEY = 'agentdesk_active_session_id'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// 从 localStorage 获取保存的活跃 session ID
function getSavedActiveSessionId() {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY)
  } catch {
    return null
  }
}

// 保存活跃 session ID 到 localStorage
function saveActiveSessionId(sessionId) {
  try {
    if (sessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, sessionId)
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY)
    }
  } catch (err) {
    console.error('保存 session ID 失败:', err)
  }
}

// 合并同一天的会话
function mergeSessionsByDay(sessions) {
  const dayMap = new Map()
  
  sessions.forEach(s => {
    // 从session ID提取日期 (格式: YYYYMMDD_HHMMSS_xxxxx)
    const dateMatch = s.id.match(/^(\d{8})_/)
    const dateKey = dateMatch ? dateMatch[1] : 'unknown'
    
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        ...s,
        id: `day_${dateKey}`,
        title: formatDateKey(dateKey),
        messageCount: s.messageCount,
        subSessions: [s],
        isGroup: true,
      })
    } else {
      const group = dayMap.get(dateKey)
      group.messageCount += s.messageCount
      group.subSessions.push(s)
      // 用最新的session的时间作为组的时间
      if (s.time > group.time) {
        group.time = s.time
      }
    }
  })
  
  return Array.from(dayMap.values())
}

function formatDateKey(dateKey) {
  const year = dateKey.slice(0, 4)
  const month = dateKey.slice(4, 6)
  const day = dateKey.slice(6, 8)
  
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10).replace(/-/g, '')
  
  if (dateKey === todayStr) return '今天'
  if (dateKey === yesterdayStr) return '昨天'
  return `${month}/${day}`
}

export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [rawSessions, setRawSessions] = useState([])
  const [activeSessionId, setActiveSessionIdState] = useState(null)
  const [loading, setLoading] = useState(true)

  // 包装 setActiveSessionId，同时保存到 localStorage
  const setActiveSessionId = useCallback((id) => {
    setActiveSessionIdState(id)
    saveActiveSessionId(id)
  }, [])

  // 从代理服务器加载会话列表
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`)
      if (!res.ok) throw new Error('Failed to fetch sessions')
      const data = await res.json()
      setRawSessions(data)
      // 合并同一天的会话
      const merged = mergeSessionsByDay(data)
      setSessions(merged)
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

  // 初始化时恢复保存的活跃 session ID
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      const savedId = getSavedActiveSessionId()
      if (savedId) {
        // 检查保存的 session 是否存在
        const sessionExists = sessions.some(s => s.id === savedId)
        if (sessionExists) {
          setActiveSessionIdState(savedId)
          return
        }
      }
      // 如果没有保存的 session 或保存的 session 不存在，使用第一个
      setActiveSessionIdState(sessions[0].id)
    }
  }, [sessions, activeSessionId])

  // 本地创建新会话（支持 agentId 参数）
  const createSession = useCallback((agentId = null) => {
    const id = generateId()
    const session = {
      id,
      title: agentId ? `${agentId} 对话` : '新对话',
      messages: [],
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      platform: 'local',
      agentId: agentId || null, // 关联的 Agent ID
    }
    setSessions(prev => [session, ...prev])
    setActiveSessionId(id)
    // 保存活跃 session ID 到 localStorage（持久化）
    saveActiveSessionId(id)
    // 保存到 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify([session, ...sessions]))
    return id
  }, [sessions])

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    setActiveSessionIdState(prev => {
      if (prev === id) {
        saveActiveSessionId(null)
        return null
      }
      return prev
    })
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

  // 加载单个会话的消息（支持合并会话）
  const loadSessionMessages = useCallback(async (sessionId) => {
    // 如果是合并的会话，加载所有子会话的消息
    if (sessionId.startsWith('day_')) {
      const group = sessions.find(s => s.id === sessionId)
      if (group && group.subSessions) {
        const allMessages = []
        for (const sub of group.subSessions) {
          try {
            const res = await fetch(`${API_BASE}/api/sessions/${sub.id}/messages`)
            if (res.ok) {
              const msgs = await res.json()
              allMessages.push(...msgs)
            }
          } catch (err) {
            console.error(`加载会话 ${sub.id} 失败:`, err)
          }
        }
        // 更新本地会话数据
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, messages: allMessages, messageCount: allMessages.length } : s
        ))
        return allMessages
      }
    }
    
    // 普通会话
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const messages = await res.json()
      // 更新本地会话数据
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages, messageCount: messages.length } : s
      ))
      return messages
    } catch (err) {
      console.error('获取会话消息失败:', err)
      return []
    }
  }, [sessions])

  const activeSession = sessions.find(s => s.id === activeSessionId) || null

  // 获取指定 Agent 的会话列表
  const getAgentSessions = useCallback((agentId) => {
    return sessions.filter(s => s.agentId === agentId)
  }, [sessions])

  // 获取或创建指定 Agent 的会话
  const getOrCreateAgentSession = useCallback((agentId) => {
    // 查找该 Agent 的最新会话
    const agentSessions = sessions.filter(s => s.agentId === agentId)
    if (agentSessions.length > 0) {
      // 返回最新的会话
      const latestSession = agentSessions.sort((a, b) => b.updatedAt - a.updatedAt)[0]
      setActiveSessionId(latestSession.id)
      return latestSession.id
    }
    // 如果没有，创建一个新的
    return createSession(agentId)
  }, [sessions, createSession])

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
    loadSessionMessages,
    getAgentSessions,
    getOrCreateAgentSession,
    loading,
  }
}
