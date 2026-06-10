import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import TaskList from './components/TaskList'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import { useHermes } from './hooks/useHermes'
import { useSessions } from './hooks/useSessions'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [showSettings, setShowSettings] = useState(false)
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
    loading,
  } = useSessions()

  const messages = activeSession?.messages || []

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
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSettings={() => setShowSettings(true)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleNewSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onRefreshSessions={refreshSessions}
      />

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {activeTab === 'chat' && (
          <Chat
            key={activeSessionId || 'empty'}
            messages={messages}
            onSend={handleSendMessage}
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
            streamingText={streamingText}
          />
        )}
        {activeTab === 'tasks' && <TaskList />}
        {activeTab === 'files' && <FileUpload onUpload={handleFileUpload} />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
