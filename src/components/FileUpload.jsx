import { useState, useRef } from 'react'
import { gsap } from '../utils/animations'

export default function FileUpload({ onUpload }) {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)

  const handleFiles = (newFiles) => {
    const fileList = Array.from(newFiles).map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
    }))
    setFiles(prev => [...prev, ...fileList])
    onUpload(newFiles)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    gsap.to(dropZoneRef.current, {
      scale: 1.02, duration: 0.2, ease: 'power2.inOut', yoyo: true, repeat: 1,
    })
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const removeFile = (e, id) => {
    gsap.to(e.currentTarget.closest('.file-item'), {
      x: 50, opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: () => setFiles(prev => prev.filter(f => f.id !== id)),
    })
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type.includes('pdf')) return '📄'
    if (type.includes('word') || type.includes('document')) return '📝'
    if (type.includes('sheet') || type.includes('excel')) return '📊'
    return '📎'
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20, color: 'var(--text-primary)', fontSize: 20, fontWeight: 600 }}>📁 文件管理</h2>

      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className="glass-card"
        style={{
          padding: 48,
          border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--glass-border)'}`,
          borderRadius: 'var(--radius-lg)',
          background: isDragging ? 'rgba(108, 92, 231, 0.08)' : undefined,
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 24,
          transition: 'var(--transition)',
        }}
      >
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} multiple />
        <div style={{
          width: 72, height: 72, margin: '0 auto 16px', borderRadius: 20,
          background: isDragging ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'var(--glass-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          transition: 'var(--transition)',
          boxShadow: isDragging ? '0 8px 32px var(--accent-glow)' : 'none',
        }}>
          {isDragging ? '📥' : '📤'}
        </div>
        <p style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 15, fontWeight: 500 }}>
          {isDragging ? '释放以上传文件' : '点击或拖拽文件到此处'}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, opacity: 0.6 }}>支持任意文件类型</p>
      </div>

      {files.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
            已选择 {files.length} 个文件
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(file => (
              <div
                key={file.id}
                className="file-item glass-card animate-fade-in"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  cursor: 'default',
                }}
              >
                <span style={{ fontSize: 24 }}>{getFileIcon(file.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: 14 }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: 0.6 }}>{formatSize(file.size)}</div>
                </div>
                <button
                  onClick={(e) => removeFile(e, file.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, padding: '4px 8px', borderRadius: 6, transition: 'var(--transition)' }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
