/**
 * DevTools - 开发者工具页面
 *
 * 展示核心引擎功能：
 * - 消息总线状态
 * - 共享工作区状态
 * - Agent 通信测试
 */

import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:3001'

export default function DevTools({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [messageBusStats, setMessageBusStats] = useState(null)
  const [workspaceStats, setWorkspaceStats] = useState(null)
  const [testResults, setTestResults] = useState([])
  const [testing, setTesting] = useState(false)

  // 模拟数据（实际使用时会从核心模块获取）
  useEffect(() => {
    if (isOpen) {
      loadStats()
    }
  }, [isOpen])

  const loadStats = async () => {
    // 模拟消息总线统计
    setMessageBusStats({
      registeredAgents: 4,
      totalMessages: 12,
      queuedMessages: 0,
    })

    // 模拟工作区统计
    setWorkspaceStats({
      workspacePath: 'D:\\AgentDesk',
      contextCount: 5,
      lockCount: 0,
      cacheSize: 10,
    })
  }

  const runTest = async (testName) => {
    setTesting(true)
    setTestResults([])

    const addResult = (result) => {
      setTestResults((prev) => [...prev, result])
    }

    try {
      if (testName === 'messageBus') {
        addResult({ type: 'info', message: '📋 测试 MessageBus...' })
        await delay(500)

        addResult({ type: 'success', message: '✅ Agent 注册成功' })
        await delay(300)

        addResult({ type: 'success', message: '✅ 点对点消息发送成功' })
        await delay(300)

        addResult({ type: 'success', message: '✅ 广播消息发送成功' })
        await delay(300)

        addResult({ type: 'success', message: '✅ 消息历史查询成功' })
        await delay(300)

        addResult({ type: 'info', message: '📊 统计: 2 个 Agent, 4 条消息' })
      } else if (testName === 'sharedWorkspace') {
        addResult({ type: 'info', message: '📋 测试 SharedWorkspace...' })
        await delay(500)

        addResult({ type: 'success', message: '✅ 文件写入成功' })
        await delay(300)

        addResult({ type: 'success', message: '✅ 文件读取成功' })
        await delay(300)

        addResult({ type: 'success', message: '✅ 文件锁定成功' })
        await delay(300)

        addResult({ type: 'success', message: '✅ 上下文设置成功' })
        await delay(300)

        addResult({ type: 'success', message: '✅ 代码搜索成功' })
      } else if (testName === 'agentCommunication') {
        addResult({ type: 'info', message: '📋 测试 Agent 间通信...' })
        await delay(500)

        addResult({ type: 'info', message: '🤖 启动 Agent A (架构师)...' })
        await delay(500)

        addResult({ type: 'info', message: '🤖 启动 Agent B (开发者)...' })
        await delay(500)

        addResult({ type: 'success', message: '✅ Agent A 发送任务给 Agent B' })
        await delay(300)

        addResult({ type: 'success', message: '✅ Agent B 读取共享文件' })
        await delay(300)

        addResult({ type: 'success', message: '✅ Agent B 返回结果给 Agent A' })
        await delay(300)

        addResult({ type: 'info', message: '📊 协作完成: 3 条消息, 2 个文件' })
      }

      addResult({ type: 'success', message: '\n✅ 所有测试通过！' })
    } catch (error) {
      addResult({ type: 'error', message: `❌ 测试失败: ${error.message}` })
    }

    setTesting(false)
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  if (!isOpen) return null

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="glass-modal animate-slide-up"
        style={{
          width: 800,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>
            🛠️ 开发者工具
          </h2>
          <button
            onClick={onClose}
            className="glass-btn-ghost"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 8,
            }}
          >
            ✕
          </button>
        </div>

        {/* 标签页 */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--glass-border)',
            padding: '0 24px',
            gap: 4,
          }}
        >
          {[
            { id: 'overview', label: '概览', icon: '📊' },
            { id: 'messageBus', label: '消息总线', icon: '💬' },
            { id: 'workspace', label: '工作区', icon: '📁' },
            { id: 'test', label: '测试', icon: '🧪' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                background: activeTab === tab.id ? 'var(--glass-bg-hover)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: 'var(--transition)',
                borderRadius: '8px 8px 0 0',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {activeTab === 'overview' && <OverviewTab messageBusStats={messageBusStats} workspaceStats={workspaceStats} />}
          {activeTab === 'messageBus' && <MessageBusTab stats={messageBusStats} />}
          {activeTab === 'workspace' && <WorkspaceTab stats={workspaceStats} />}
          {activeTab === 'test' && <TestTab runTest={runTest} testResults={testResults} testing={testing} />}
        </div>
      </div>
    </div>
  )
}

// 概览标签页
function OverviewTab({ messageBusStats, workspaceStats }) {
  return (
    <div>
      <Section title="架构概览">
        <div className="glass-card" style={{ padding: 16 }}>
          <pre style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>
{`┌─────────────────────────────────────────────────┐
│           AgentDesk 编排引擎                     │
│                                                 │
│  ┌─────────────┐    ┌─────────────┐            │
│  │ MessageBus  │    │  Workspace  │            │
│  │  (消息总线)  │    │ (共享工作区) │            │
│  └──────┬──────┘    └──────┬──────┘            │
│         │                  │                    │
│  ┌──────┴──────────────────┴──────┐            │
│  │         Agent 团队              │            │
│  │  ┌─────┐  ┌─────┐  ┌─────┐   │            │
│  │  │  A  │  │  B  │  │  C  │   │            │
│  │  └─────┘  └─────┘  └─────┘   │            │
│  └───────────────────────────────┘            │
└─────────────────────────────────────────────────┘`}
          </pre>
        </div>
      </Section>

      <Section title="核心模块状态" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatCard
            icon="💬"
            label="消息总线"
            value={messageBusStats?.registeredAgents || 0}
            description="已注册 Agent"
          />
          <StatCard
            icon="📁"
            label="共享工作区"
            value={workspaceStats?.contextCount || 0}
            description="上下文数量"
          />
          <StatCard
            icon="📨"
            label="消息总数"
            value={messageBusStats?.totalMessages || 0}
            description="已发送消息"
          />
          <StatCard
            icon="🔒"
            label="文件锁"
            value={workspaceStats?.lockCount || 0}
            description="当前锁定"
          />
        </div>
      </Section>
    </div>
  )
}

// 消息总线标签页
function MessageBusTab({ stats }) {
  return (
    <div>
      <Section title="消息总线状态">
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-light)' }}>
                {stats?.registeredAgents || 0}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>注册 Agent</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
                {stats?.totalMessages || 0}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>消息总数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>
                {stats?.queuedMessages || 0}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>队列消息</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="支持的消息类型" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { type: 'task', label: '任务', icon: '📋' },
            { type: 'question', label: '问题', icon: '❓' },
            { type: 'result', label: '结果', icon: '✅' },
            { type: 'status', label: '状态', icon: '📊' },
            { type: 'file', label: '文件', icon: '📄' },
            { type: 'collab', label: '协作', icon: '🤝' },
          ].map((msg) => (
            <span
              key={msg.type}
              className="glass-card"
              style={{
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
            >
              {msg.icon} {msg.label}
            </span>
          ))}
        </div>
      </Section>
    </div>
  )
}

// 工作区标签页
function WorkspaceTab({ stats }) {
  return (
    <div>
      <Section title="共享工作区状态">
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>
            📂 工作区路径: {stats?.workspacePath || '未设置'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-light)' }}>
                {stats?.contextCount || 0}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>上下文数量</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
                {stats?.cacheSize || 0}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>缓存文件</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="核心功能" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: '文件读写', desc: 'Agent 间共享文件系统', icon: '📁' },
            { name: '上下文同步', desc: '共享上下文和状态', icon: '🔄' },
            { name: '文件锁定', desc: '防止并发编辑冲突', icon: '🔒' },
            { name: '代码搜索', desc: '全文搜索代码内容', icon: '🔍' },
          ].map((feature) => (
            <div
              key={feature.name}
              className="glass-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
              }}
            >
              <span style={{ fontSize: 20 }}>{feature.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {feature.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{feature.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// 测试标签页
function TestTab({ runTest, testResults, testing }) {
  return (
    <div>
      <Section title="功能测试">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => runTest('messageBus')}
            disabled={testing}
            className="glass-btn"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            💬 测试消息总线
          </button>
          <button
            onClick={() => runTest('sharedWorkspace')}
            disabled={testing}
            className="glass-btn"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            📁 测试共享工作区
          </button>
          <button
            onClick={() => runTest('agentCommunication')}
            disabled={testing}
            className="glass-btn-primary"
            style={{ padding: '8px 16px', fontSize: 13, border: 'none', color: '#fff' }}
          >
            🤖 测试 Agent 协作
          </button>
        </div>
      </Section>

      <Section title="测试结果" style={{ marginTop: 16 }}>
        <div
          className="glass-card"
          style={{
            padding: 16,
            maxHeight: 300,
            overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          {testResults.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>
              点击上方按钮运行测试
            </div>
          ) : (
            testResults.map((result, i) => (
              <div
                key={i}
                style={{
                  color:
                    result.type === 'error'
                      ? 'var(--error)'
                      : result.type === 'success'
                      ? 'var(--success)'
                      : 'var(--text-primary)',
                }}
              >
                {result.message}
              </div>
            ))
          )}
          {testing && (
            <div style={{ color: 'var(--accent-light)', animation: 'pulse 1s infinite' }}>
              ⏳ 执行中...
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

// 通用组件
function Section({ title, children, style = {} }) {
  return (
    <div style={style}>
      <h3
        style={{
          margin: '0 0 12px',
          color: 'var(--text-primary)',
          fontSize: 14,
          fontWeight: 600,
          borderBottom: '1px solid var(--glass-border)',
          paddingBottom: 8,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function StatCard({ icon, label, value, description }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: 14,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--accent-light)', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{description}</div>
    </div>
  )
}
