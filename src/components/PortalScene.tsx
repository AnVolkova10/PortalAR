import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type PortalSceneProps = {
  onEnterPortal?: () => void
}

const PortalScene = ({ onEnterPortal }: PortalSceneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight || 1,
      0.1,
      100,
    )
    camera.position.set(0, 0.5, 4)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    const torusGeometry = new THREE.TorusGeometry(1.2, 0.35, 32, 64)
    const torusMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      metalness: 0.3,
      roughness: 0.4,
    })
    const torus = new THREE.Mesh(torusGeometry, torusMaterial)
    torus.position.set(0, 0, 0)
    scene.add(torus)

    const portalGeometry = new THREE.BoxGeometry(0.8, 0.4, 0.2)
    const portalMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.8,
    })
    const portalEntryObject = new THREE.Mesh(portalGeometry, portalMaterial)
    portalEntryObject.name = 'portalEntryObject'
    portalEntryObject.position.set(0, -0.2, -3)
    scene.add(portalEntryObject)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    const updatePointer = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }

    const handlePointerDown = (event: PointerEvent) => {
      updatePointer(event)
      raycaster.setFromCamera(pointer, camera)
      const intersects = raycaster.intersectObject(portalEntryObject)
      if (intersects.length > 0) {
        onEnterPortal?.()
      }
    }

    container.addEventListener('pointerdown', handlePointerDown)

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== container) {
          continue
        }
        const { width, height } = entry.contentRect
        if (!width || !height) {
          return
        }
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
      }
    })
    resizeObserver.observe(container)

    renderer.render(scene, camera)

    const animate = () => {
      torus.rotation.x += 0.01
      torus.rotation.y += 0.007
      portalEntryObject.rotation.y += 0.02

      renderer.render(scene, camera)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      container.removeEventListener('pointerdown', handlePointerDown)
      resizeObserver.disconnect()

      if (rendererRef.current) {
        container.removeChild(rendererRef.current.domElement)
        rendererRef.current.dispose()
        rendererRef.current = null
      }

      torusGeometry.dispose()
      torusMaterial.dispose()
      portalGeometry.dispose()
      portalMaterial.dispose()

      scene.clear()
    }
  }, [onEnterPortal])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
      }}
    />
  )
}

export default PortalScene
