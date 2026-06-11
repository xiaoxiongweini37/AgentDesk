import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

export default function FileBrowser({ isOpen, onClose, onSelect, mode = 'both' }) {
  // mode: 'file', 'directory', 'both'
  const [currentPath, setCurrentPath] = useState('/mnt/d')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

  // 读取目录内容
  useEffect(() => {
    if (!isOpen) return
    
    const fetchDir = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/api/files/browse?path=${encodeURIComponent(currentPath)}`)
        if (res.ok) {
          const data = await res.json()
          setItems(data.items || [])
        } else {
          setError('无法读取目录')
        }
      } catch (err) {
        setError('请求失败')
      }
      setLoading(false)
    }
    
    fetchDir()
  }, [isOpen, currentPath])

  // 导航到目录
  const navigateTo = (path) => {
    setCurrentPath(path)
    setSelectedItem(null)
  }

  // 上一级
  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    navigateTo(parent)
  }

  // 选择项目
  const handleSelect = (item) => {
    if (item.type === 'directory') {
      if (mode === 'file') {
        // 文件模式下，点击文件夹进入
        navigateTo(item.path)
      } else {
        setSelectedItem(item)
      }
    } else {
      if (mode === 'directory') {
        // 目录模式下，点击文件无反应
        return
      }
      setSelectedItem(item)
    }
  }

  // 确认选择
  const handleConfirm = () => {
    if (selectedItem) {
      onSelect(selectedItem.path)
      onClose()
    }
  }

  // 双击进入文件夹
  const handleDoubleClick = (item) => {
    if (item.type === 'directory') {
      navigateTo(item.path)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        width: 600,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
            {mode === 'file' ? '📄 选择文件' : mode === 'directory' ? '📁 选择文件夹' : '📁 选择文件/文件夹'}
          </h3>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 18,
            cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* 路径栏 */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <button onClick={goUp} style={{
            padding: '6px 10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
          }}>
            ⬆ 上级
          </button>
          <div style={{
            flex: 1,
            padding: '6px 12px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {currentPath}
          </div>
        </div>

        {/* 文件列表 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          minHeight: 300,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              加载中...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#f44336' }}>
              {error}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              空目录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map((item, i) => {
                const isSelected = selectedItem?.path === item.path
                const isClickable = (mode === 'both') || 
                                   (mode === 'file' && item.type === 'file') ||
                                   (mode === 'directory' && item.type === 'directory')
                
                return (
                  <div
                    key={i}
                    onClick={() => isClickable && handleSelect(item)}
                    onDoubleClick={() => handleDoubleClick(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      borderRadius: 'var(--radius)',
                      cursor: isClickable ? 'pointer' : 'default',
                      opacity: isClickable ? 1 : 0.5,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (isClickable && !isSelected) {
                        e.currentTarget.style.background = 'var(--bg-secondary)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>
                      {item.type === 'directory' ? '📁' : '📄'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {item.name}
                      </div>
                      {item.type === 'file' && (
                        <div style={{
                          fontSize: 11,
                          color: isSelected ? 'rgba(0,0,0,0.6)' : 'var(--text-secondary)',
                        }}>
                          {formatSize(item.size)}
                        </div>
                      )}
                    </div>
                    {item.type === 'directory' && (
                      <span style={{ 
                        fontSize: 12, 
                        color: isSelected ? 'rgba(0,0,0,0.6)' : 'var(--text-secondary)',
                      }}>
                        →
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}>
            取消
          </button>
          {mode !== 'file' && (
            <button onClick={() => {
              onSelect(currentPath)
              onClose()
            }} style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}>
              选择当前目录
            </button>
          )}
          <button 
            onClick={handleConfirm}
            disabled={!selectedItem}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: selectedItem ? 'var(--accent)' : 'var(--border)',
              color: selectedItem ? 'var(--bg-primary)' : 'var(--text-secondary)',
              cursor: selectedItem ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
            }}
          >
            选择
          </button>
        </div>
      </div>
    </div>
  )
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
