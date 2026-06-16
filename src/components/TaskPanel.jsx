import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

const AGENTS = [
  { id: 'worker', name: 'A号', icon: '⚡', color: '#ff9800', capabilities: ['coding', 'ocr_recognition', 'image_analysis'] },
  { id: 'coder-b', name: 'B号', icon: '🔧', color: '#4caf50', capabilities: ['coding', 'architecture', 'code_review'] },
  { id: 'coder-c', name: 'C号', icon: '🧪', color: '#9c27b0', capabilities: ['testing', 'evaluation', 'quality_assurance'] },
]

const TASK_STATUS_COLORS = {
  pending: '#ff9800', assigned: '#2196f3', in_progress: '#4caf50',
  completed: '#8bc34a', failed: '#f44336', cancelled: '#9e9e9e',
}

const TASK_STATUS_LABELS = {
  pending: '待分配', assigned: '已分配', in_progress: '进行中',
  completed: '已完成', failed: '失败', cancelled: '已取消',
}

export default function TaskPanel({ isOpen, onClose }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', priority: 'normal', required_capabilities: [] })

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const url = filter === 'all' ? `${API_BASE}/api/tasks` : `${API_BASE}/api/tasks?status=${filter}`
      const res = await fetch(url)
      setTasks(await res.json())
    } catch (err) { console.error('加载任务失败:', err) }
    setLoading(false)
  }

  useEffect(() => { if (isOpen) fetchTasks() }, [isOpen, filter])

  const handleCreateTask = async () => {
    if (!newTask.title) return
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      })
      if (res.ok) {
        setShowCreateModal(false)
        setNewTask({ title: '', description: '', assigned_to: '', priority: 'normal', required_capabilities: [] })
        fetchTasks()
      }
    } catch (err) { console.error('创建任务失败:', err) }
  }

  const handleUpdateStatus = async (taskId, status) => {
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      fetchTasks()
    } catch (err) { console.error('更新任务失败:', err) }
  }

  const handleAutoAssign = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/auto-assign`, { method: 'POST' })
      const data = await res.json()
      alert(`已分配 ${data.assigned?.length || 0} 个任务`)
      fetchTasks()
    } catch (err) { console.error('自动分配失败:', err) }
  }

  const getAgent = (id) => AGENTS.find(a => a.id === id) || { name: id || '未分配', icon: '❓', color: '#666' }

  if (!isOpen) return null

  return (
    <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="glass-modal animate-slide-up" style={{ padding: 24, width: 900, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>📋 任务管理中心</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAutoAssign} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #9c27b0, #ba68c8)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>🤖 自动分配</button>
            <button onClick={() => setShowCreateModal(true)} className="glass-btn-primary" style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}>➕ 新建任务</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* 状态筛选 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('all')} className={filter === 'all' ? 'glass-btn-primary' : 'glass-btn'} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer', color: filter === 'all' ? '#fff' : 'var(--text-secondary)' }}>全部</button>
          {Object.entries(TASK_STATUS_LABELS).map(([status, label]) => (
            <button key={status} onClick={() => setFilter(status)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12,
              border: filter === status ? 'none' : '1px solid var(--glass-border)',
              background: filter === status ? TASK_STATUS_COLORS[status] : 'var(--glass-bg)',
              color: filter === status ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'var(--transition)',
            }}>{label}</button>
          ))}
        </div>

        {/* 任务列表 */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>加载中...</div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13, opacity: 0.6 }}>暂无任务</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map((task, i) => {
                const agent = getAgent(task.assigned_to)
                const statusColor = TASK_STATUS_COLORS[task.status] || '#666'
                const statusLabel = TASK_STATUS_LABELS[task.status] || task.status
                return (
                  <div key={task.id || i} className="glass-card" style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{task.title}</span>
                      <span style={{ marginLeft: 'auto', padding: '2px 10px', background: statusColor + '15', borderRadius: 20, fontSize: 11, color: statusColor }}>{statusLabel}</span>
                      {task.priority === 'high' && (
                        <span style={{ padding: '2px 8px', background: 'rgba(239, 83, 80, 0.15)', borderRadius: 20, fontSize: 10, color: 'var(--error)' }}>紧急</span>
                      )}
                      {task.assigned_to && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: agent.color + '15', borderRadius: 20, fontSize: 11, color: agent.color }}>
                          {agent.icon} {agent.name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.6, opacity: 0.7 }}>{task.description?.substring(0, 150)}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {task.status === 'pending' && (
                        <>
                          <button onClick={() => handleUpdateStatus(task.id, 'assigned')} style={{ padding: '4px 10px', background: '#2196f3', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontSize: 11 }}>分配</button>
                          <button onClick={() => handleUpdateStatus(task.id, 'cancelled')} style={{ padding: '4px 10px', background: '#9e9e9e', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontSize: 11 }}>取消</button>
                        </>
                      )}
                      {task.status === 'assigned' && (
                        <button onClick={() => handleUpdateStatus(task.id, 'in_progress')} style={{ padding: '4px 10px', background: '#4caf50', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontSize: 11 }}>开始</button>
                      )}
                      {task.status === 'in_progress' && (
                        <>
                          <button onClick={() => handleUpdateStatus(task.id, 'completed')} style={{ padding: '4px 10px', background: '#8bc34a', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontSize: 11 }}>完成</button>
                          <button onClick={() => handleUpdateStatus(task.id, 'failed')} style={{ padding: '4px 10px', background: '#f44336', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer', fontSize: 11 }}>失败</button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 统计 */}
        <div className="glass-card" style={{ display: 'flex', gap: 16, padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>总计: {tasks.length} 个</span>
          <span>待分配: {tasks.filter(t => t.status === 'pending').length} 个</span>
          <span>进行中: {tasks.filter(t => t.status === 'in_progress').length} 个</span>
          <span>已完成: {tasks.filter(t => t.status === 'completed').length} 个</span>
        </div>
      </div>

      {/* 创建任务模态框 */}
      {showCreateModal && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => setShowCreateModal(false)}>
          <div className="glass-modal animate-slide-up" style={{ padding: 24, width: 500 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>➕ 创建任务</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>分配给</label>
              <select value={newTask.assigned_to} onChange={e => setNewTask(prev => ({ ...prev, assigned_to: e.target.value }))} className="glass-input" style={{ width: '100%', padding: '8px 12px' }}>
                <option value="">自动分配</option>
                {AGENTS.map(a => (<option key={a.id} value={a.id}>{a.icon} {a.name} ({a.capabilities.join(', ')})</option>))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>任务标题</label>
              <input value={newTask.title} onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))} placeholder="输入任务标题" className="glass-input" style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>任务描述</label>
              <textarea value={newTask.description} onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))} placeholder="输入任务描述" rows={3} className="glass-input" style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>优先级</label>
              <select value={newTask.priority} onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))} className="glass-input" style={{ width: '100%', padding: '8px 12px' }}>
                <option value="low">低</option>
                <option value="normal">中</option>
                <option value="high">高</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowCreateModal(false)} className="glass-btn" style={{ padding: '8px 16px', fontSize: 13 }}>取消</button>
              <button onClick={handleCreateTask} className="glass-btn-primary" style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
