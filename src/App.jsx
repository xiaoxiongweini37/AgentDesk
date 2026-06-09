import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import TaskList from './components/TaskList'
import FileUpload from './components/FileUpload'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState([])

  const handleSendMessage = (msg) => {
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    // TODO: 调用 Hermes API
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `收到：${msg}（功能开发中...）` 
      }])
    }, 500)
  }

  const handleFileUpload = (files) => {
    console.log('上传文件:', files)
    // TODO: 处理文件上传
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
          />
        )}
        {activeTab === 'tasks' && <TaskList />}
        {activeTab === 'files' && <FileUpload onUpload={handleFileUpload} />}
      </main>
    </div>
  )
}

export default App
