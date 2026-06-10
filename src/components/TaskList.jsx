import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

export default function TaskList() {
  const [tasks, setTasks] = useState([
    { id: 1, title: '示例任务 1', status: 'pending', priority: 'high' },
    { id: 2, title: '示例任务 2', status: 'in_progress', priority: 'medium' },
    { id: 3, title: '示例任务 3', status: 'completed', priority: 'low' },
  ])
  const [newTask, setNewTask] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // 任务列表入场动画
  useEffect(() => {
    if (containerRef.current) {
      const items = containerRef.current.querySelectorAll('.task-item')
      gsap.from(items, {
        x: -30,
        autoAlpha: 0,
        duration: 0.4,
        ease: 'power2.out',
        stagger: 0.1,
      })
    }
  }, [])

  const addTask = () => {
    if (newTask.trim()) {
      const newId = Date.now()
      setTasks(prev => [...prev, {
        id: newId,
        title: newTask.trim(),
        status: 'pending',
        priority: 'medium',
      }])
      setNewTask('')
      
      // 新任务入场动画
      setTimeout(() => {
        const newItem = containerRef.current?.querySelector(`[data-id="${newId}"]`)
        if (newItem) {
          gsap.from(newItem, {
            x: -50,
            autoAlpha: 0,
            duration: 0.5,
            ease: 'back.out(1.7)',
          })
        }
      }, 10)
    }
  }

  const toggleStatus = (id) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = {
          pending: 'in_progress',
          in_progress: 'completed',
          completed: 'pending',
        }
        return { ...t, status: nextStatus[t.status] }
      }
      return t
    }))
    
    // 状态切换动画
    const item = containerRef.current?.querySelector(`[data-id="${id}"]`)
    if (item) {
      gsap.to(item, {
        scale: 1.02,
        duration: 0.2,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1,
      })
    }
  }

  const deleteTask = (id) => {
    // 删除动画
    const item = containerRef.current?.querySelector(`[data-id="${id}"]`)
    if (item) {
      gsap.to(item, {
        x: 50,
        autoAlpha: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          setTasks(prev => prev.filter(t => t.id !== id))
        },
      })
    }
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
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20, color: 'var(--text-primary)' }}>📋 任务列表</h2>

      {/* Add task */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          ref={inputRef}
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask()}
          placeholder="添加新任务..."
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={addTask}
          style={{
            padding: '8px 20px',
            border: 'none',
            borderRadius: 'var(--radius)',
            background: 'var(--accent)',
            color: 'var(--bg-primary)',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          添加
        </button>
      </div>

      {/* Task list */}
      <div 
        ref={containerRef}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {tasks.map(task => (
          <div
            key={task.id}
            data-id={task.id}
            className="task-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => {
              gsap.to(e.currentTarget, {
                borderColor: 'var(--accent)',
                duration: 0.2,
              })
            }}
            onMouseLeave={(e) => {
              gsap.to(e.currentTarget, {
                borderColor: 'var(--border)',
                duration: 0.2,
              })
            }}
          >
            <button
              onClick={() => toggleStatus(task.id)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: `2px solid ${statusColors[task.status]}`,
                background: task.status === 'completed' ? statusColors[task.status] : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--bg-primary)',
                fontSize: 12,
              }}
            >
              {task.status === 'completed' && '✓'}
            </button>

            <span style={{
              flex: 1,
              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
              color: task.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)',
            }}>
              {task.title}
            </span>

            <span style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'var(--bg-secondary)',
              color: statusColors[task.status],
            }}>
              {statusLabels[task.status]}
            </span>

            <button
              onClick={() => deleteTask(task.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 16,
                padding: '4px',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
