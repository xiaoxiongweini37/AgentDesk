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

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [showSettings, setShowSettings] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(true)
  const [showDevTools, setShowDevTools] = useState(false)
  const [showSessionSearch, setShowSessionSearch] = useState(false)
  const [showMessagePanel, setShowMessagePanel] = useState(false)
  const [showTaskPanel, setShowTaskPanel] = useState(false)
  const [showCollaborationFlow, setShowCollaborationFlow] = useState(false)

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

  // 调试信息
  useEffect(() => {
    console.log('[App] agents:', agents)
    console.log('[App] selectedAgentId:', selectedAgentId)
    console.log('[App] agents.length:', agents.length)
  }, [agents, selectedAgentId])

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

      {/* 开发者工具 */}
      <DevTools
        isOpen={showDevTools}
        onClose={() => setShowDevTools(false)}
      />
    </div>
  )
}

export default App
