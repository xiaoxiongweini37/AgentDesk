import { gsap } from 'gsap'

// 设置全局默认值
gsap.defaults({
  duration: 0.4,
  ease: 'power2.out',
})

// 动画工具函数
export const animations = {
  // 淡入
  fadeIn: (element, options = {}) => {
    return gsap.from(element, {
      autoAlpha: 0,
      y: 20,
      duration: 0.5,
      ease: 'power2.out',
      ...options,
    })
  },

  // 淡出
  fadeOut: (element, options = {}) => {
    return gsap.to(element, {
      autoAlpha: 0,
      y: -20,
      duration: 0.3,
      ease: 'power2.in',
      ...options,
    })
  },

  // 从左侧滑入
  slideInLeft: (element, options = {}) => {
    return gsap.from(element, {
      x: -100,
      autoAlpha: 0,
      duration: 0.5,
      ease: 'power2.out',
      ...options,
    })
  },

  // 从右侧滑入
  slideInRight: (element, options = {}) => {
    return gsap.from(element, {
      x: 100,
      autoAlpha: 0,
      duration: 0.5,
      ease: 'power2.out',
      ...options,
    })
  },

  // 从下方滑入
  slideInUp: (element, options = {}) => {
    return gsap.from(element, {
      y: 50,
      autoAlpha: 0,
      duration: 0.5,
      ease: 'power2.out',
      ...options,
    })
  },

  // 缩放进入
  scaleIn: (element, options = {}) => {
    return gsap.from(element, {
      scale: 0.8,
      autoAlpha: 0,
      duration: 0.4,
      ease: 'back.out(1.7)',
      ...options,
    })
  },

  // 弹跳效果
  bounce: (element, options = {}) => {
    return gsap.from(element, {
      y: -20,
      autoAlpha: 0,
      duration: 0.6,
      ease: 'bounce.out',
      ...options,
    })
  },

  // 交错动画（多个元素）
  stagger: (elements, options = {}) => {
    return gsap.from(elements, {
      y: 30,
      autoAlpha: 0,
      duration: 0.5,
      ease: 'power2.out',
      stagger: 0.1,
      ...options,
    })
  },

  // 脉冲效果
  pulse: (element, options = {}) => {
    return gsap.to(element, {
      scale: 1.05,
      duration: 0.3,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 1,
      ...options,
    })
  },

  // 闪烁效果
  flash: (element, options = {}) => {
    return gsap.to(element, {
      autoAlpha: 0.5,
      duration: 0.15,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 3,
      ...options,
    })
  },

  // 摇晃效果
  shake: (element, options = {}) => {
    return gsap.to(element, {
      x: '+=10',
      duration: 0.08,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 5,
      ...options,
    })
  },

  // 旋转进入
  rotateIn: (element, options = {}) => {
    return gsap.from(element, {
      rotation: -180,
      autoAlpha: 0,
      duration: 0.6,
      ease: 'back.out(1.7)',
      ...options,
    })
  },

  // 打字机效果
  typewriter: (element, text, options = {}) => {
    const chars = text.split('')
    element.textContent = ''
    
    return gsap.to(element, {
      duration: chars.length * 0.05,
      ease: 'none',
      onUpdate: function() {
        const progress = this.progress()
        const index = Math.floor(progress * chars.length)
        element.textContent = chars.slice(0, index).join('')
      },
      ...options,
    })
  },

  // 进度条动画
  progressBar: (element, targetPercent, options = {}) => {
    return gsap.to(element, {
      width: `${targetPercent}%`,
      duration: 0.8,
      ease: 'power2.out',
      ...options,
    })
  },

  // 卡片翻转
  cardFlip: (element, options = {}) => {
    return gsap.to(element, {
      rotationY: 180,
      duration: 0.6,
      ease: 'power2.inOut',
      ...options,
    })
  },

  // 手风琴展开
  accordionOpen: (element, options = {}) => {
    return gsap.from(element, {
      height: 0,
      autoAlpha: 0,
      duration: 0.4,
      ease: 'power2.out',
      ...options,
    })
  },

  // 手风琴关闭
  accordionClose: (element, options = {}) => {
    return gsap.to(element, {
      height: 0,
      autoAlpha: 0,
      duration: 0.3,
      ease: 'power2.in',
      ...options,
    })
  },
}

// React Hook: useGSAP
export const useGSAP = (callback, deps = []) => {
  const ref = React.useRef(null)
  
  React.useEffect(() => {
    if (ref.current) {
      const ctx = gsap.context(() => {
        callback(ref.current)
      }, ref)
      
      return () => ctx.revert()
    }
  }, deps)
  
  return ref
}

// 创建时间轴
export const createTimeline = (options = {}) => {
  return gsap.timeline({
    defaults: {
      duration: 0.4,
      ease: 'power2.out',
    },
    ...options,
  })
}

// 导出 gsap 实例
export { gsap }
