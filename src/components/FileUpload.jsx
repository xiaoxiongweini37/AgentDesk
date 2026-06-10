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
    // 拖拽成功动画
    gsap.to(dropZoneRef.current, {
      scale: 1.02,
      duration: 0.2,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 1,
    })
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const removeFile = (e, id) => {
    gsap.to(e.currentTarget.closest('.file-item'), {
      x: 50,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => setFiles(prev => prev.filter(f => f.id !== id))
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

  const handleItemHover = (e) => {
    gsap.to(e.currentTarget, {
      x: 4,
      borderColor: 'var(--accent)',
      duration: 0.2,
    })
  }

  const handleItemLeave = (e) => {
    gsap.to(e.currentTarget, {
      x: 0,
      borderColor: 'var(--border)',
      duration: 0.2,
    })
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 20, color: 'var(--text-primary)' }}>📁 文件管理</h2>

      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 1.01, duration: 0.2 })}
        onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.2 })}
        style={{
          padding: 40,
          border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          background: isDragging ? 'rgba(0, 212, 255, 0.1)' : 'var(--bg-card)',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 20,
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
          multiple
        />
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {isDragging ? '📥' : '📤'}
        </div>
        <p style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
          {isDragging ? '释放以上传文件' : '点击或拖拽文件到此处'}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          支持任意文件类型
        </p>
      </div>

      {files.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            已选择 {files.length} 个文件
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map(file => (
              <div
                key={file.id}
                className="file-item"
                onMouseEnter={handleItemHover}
                onMouseLeave={handleItemLeave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 24 }}>{getFileIcon(file.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)' }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatSize(file.size)}
                  </div>
                </div>
                <button
                  onClick={(e) => removeFile(e, file.id)}
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
      )}
    </div>
  )
}
