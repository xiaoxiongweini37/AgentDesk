import { useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'
const SELECTED_AGENT_KEY = 'agentdesk_selected_agent'
const AGENT_SESSIONS_KEY = 'agentdesk_agent_sessions'

// 从 localStorage 获取保存的 Agent 选择
function getSavedAgentId() {
  try {
    return localStorage.getItem(SELECTED_AGENT_KEY)
  } catch {
    return null
  }
}

// 保存 Agent 选择到 localStorage
function saveAgentId(agentId) {
  try {
    if (agentId) {
      localStorage.setItem(SELECTED_AGENT_KEY, agentId)
    } else {
      localStorage.removeItem(SELECTED_AGENT_KEY)
    }
  } catch (err) {
    console.error('保存 Agent 选择失败:', err)
  }
}

// 获取 Agent 会话映射
function getAgentSessions() {
  try {
    const raw = localStorage.getItem(AGENT_SESSIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// 保存 Agent 会话映射
function saveAgentSessions(mapping) {
  try {
    localStorage.setItem(AGENT_SESSIONS_KEY, JSON.stringify(mapping))
  } catch (err) {
    console.error('保存 Agent 会话映射失败:', err)
  }
}

export function useAgentSelector() {
  const [agents, setAgents] = useState([])
  const [selectedAgentId, setSelectedAgentIdState] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [agentStatus, setAgentStatus] = useState({})
  const [loading, setLoading] = useState(true)

  // 加载 Agent 列表
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`)
      if (res.ok) {
        const data = await res.json()
        setAgents(data)

        // 恢复上次选择的 Agent
        const savedId = getSavedAgentId()
        if (savedId) {
          const found = data.find(a => a.id === savedId)
          if (found) {
            setSelectedAgentIdState(savedId)
            setSelectedAgent(found)
          } else if (data.length > 0) {
            setSelectedAgentIdState(data[0].id)
            setSelectedAgent(data[0])
          }
        } else if (data.length > 0) {
          setSelectedAgentIdState(data[0].id)
          setSelectedAgent(data[0])
        }
      }
    } catch (err) {
      console.error('加载 Agent 列表失败:', err)
    }
    setLoading(false)
  }, [])

  // 加载 Agent 状态
  const fetchAgentStatus = useCallback(async () => {
    const statuses = {}
    for (const agent of agents) {
      try {
        const res = await fetch(`${API_BASE}/api/agents/${agent.id}/status`)
        if (res.ok) {
          statuses[agent.id] = await res.json()
        }
      } catch (err) {
        statuses[agent.id] = { status: 'unknown' }
      }
    }
    setAgentStatus(statuses)
  }, [agents])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  useEffect(() => {
    if (agents.length > 0) {
      fetchAgentStatus()
      // 每 30 秒刷新状态
      const timer = setInterval(fetchAgentStatus, 30000)
      return () => clearInterval(timer)
    }
  }, [agents, fetchAgentStatus])

  // 切换 Agent
  const selectAgent = useCallback((agentId) => {
    const agent = agents.find(a => a.id === agentId)
    if (agent) {
      setSelectedAgentIdState(agentId)
      setSelectedAgent(agent)
      saveAgentId(agentId)
    }
  }, [agents])

  // 测试 Agent 连接
  const testConnection = useCallback(async (agentId) => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/test`, {
        method: 'POST',
      })
      return await res.json()
    } catch (err) {
      return { success: false, message: err.message }
    }
  }, [])

  // 启动 Agent
  const startAgent = useCallback(async (agentId) => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/start`, {
        method: 'POST',
      })
      const result = await res.json()

      // 保存 Agent 会话映射
      if (result.session_id) {
        const mapping = getAgentSessions()
        mapping[agentId] = result.session_id
        saveAgentSessions(mapping)
      }

      // 刷新状态
      fetchAgentStatus()

      return result
    } catch (err) {
      return { error: err.message }
    }
  }, [fetchAgentStatus])

  // 停止 Agent
  const stopAgent = useCallback(async (agentId) => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/stop`, {
        method: 'POST',
      })
      const result = await res.json()

      // 刷新状态
      fetchAgentStatus()

      return result
    } catch (err) {
      return { error: err.message }
    }
  }, [fetchAgentStatus])

  // 获取 Agent 日志
  const getAgentLogs = useCallback(async (agentId) => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/logs`)
      if (res.ok) {
        return await res.json()
      }
      return { logs: [] }
    } catch (err) {
      return { logs: [] }
    }
  }, [])

  // 获取当前 Agent 的会话 ID
  const getAgentSessionId = useCallback((agentId) => {
    const mapping = getAgentSessions()
    return mapping[agentId] || null
  }, [])

  return {
    agents,
    selectedAgentId,
    selectedAgent,
    agentStatus,
    loading,
    selectAgent,
    testConnection,
    startAgent,
    stopAgent,
    getAgentLogs,
    getAgentSessionId,
    refreshAgents: fetchAgents,
    refreshStatus: fetchAgentStatus,
  }
}
