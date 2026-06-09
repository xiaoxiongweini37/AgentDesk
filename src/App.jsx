import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import TaskList from './components/TaskList'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import { useHermes } from './hooks/useHermes'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState([])
  const { sendMessage, isLoading, error } = useHermes()

  const handleSendMessage = async (msg) => {
    // 添加用户消息
    const userMessage = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMessage])

    try {
      // 构建完整的消息历史
      const allMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }))

      // 调用 Hermes API
      const response = await sendMessage(allMessages)
      
      // 添加助手回复
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response 
      }])
    } catch (err) {
      console.error('发送失败:', err)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ 发送失败: ${error || err.message}` 
      }])
    }
  }

  const handleFileUpload = (files) => {
    console.log('上传文件:', files)
    // TODO: 处理文件上传
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `📎 收到 ${files.length} 个文件：${Array.from(files).map(f => f.name).join(', ')}`
    }])
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {activeTab === 'chat' && (
          <Chat 
            messages={messages} 
            onSend={handleSendMessage}
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'tasks' && <TaskList />}
        {activeTab === 'files' && <FileUpload onUpload={handleFileUpload} />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>
    </div>
  )
}

export default App
