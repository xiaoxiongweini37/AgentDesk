import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import TaskList from './components/TaskList'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import ContextPanel from './components/ContextPanel'
import SessionSearch from './components/SessionSearch'
import MessagePanel from './components/MessagePanel'
import TaskPanel from './components/TaskPanel'
import CollaborationFlow from './components/CollaborationFlow'
import DevTools from './components/DevTools'
import { useHermes } from './hooks/useHermes'
import { useSessions } from './hooks/useSessions'
import { useAgentSelector } from './hooks/useAgentSelector'
import { useWebSocket } from './hooks/useWebSocket'
import { useAgentTaskProcessor } from './hooks/useAgentTaskProcessor'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [showSettings, setShowSettings] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(true)
  const [showDevTools, setShowDevTools] = useState(false)
  const [showSessionSearch, setShowSessionSearch] = useState(false)
  const [showMessagePanel, setShowMessagePanel] = useState(false)
  const [showTaskPanel, setShowTaskPanel] = useState(false)
  const [showCollaborationFlow, setShowCollaborationFlow] = useState(false)
  const [taskNotification, setTaskNotification] = useState(null)

  // Agent 选择器
  const {
    agents,
    selectedAgentId,
    selectedAgent,
    agentStatus,
    selectAgent,
    testConnection,
    startAgent,
    stopAgent,
    getAgentLogs,
    refreshAgents,
    refreshStatus,
  } = useAgentSelector()

  // WebSocket 连接
  const {
    connected: wsConnected,
    lastMessage: wsLastMessage,
    notifications: wsNotifications,
  } = useWebSocket(selectedAgentId)

  // Agent 任务处理器
  const {
    currentTask,
    taskStatus,
    taskResult,
    taskError,
    taskHistory,
    processNextTask,
  } = useAgentTaskProcessor(selectedAgentId, wsLastMessage)

  // 调试信息
  useEffect(() => {
    console.log('[App] agents:', agents)
    console.log('[App] selectedAgentId:', selectedAgentId)
    console.log('[App] agents.length:', agents.length)
  }, [agents, selectedAgentId])

  // 处理 WebSocket 消息
  useEffect(() => {
    if (wsLastMessage && wsLastMessage.type === 'task_assigned') {
      // 收到任务通知
      setTaskNotification(wsLastMessage)

      // 3 秒后自动消失
      setTimeout(() => {
        setTaskNotification(null)
      }, 5000)
    }
  }, [wsLastMessage])

  // 将选中的 Agent 配置传递给 useHermes
  const { sendMessageStream, isLoading, error, streamingText } = useHermes(selectedAgent)

  const {
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
    getOrCreateAgentSession,
    loading,
  } = useSessions()

  const messages = activeSession?.messages || []

  // 选择会话时加载消息
  const handleSelectSession = useCallback(async (sessionId) => {
    setActiveSessionId(sessionId)
    // 如果会话没有消息，加载它们
    const session = sessions.find(s => s.id === sessionId)
    if (session && (!session.messages || session.messages.length === 0)) {
      await loadSessionMessages(sessionId)
    }
  }, [sessions, setActiveSessionId, loadSessionMessages])

  // 自动创建第一个会话
  useEffect(() => {
    if (sessions.length === 0) {
      createSession()
    } else if (!activeSessionId) {
      setActiveSessionId(sessions[0].id)
    }
  }, [sessions.length, activeSessionId])

  // 切换 Agent 时自动切换到该 Agent 的会话
  const handleSelectAgent = useCallback((agentId) => {
    selectAgent(agentId)
    // 获取或创建该 Agent 的会话
    if (agentId) {
      getOrCreateAgentSession(agentId)
    }
  }, [selectAgent, getOrCreateAgentSession])

  const handleSendMessage = async (msg) => {
    // 确保有活跃会话
    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = createSession()
    }

    const userMessage = { role: 'user', content: msg }
    const updatedMessages = [...messages, userMessage]
    updateSessionMessages(sessionId, updatedMessages)

    try {
      const allMessages = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const response = await sendMessageStream(allMessages, () => {})

      const finalMessages = [...updatedMessages, {
        role: 'assistant',
        content: response,
      }]
      updateSessionMessages(sessionId, finalMessages)
    } catch (err) {
      console.error('发送失败:', err)
      const finalMessages = [...updatedMessages, {
        role: 'assistant',
        content: `❌ 发送失败: ${error || err.message}`,
      }]
      updateSessionMessages(sessionId, finalMessages)
    }
  }

  const handleFileUpload = (files) => {
    let sessionId = activeSessionId
    if (!sessionId) sessionId = createSession()

    const fileMsg = {
      role: 'assistant',
      content: `📎 收到 ${files.length} 个文件：${Array.from(files).map(f => f.name).join(', ')}`,
    }
    updateSessionMessages(sessionId, [...messages, fileMsg])
  }

  const handleNewSession = () => {
    createSession()
    setActiveTab('chat')
  }

  // 加载历史会话
  const handleLoadSession = (session) => {
    // 创建新会话并加载历史消息
    const sessionId = createSession()
    updateSessionMessages(sessionId, session.messages)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* 左侧边栏 - 任务列表 */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSettings={() => setShowSettings(true)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleNewSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onRefreshSessions={refreshSessions}
        onToggleContext={() => setShowContextPanel(v => !v)}
        onOpenSessionSearch={() => setShowSessionSearch(true)}
        onOpenMessages={() => setShowMessagePanel(true)}
        onOpenTasks={() => setShowTaskPanel(true)}
        onOpenCollaboration={() => setShowCollaborationFlow(true)}
        onOpenDevTools={() => setShowDevTools(true)}
      />

      {/* 中间 - 对话区域 */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {activeTab === 'chat' && (
          <Chat
            key={activeSessionId || 'empty'}
            messages={messages}
            onSend={handleSendMessage}
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
            streamingText={streamingText}
            showContextPanel={showContextPanel}
            onToggleContext={() => setShowContextPanel(v => !v)}
            agents={agents}
            selectedAgentId={selectedAgentId}
            selectedAgent={selectedAgent}
            agentStatus={agentStatus}
            onSelectAgent={handleSelectAgent}
          />
        )}
        {activeTab === 'tasks' && <TaskList />}
        {activeTab === 'files' && <FileUpload onUpload={handleFileUpload} />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>

      {/* 右侧 - 功能面板 */}
      {activeTab === 'chat' && showContextPanel && (
        <ContextPanel
          sessionId={activeSessionId}
          onClose={() => setShowContextPanel(false)}
        />
      )}

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {/* 会话搜索弹窗 */}
      <SessionSearch
        isOpen={showSessionSearch}
        onClose={() => setShowSessionSearch(false)}
        onLoadSession={handleLoadSession}
      />

      {/* 消息中心弹窗 */}
      <MessagePanel
        isOpen={showMessagePanel}
        onClose={() => setShowMessagePanel(false)}
      />

      {/* 任务管理弹窗 */}
      <TaskPanel
        isOpen={showTaskPanel}
        onClose={() => setShowTaskPanel(false)}
      />

      {/* 协作流程弹窗 */}
      <CollaborationFlow
        isOpen={showCollaborationFlow}
        onClose={() => setShowCollaborationFlow(false)}
      />

      {/* 任务状态显示 */}
      {currentTask && (
        <div
          className="animate-slide-up"
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            minWidth: 300,
            maxWidth: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>
              {taskStatus === 'executing' ? '⚡' :
               taskStatus === 'completing' ? '✅' :
               taskStatus === 'failed' ? '❌' : '⏳'}
            </span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
              {taskStatus === 'executing' ? '正在执行任务' :
               taskStatus === 'completing' ? '正在完成任务' :
               taskStatus === 'failed' ? '任务失败' : '准备执行任务'}
            </span>
          </div>

          <div style={{ color: 'var(--text-primary)', fontSize: 13, marginBottom: 8 }}>
            {currentTask.title}
          </div>

          {taskStatus === 'executing' && (
            <div style={{ fontSize: 12, color: 'var(--accent-light)' }}>
              Agent 正在处理中...
            </div>
          )}

          {taskResult && (
            <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 8 }}>
              ✅ 任务已完成
            </div>
          )}

          {taskError && (
            <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 8 }}>
              ❌ {taskError}
            </div>
          )}
        </div>
      )}

      {/* 任务通知 */}
      {taskNotification && (
        <div
          className="animate-slide-up"
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1100,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: 350,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
              新任务通知
            </span>
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: 13, marginBottom: 8 }}>
            {taskNotification.message}
          </div>
          {taskNotification.task && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              优先级: {taskNotification.task.priority}
            </div>
          )}
          <button
            onClick={() => setTaskNotification(null)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* WebSocket 状态指示器 */}
      <div style={{
        position: 'fixed',
        bottom: 10,
        left: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: 'var(--glass-bg)',
        borderRadius: 20,
        fontSize: 11,
        color: 'var(--text-secondary)',
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: wsConnected ? 'var(--success)' : 'var(--error)',
          boxShadow: wsConnected ? '0 0 6px var(--success)' : 'none',
        }} />
        {wsConnected ? 'WS 已连接' : 'WS 未连接'}
      </div>

      {/* 开发者工具 */}
      <DevTools
        isOpen={showDevTools}
        onClose={() => setShowDevTools(false)}
      />
    </div>
  )
}

export default App
