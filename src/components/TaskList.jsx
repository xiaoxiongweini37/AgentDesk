import { useState, useRef } from 'react'
import { gsap } from '../utils/animations'

export default function TaskList() {
  const [tasks, setTasks] = useState([
    { id: 1, title: '示例任务 1', status: 'pending', priority: 'high' },
    { id: 2, title: '示例任务 2', status: 'in_progress', priority: 'medium' },
    { id: 3, title: '示例任务 3', status: 'completed', priority: 'low' },
  ])
  const [newTask, setNewTask] = useState('')
  const listRef = useRef(null)

  const addTask = () => {
    if (newTask.trim()) {
      setTasks(prev => [...prev, { id: Date.now(), title: newTask.trim(), status: 'pending', priority: 'medium' }])
      setNewTask('')
    }
  }

  const toggleStatus = (e, id) => {
    gsap.to(e.currentTarget, { scale: 0.9, duration: 0.1, ease: 'power2.inOut', yoyo: true, repeat: 1 })
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = { pending: 'in_progress', in_progress: 'completed', completed: 'pending' }
        return { ...t, status: nextStatus[t.status] }
      }
      return t
    }))
  }

  const deleteTask = (e, id) => {
    gsap.to(e.currentTarget.closest('.task-item'), {
      x: 50, opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: () => setTasks(prev => prev.filter(t => t.id !== id)),
    })
  }

  const statusColors = {
    pending: 'var(--text-secondary)',
    in_progress: 'var(--warning)',
    completed: 'var(--success)',
  }

  const statusLabels = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20, color: 'var(--text-primary)', fontSize: 20, fontWeight: 600 }}>📋 任务列表</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          placeholder="添加新任务..."
          className="glass-input"
          style={{ flex: 1, padding: '12px 16px', fontSize: 14 }}
        />
        <button
          onClick={addTask}
          className="glass-btn-primary"
          style={{ padding: '10px 24px', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#fff' }}
        >添加</button>
      </div>

      <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map(task => (
          <div
            key={task.id}
            className="task-item glass-card animate-fade-in"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              cursor: 'default',
            }}
          >
            <button
              onClick={(e) => toggleStatus(e, task.id)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                border: `2px solid ${statusColors[task.status]}`,
                background: task.status === 'completed' ? statusColors[task.status] : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, flexShrink: 0,
                transition: 'var(--transition)',
                boxShadow: task.status === 'completed' ? `0 0 8px ${statusColors[task.status]}` : 'none',
              }}
            >
              {task.status === 'completed' && '✓'}
            </button>

            <span style={{
              flex: 1,
              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
              color: task.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)',
              fontSize: 14,
            }}>
              {task.title}
            </span>

            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 20,
              background: 'var(--glass-bg)',
              color: statusColors[task.status],
              border: '1px solid var(--glass-border)',
            }}>
              {statusLabels[task.status]}
            </span>

            <button
              onClick={(e) => deleteTask(e, task.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: '4px 8px', borderRadius: 6 }}
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
