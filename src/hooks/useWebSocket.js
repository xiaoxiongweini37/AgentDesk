/**
 * useWebSocket - WebSocket 客户端 Hook
 *
 * 功能：
 * - 连接到 WebSocket 服务器
 * - 接收任务通知
 * - 自动重连
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const WS_BASE = 'ws://localhost:3001'

export function useWebSocket(agentId = null) {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const [notifications, setNotifications] = useState([])
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return
    }

    const url = agentId ? `${WS_BASE}?agentId=${agentId}` : WS_BASE
    const ws = new WebSocket(url)

    ws.onopen = () => {
      console.log('[WebSocket] 已连接')
      setConnected(true)
      // 清除重连定时器
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('[WebSocket] 收到消息:', message)
        setLastMessage(message)

        // 添加到通知列表
        setNotifications(prev => [...prev.slice(-50), {
          ...message,
          receivedAt: Date.now(),
        }])
      } catch (err) {
        console.error('[WebSocket] 解析消息失败:', err)
      }
    }

    ws.onclose = () => {
      console.log('[WebSocket] 连接关闭')
      setConnected(false)
      wsRef.current = null

      // 自动重连（每 5 秒）
      reconnectTimerRef.current = setTimeout(() => {
        console.log('[WebSocket] 尝试重连...')
        connect()
      }, 5000)
    }

    ws.onerror = (error) => {
      console.error('[WebSocket] 错误:', error)
    }

    wsRef.current = ws
  }, [agentId])

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  // 发送消息
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    return false
  }, [])

  // 清除通知
  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // 组件挂载时连接
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    connected,
    lastMessage,
    notifications,
    sendMessage,
    clearNotifications,
    connect,
    disconnect,
  }
}

export default useWebSocket
