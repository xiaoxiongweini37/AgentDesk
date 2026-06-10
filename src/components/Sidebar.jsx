import { useState, useEffect, useRef } from 'react'
import { gsap } from '../utils/animations'

const tabs = [
  { id: 'chat', icon: '💬', label: '对话' },
  { id: 'tasks', icon: '📋', label: '任务' },
  { id: 'files', icon: '📁', label: '文件' },
  { id: 'dashboard', icon: '📊', label: '看板' },
]

export default function Sidebar({ activeTab, onTabChange }) {
  const sidebarRef = useRef(null)
  const buttonsRef = useRef([])

  useEffect(() => {
    // 侧边栏入场动画
    gsap.from(sidebarRef.current, {
      x: -60,
      autoAlpha: 0,
      duration: 0.5,
      ease: 'power2.out',
    })

    // 按钮交错动画
    gsap.from(buttonsRef.current, {
      x: -30,
      autoAlpha: 0,
      duration: 0.4,
      ease: 'power2.out',
      stagger: 0.1,
      delay: 0.2,
    })
  }, [])

  const handleTabClick = (tabId, index) => {
    // 点击动画
    gsap.to(buttonsRef.current[index], {
      scale: 0.9,
      duration: 0.1,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 1,
    })
    
    onTabChange(tabId)
  }

  return (
    <aside
      ref={sidebarRef}
      style={{
        width: 60,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        gap: 8,
      }}
    >
      {/* Logo */}
      <div style={{
        fontSize: 24,
        marginBottom: 16,
        padding: '8px',
      }}>
        🤖
      </div>

      {/* Tabs */}
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={el => buttonsRef.current[index] = el}
          onClick={() => handleTabClick(tab.id, index)}
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
            transition: 'background 0.2s, color 0.2s',
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
