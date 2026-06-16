import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:3001'

// 默认Agent列表（配置加载前使用）
const DEFAULT_AGENTS = [
  { id: 'commander', name: '总指挥', icon: '🎯', color: '#4fc3f7' },
  { id: 'worker', name: 'A号', icon: '⚡', color: '#ff9800' },
  { id: 'coder-b', name: 'B号', icon: '🔧', color: '#4caf50' },
  { id: 'coder-c', name: 'C号', icon: '🧪', color: '#9c27b0' },
  { id: 'claude-code', name: 'Claude', icon: '🤖', color: '#e91e63' },
]

// Agent图标映射
const AGENT_ICONS = {
  commander: '🎯',
  worker: '⚡',
  'coder-b': '🔧',
  'coder-c': '🧪',
  'claude-code': '🤖',
}

// Agent颜色映射
const AGENT_COLORS = {
  commander: '#4fc3f7',
  worker: '#ff9800',
  'coder-b': '#4caf50',
  'coder-c': '#9c27b0',
  'claude-code': '#e91e63',
}

export function useAgentConfig() {
  const [agents, setAgents] = useState(DEFAULT_AGENTS)
  const [loading, setLoading] = useState(true)

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`)
      if (res.ok) {
        const data = await res.json()
        // 添加图标和颜色
        const enriched = data.map(agent => ({
          ...agent,
          icon: AGENT_ICONS[agent.id] || '❓',
          color: AGENT_COLORS[agent.id] || '#666',
        }))
        setAgents(enriched)
      }
    } catch (err) {
      console.error('Failed to load agent config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const getAgent = useCallback((agentId) => {
    return agents.find(a => a.id === agentId) || {
      id: agentId,
      name: agentId,
      icon: '❓',
      color: '#666',
    }
  }, [agents])

  return {
    agents,
    loading,
    getAgent,
    refresh: fetchAgents,
  }
}

export default useAgentConfig
