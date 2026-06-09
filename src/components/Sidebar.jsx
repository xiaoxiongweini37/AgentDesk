import { useState } from 'react'

const tabs = [
  { id: 'chat', icon: '💬', label: '对话' },
  { id: 'tasks', icon: '📋', label: '任务' },
  { id: 'files', icon: '📁', label: '文件' },
  { id: 'dashboard', icon: '📊', label: '看板' },
]

export default function Sidebar({ activeTab, onTabChange }) {
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
      {/* Logo */}
      <div style={{
        fontSize: 24,
        marginBottom: 16,
        padding: '8px',
      }}>
        🤖
      </div>

      {/* Tabs */}
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
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
            transition: 'all 0.2s',
          }}
        >
          {tab.icon}
        </button>
      ))}

      {/* Bottom section */}
      <div style={{ marginTop: 'auto' }}>
        <button
          title="设置"
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
