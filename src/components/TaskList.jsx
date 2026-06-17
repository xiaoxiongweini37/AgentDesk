/**
 * TaskList - 任务列表组件
 *
 * 使用真正的后端 API 管理任务
 */

import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

const API_BASE = 'http://localhost:3001'

const STATUS_COLORS = {
  pending: 'var(--text-secondary)',
  in_progress: 'var(--warning)',
  completed: 'var(--success)',
  failed: 'var(--error)',
}

const STATUS_LABELS = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  failed: '失败',
}

const PRIORITY_LABELS = {
  low: '低',
  normal: '中',
  high: '高',
  urgent: '紧急',
}

export default function TaskList() {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const listRef = useRef(null)

  // 加载任务
  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tasks`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (err) {
      console.error('加载任务失败:', err)
    }
    setLoading(false)
  }

  const addTask = async () => {
    if (!newTask.trim()) return

    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask.trim() }),
      })

      if (res.ok) {
        const task = await res.json()
        setTasks(prev => [task, ...prev])
        setNewTask('')
      }
    } catch (err) {
      console.error('创建任务失败:', err)
    }
  }

  const toggleStatus = async (e, id) => {
    gsap.to(e.currentTarget, { scale: 0.9, duration: 0.1, ease: 'power2.inOut', yoyo: true, repeat: 1 })

    const task = tasks.find(t => t.id === id)
    if (!task) return

    const nextStatus = { pending: 'in_progress', in_progress: 'completed', completed: 'pending' }
    const newStatus = nextStatus[task.status]

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const updatedTask = await res.json()
        setTasks(prev => prev.map(t => t.id === id ? updatedTask : t))
      }
    } catch (err) {
      console.error('更新任务失败:', err)
    }
  }

  const deleteTask = async (e, id) => {
    gsap.to(e.currentTarget.closest('.task-item'), {
      x: 50, opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: async () => {
        try {
          await fetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE' })
          setTasks(prev => prev.filter(t => t.id !== id))
        } catch (err) {
          console.error('删除任务失败:', err)
        }
      },
    })
  }

  // 过滤任务
  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter(t => t.status === filter)

  // 统计
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20, color: 'var(--text-primary)', fontSize: 20, fontWeight: 600 }}>📋 任务列表</h2>

      {/* 统计 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div className="glass-card" style={{ padding: '10px 16px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>总任务</div>
        </div>
        <div className="glass-card" style={{ padding: '10px 16px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLORS.pending }}>{stats.pending}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>待处理</div>
        </div>
        <div className="glass-card" style={{ padding: '10px 16px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLORS.in_progress }}>{stats.in_progress}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>进行中</div>
        </div>
        <div className="glass-card" style={{ padding: '10px 16px', flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLORS.completed }}>{stats.completed}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已完成</div>
        </div>
      </div>

      {/* 添加任务 */}
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

      {/* 筛选 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all', 'pending', 'in_progress', 'completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? 'glass-btn-primary' : 'glass-btn'}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              border: filter === f ? 'none' : '1px solid var(--glass-border)',
              cursor: 'pointer',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {f === 'all' ? '全部' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>加载中...</div>
      ) : (
        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
              {filter === 'all' ? '暂无任务' : `暂无${STATUS_LABELS[filter]}的任务`}
            </div>
          ) : (
            filteredTasks.map(task => (
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
                    border: `2px solid ${STATUS_COLORS[task.status]}`,
                    background: task.status === 'completed' ? STATUS_COLORS[task.status] : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, flexShrink: 0,
                    transition: 'var(--transition)',
                    boxShadow: task.status === 'completed' ? `0 0 8px ${STATUS_COLORS[task.status]}` : 'none',
                  }}
                >
                  {task.status === 'completed' && '✓'}
                </button>

                <div style={{ flex: 1 }}>
                  <span style={{
                    textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                    color: task.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)',
                    fontSize: 14,
                  }}>
                    {task.title}
                  </span>
                  {task.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {task.description.substring(0, 50)}{task.description.length > 50 ? '...' : ''}
                    </div>
                  )}
                </div>

                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: 'var(--glass-bg)',
                  color: task.priority === 'high' || task.priority === 'urgent' ? 'var(--error)' : 'var(--text-secondary)',
                  border: '1px solid var(--glass-border)',
                }}>
                  {PRIORITY_LABELS[task.priority]}
                </span>

                <span style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  background: 'var(--glass-bg)',
                  color: STATUS_COLORS[task.status],
                  border: '1px solid var(--glass-border)',
                }}>
                  {STATUS_LABELS[task.status]}
                </span>

                <button
                  onClick={(e) => deleteTask(e, task.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: '4px 8px', borderRadius: 6 }}
                >✕</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
