import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3001'

export default function FileBrowser({ isOpen, onClose, onSelect, mode = 'both' }) {
  const [currentPath, setCurrentPath] = useState('/mnt/d')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

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
      } catch { setError('请求失败') }
      setLoading(false)
    }
    fetchDir()
  }, [isOpen, currentPath])

  const navigateTo = (path) => { setCurrentPath(path); setSelectedItem(null) }
  const goUp = () => { const parent = currentPath.split('/').slice(0, -1).join('/') || '/'; navigateTo(parent) }

  const handleSelect = (item) => {
    if (item.type === 'directory') {
      if (mode === 'file') navigateTo(item.path)
      else setSelectedItem(item)
    } else {
      if (mode === 'directory') return
      setSelectedItem(item)
    }
  }

  const handleConfirm = () => { if (selectedItem) { onSelect(selectedItem.path); onClose() } }
  const handleDoubleClick = (item) => { if (item.type === 'directory') navigateTo(item.path) }

  if (!isOpen) return null

  return (
    <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={onClose}>
      <div className="glass-modal animate-slide-up" style={{ width: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>
            {mode === 'file' ? '📄 选择文件' : mode === 'directory' ? '📁 选择文件夹' : '📁 选择文件/文件夹'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        {/* 路径栏 */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={goUp} className="glass-btn" style={{ padding: '5px 10px', fontSize: 12 }}>⬆ 上级</button>
          <div className="glass-card" style={{
            flex: 1, padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentPath}
          </div>
        </div>

        {/* 文件列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, minHeight: 300 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>加载中...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--error)', fontSize: 13 }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13, opacity: 0.5 }}>空目录</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map((item, i) => {
                const isSelected = selectedItem?.path === item.path
                const isClickable = (mode === 'both') || (mode === 'file' && item.type === 'file') || (mode === 'directory' && item.type === 'directory')
                return (
                  <div
                    key={i}
                    onClick={() => isClickable && handleSelect(item)}
                    onDoubleClick={() => handleDoubleClick(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px',
                      background: isSelected ? 'var(--accent-glow)' : 'transparent',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      cursor: isClickable ? 'pointer' : 'default',
                      opacity: isClickable ? 1 : 0.4,
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={e => { if (isClickable && !isSelected) e.currentTarget.style.background = 'var(--glass-bg)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{item.type === 'directory' ? '📁' : '📄'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        color: isSelected ? 'var(--accent-light)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{item.name}</div>
                      {item.type === 'file' && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5 }}>{formatSize(item.size)}</div>
                      )}
                    </div>
                    {item.type === 'directory' && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: 0.4 }}>→</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="glass-btn" style={{ padding: '8px 16px', fontSize: 13 }}>取消</button>
          {mode !== 'file' && (
            <button onClick={() => { onSelect(currentPath); onClose() }} className="glass-btn" style={{ padding: '8px 16px', fontSize: 13 }}>选择当前目录</button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedItem}
            className={selectedItem ? 'glass-btn-primary' : 'glass-btn'}
            style={{
              padding: '8px 16px', border: 'none', fontSize: 13, fontWeight: 600,
              cursor: selectedItem ? 'pointer' : 'not-allowed',
              color: selectedItem ? '#fff' : 'var(--text-secondary)',
              opacity: selectedItem ? 1 : 0.5,
            }}
          >选择</button>
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
