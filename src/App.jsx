import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import TaskList from './components/TaskList'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import ContextPanel from './components/ContextPanel'
import { useHermes } from './hooks/useHermes'
import { useSessions } from './hooks/useSessions'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [showSettings, setShowSettings] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(true)
  const { sendMessageStream, isLoading, error, streamingText } = useHermes()

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
    </div>
  )
}

export default App
