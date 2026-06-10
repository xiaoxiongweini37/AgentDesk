import { useState, useRef, useEffect } from 'react'
import { gsap } from '../utils/animations'

export default function FileUpload({ onUpload }) {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)
  const dropZoneRef = useRef(null)
  const fileListRef = useRef(null)

  // 入场动画
  useEffect(() => {
    if (containerRef.current) {
      gsap.from(containerRef.current, {
        y: 20,
        autoAlpha: 0,
        duration: 0.5,
        ease: 'power2.out',
      })
    }
  }, [])

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
    
    // 新文件入场动画
    setTimeout(() => {
      if (fileListRef.current) {
        const items = fileListRef.current.querySelectorAll('.file-item')
        gsap.from(items, {
          x: -30,
          autoAlpha: 0,
          duration: 0.4,
          ease: 'power2.out',
          stagger: 0.1,
        })
      }
    }, 10)
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

  const removeFile = (id) => {
    // 删除动画
    const item = fileListRef.current?.querySelector(`[data-id="${id}"]`)
    if (item) {
      gsap.to(item, {
        x: 50,
        autoAlpha: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          setFiles(prev => prev.filter(f => f.id !== id))
        },
      })
    }
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
    <div 
      ref={containerRef}
      style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}
    >
      <h2 style={{ marginBottom: 20, color: 'var(--text-primary)' }}>📁 文件管理</h2>

      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: 40,
          border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          background: isDragging ? 'rgba(0, 212, 255, 0.1)' : 'var(--bg-card)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
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

      {/* File list */}
      {files.length > 0 && (
        <div ref={fileListRef}>
          <h3 style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            已选择 {files.length} 个文件
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map(file => (
              <div
                key={file.id}
                data-id={file.id}
                className="file-item"
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
                <span style={{ fontSize: 24 }}>{getFileIcon(file.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)' }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatSize(file.size)}
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
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
