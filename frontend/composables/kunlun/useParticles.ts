/**
 * useParticles — 粒子系统组合式函数
 *
 * 基于 Three.js 的星空粒子场
 * 用于首页 Hero / Wenquxing 场景背景
 *
 * 用法:
 *   const { containerRef, animate } = useParticles({ count: 200 })
 *   <div ref="containerRef" />
 */

import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import { motion } from '~/utils/kunlun/motion'

export interface ParticleOptions {
  count?: number
  speed?: number
  sizeMin?: number
  sizeMax?: number
  opacityMin?: number
  opacityMax?: number
  connectionDistance?: number
  connectionOpacity?: number
  color?: string
  autoAnimate?: boolean
}

export function useParticles(containerOrOptions: HTMLElement | ParticleOptions = {}, options?: ParticleOptions) {
  let rawOpts: ParticleOptions
  if (containerOrOptions instanceof HTMLElement) {
    rawOpts = options ?? {}
  } else {
    rawOpts = containerOrOptions
  }
  const opts = {
    count: rawOpts.count ?? motion.particles.count,
    speed: rawOpts.speed ?? motion.particles.speed,
    sizeMin: rawOpts.sizeMin ?? motion.particles.size.min,
    sizeMax: rawOpts.sizeMax ?? motion.particles.size.max,
    opacityMin: rawOpts.opacityMin ?? motion.particles.opacity.min,
    opacityMax: rawOpts.opacityMax ?? motion.particles.opacity.max,
    connectionDistance: rawOpts.connectionDistance ?? motion.particles.connection.distance,
    connectionOpacity: rawOpts.connectionOpacity ?? motion.particles.connection.opacity,
    color: rawOpts.color ?? '#C9A86C',
    autoAnimate: rawOpts.autoAnimate ?? true,
  }

  const containerRef: Ref<HTMLDivElement | null> = ref(null)
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let particles: THREE.Points | null = null
  let connections: THREE.LineSegments | null = null
  let animationId: number | null = null
  let positions: Float32Array | null = null
  let velocities: Float32Array | null = null

  function init() {
    if (!containerRef.value) return

    const container = containerRef.value
    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 300

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // 粒子几何
    const geometry = new THREE.BufferGeometry()
    const total = opts.count
    positions = new Float32Array(total * 3)
    velocities = new Float32Array(total * 3)
    const sizes = new Float32Array(total)
    const opacities = new Float32Array(total)

    for (let i = 0; i < total; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 600
      positions[i * 3 + 1] = (Math.random() - 0.5) * 600
      positions[i * 3 + 2] = (Math.random() - 0.5) * 600
      velocities[i * 3] = (Math.random() - 0.5) * opts.speed
      velocities[i * 3 + 1] = (Math.random() - 0.5) * opts.speed
      velocities[i * 3 + 2] = (Math.random() - 0.5) * opts.speed * 0.5
      sizes[i] = opts.sizeMin + Math.random() * (opts.sizeMax - opts.sizeMin)
      opacities[i] = opts.opacityMin + Math.random() * (opts.opacityMax - opts.opacityMin)
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1))

    // 材质 — 圆形粒子
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    const texture = new THREE.CanvasTexture(canvas)

    const material = new THREE.PointsMaterial({
      color: opts.color,
      size: 2.5,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
    })

    particles = new THREE.Points(geometry, material)
    scene.add(particles)

    // 连线
    const connectionGeometry = new THREE.BufferGeometry()
    const connectionPositions = new Float32Array(total * total * 6) // max possible
    connectionGeometry.setAttribute('position', new THREE.BufferAttribute(connectionPositions, 3))
    const connectionMaterial = new THREE.LineBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: opts.connectionOpacity,
    })
    connections = new THREE.LineSegments(connectionGeometry, connectionMaterial)
    scene.add(connections)

    // 鼠标驱动
    let mouseX = 0
    let mouseY = 0
    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / width) * 2 - 1
      mouseY = -(e.clientY / height) * 2 + 1
    }
    window.addEventListener('mousemove', onMouse)

    function animate() {
      if (!particles || !positions || !connections) return

      const pos = particles.geometry.attributes.position.array as Float32Array
      const connPos = connections.geometry.attributes.position.array as Float32Array

      for (let i = 0; i < total; i++) {
        pos[i * 3] += velocities![i * 3]
        pos[i * 3 + 1] += velocities![i * 3 + 1]
        pos[i * 3 + 2] += velocities![i * 3 + 2]

        // 边界环绕
        if (Math.abs(pos[i * 3]) > 300) velocities![i * 3] *= -1
        if (Math.abs(pos[i * 3 + 1]) > 300) velocities![i * 3 + 1] *= -1
        if (Math.abs(pos[i * 3 + 2]) > 300) velocities![i * 3 + 2] *= -1
      }

      particles.geometry.attributes.position.needsUpdate = true

      // 连线计算（局部优化：只连距离最近的）
      let connIdx = 0
      const maxConn = 2000
      for (let i = 0; i < total && connIdx < maxConn; i++) {
        for (let j = i + 1; j < total && connIdx < maxConn; j++) {
          const dx = pos[i * 3] - pos[j * 3]
          const dy = pos[i * 3 + 1] - pos[j * 3 + 1]
          const dz = pos[i * 3 + 2] - pos[j * 3 + 2]
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist < opts.connectionDistance) {
            connPos[connIdx * 3] = pos[i * 3]
            connPos[connIdx * 3 + 1] = pos[i * 3 + 1]
            connPos[connIdx * 3 + 2] = pos[i * 3 + 2]
            connPos[connIdx * 3 + 3] = pos[j * 3]
            connPos[connIdx * 3 + 4] = pos[j * 3 + 1]
            connPos[connIdx * 3 + 5] = pos[j * 3 + 2]
            connIdx += 2
          }
        }
      }

      connections.geometry.setDrawRange(0, connIdx)
      connections.geometry.attributes.position.needsUpdate = true

      // 镜头微移跟随鼠标
      if (camera) {
        camera.position.x += (mouseX * 30 - camera.position.x) * 0.02
        camera.position.y += (mouseY * 20 - camera.position.y) * 0.02
        camera.lookAt(0, 0, 0)
      }

      renderer?.render(scene!, camera!)
      animationId = requestAnimationFrame(animate)
    }

    animate()
  }

  function cleanup() {
    if (animationId) cancelAnimationFrame(animationId)
    renderer?.dispose()
    scene?.clear()
    if (containerRef.value && renderer) {
      containerRef.value.removeChild(renderer.domElement)
    }
  }

  return {
    containerRef,
    init,
    cleanup,
  }
}
