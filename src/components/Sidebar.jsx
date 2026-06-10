import { useState } from 'react'
import { gsap } from '../utils/animations'

const tabs = [
  { id: 'chat', icon: '💬', label: '对话' },
  { id: 'tasks', icon: '📋', label: '任务' },
  { id: 'files', icon: '📁', label: '文件' },
  { id: 'dashboard', icon: '📊', label: '看板' },
]

export default function Sidebar({ activeTab, onTabChange }) {
  const handleClick = (e, tabId) => {
    // 点击动画
    gsap.to(e.currentTarget, {
      scale: 0.9,
      duration: 0.1,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 1,
    })
    onTabChange(tabId)
  }

  const handleMouseEnter = (e) => {
    gsap.to(e.currentTarget, {
      scale: 1.1,
      duration: 0.2,
      ease: 'power2.out',
    })
  }

  const handleMouseLeave = (e) => {
    gsap.to(e.currentTarget, {
      scale: 1,
      duration: 0.2,
      ease: 'power2.out',
    })
  }

  return (
    <aside style={{
      width: 60,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px 0',
      gap: 8,
    }}>
      <div style={{
        fontSize: 24,
        marginBottom: 16,
        padding: '8px',
      }}>
        🤖
      </div>

      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={(e) => handleClick(e, tab.id)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          title={tab.label}
          style={{
            width: 44,
            height: 44,
            border: 'none',
            borderRadius: 'var(--radius)',
            background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
            color: activeTab === tab.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {tab.icon}
        </button>
      ))}

      <div style={{ marginTop: 'auto' }}>
        <button
          title="设置"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            width: 44,
            height: 44,
            border: 'none',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          ⚙️
        </button>
      </div>
    </aside>
  )
}
