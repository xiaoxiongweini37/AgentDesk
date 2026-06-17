/**
 * useAgentTaskProcessor - Agent 任务处理器
 *
 * 功能：
 * - 监听 WebSocket 任务通知
 * - 自动获取任务详情
 * - 调用 CLI 执行任务
 * - 报告任务完成/失败
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = 'http://localhost:3001'

export function useAgentTaskProcessor(agentId, wsLastMessage) {
  const [currentTask, setCurrentTask] = useState(null)
  const [taskStatus, setTaskStatus] = useState('idle') // idle, fetching, executing, completing, failed
  const [taskResult, setTaskResult] = useState(null)
  const [taskError, setTaskError] = useState(null)
  const [taskHistory, setTaskHistory] = useState([])

  // 监听 WebSocket 消息
  useEffect(() => {
    console.log('[TaskProcessor] wsLastMessage:', wsLastMessage)
    console.log('[TaskProcessor] agentId:', agentId)

    if (!wsLastMessage || !agentId) {
      console.log('[TaskProcessor] 跳过: wsLastMessage 或 agentId 为空')
      return
    }

    if (wsLastMessage.type === 'task_assigned') {
      console.log('[TaskProcessor] 收到任务通知:', wsLastMessage.task)
      handleNewTask(wsLastMessage.task)
    } else {
      console.log('[TaskProcessor] 消息类型不是 task_assigned:', wsLastMessage.type)
    }
  }, [wsLastMessage, agentId])

  // 处理新任务
  const handleNewTask = useCallback(async (taskInfo) => {
    if (currentTask) {
      console.log('[TaskProcessor] 已有任务在执行，跳过')
      return
    }

    console.log('[TaskProcessor] 开始处理任务:', taskInfo.id)
    setCurrentTask(taskInfo)
    setTaskStatus('fetching')
    setTaskResult(null)
    setTaskError(null)

    try {
      // 1. 获取任务详情
      const taskDetail = await fetchTaskDetail(taskInfo.id)
      if (!taskDetail) {
        throw new Error('获取任务详情失败')
      }

      setCurrentTask(taskDetail)
      setTaskStatus('executing')

      // 2. 执行任务
      const result = await executeTask(taskDetail)

      // 3. 报告完成
      setTaskStatus('completing')
      await reportTaskComplete(taskDetail.id, result)

      setTaskResult(result)
      setTaskStatus('idle')

      // 添加到历史记录
      setTaskHistory(prev => [...prev.slice(-20), {
        task: taskDetail,
        result,
        completedAt: Date.now(),
        status: 'completed',
      }])

      // 保持结果显示 30 秒，然后清除
      setTimeout(() => {
        setCurrentTask(null)
        setTaskResult(null)
      }, 30000)

      console.log('[TaskProcessor] 任务完成:', taskDetail.id)

    } catch (error) {
      console.error('[TaskProcessor] 任务失败:', error)
      setTaskError(error.message)
      setTaskStatus('failed')

      // 报告失败
      if (currentTask) {
        await reportTaskFailed(currentTask.id, error.message)
      }

      // 添加到历史记录
      setTaskHistory(prev => [...prev.slice(-20), {
        task: currentTask,
        error: error.message,
        failedAt: Date.now(),
        status: 'failed',
      }])

      setCurrentTask(null)
    }
  }, [agentId, currentTask])

  // 获取任务详情
  const fetchTaskDetail = useCallback(async (taskId) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`)
      if (res.ok) {
        return await res.json()
      }
      return null
    } catch (err) {
      console.error('[TaskProcessor] 获取任务详情失败:', err)
      return null
    }
  }, [])

  // 执行任务
  const executeTask = useCallback(async (task) => {
    console.log('[TaskProcessor] 执行任务:', task.title)

    // 构造任务消息（直接使用标题，避免复杂的格式）
    const taskMessage = task.title

    // 使用 test/agent API 直接调用 CLI（不需要 Agent 进程运行）
    const response = await fetch(`${API_BASE}/api/test/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agentId,
        message: taskMessage,
        cliType: 'claude',
      }),
    })

    if (!response.ok) {
      throw new Error('执行任务失败')
    }

    // 读取 SSE 响应
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullOutput = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'output') {
              fullOutput += data.content
            } else if (data.type === 'complete') {
              fullOutput = data.output || fullOutput
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    return {
      output: fullOutput,
      completedAt: Date.now(),
    }
  }, [agentId])

  // 报告任务完成
  const reportTaskComplete = useCallback(async (taskId, result) => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: result.output || '任务已完成',
        }),
      })

      if (!res.ok) {
        console.error('[TaskProcessor] 报告任务完成失败')
      }
    } catch (err) {
      console.error('[TaskProcessor] 报告任务完成失败:', err)
    }
  }, [agentId])

  // 报告任务失败
  const reportTaskFailed = useCallback(async (taskId, error) => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/tasks/${taskId}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error }),
      })

      if (!res.ok) {
        console.error('[TaskProcessor] 报告任务失败失败')
      }
    } catch (err) {
      console.error('[TaskProcessor] 报告任务失败失败:', err)
    }
  }, [agentId])

  // 手动触发任务处理
  const processNextTask = useCallback(async () => {
    if (currentTask) {
      console.log('[TaskProcessor] 已有任务在执行')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/tasks/next`)
      if (res.ok) {
        const task = await res.json()
        if (task) {
          handleNewTask(task)
        } else {
          console.log('[TaskProcessor] 没有待处理任务')
        }
      }
    } catch (err) {
      console.error('[TaskProcessor] 获取任务失败:', err)
    }
  }, [agentId, currentTask, handleNewTask])

  return {
    currentTask,
    taskStatus,
    taskResult,
    taskError,
    taskHistory,
    processNextTask,
  }
}

export default useAgentTaskProcessor
