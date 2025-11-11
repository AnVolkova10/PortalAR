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

    const createRectFrameGeometry = (
      outerWidth: number,
      outerHeight: number,
      innerWidth: number,
      innerHeight: number,
    ) => {
      const shape = new THREE.Shape()
      const halfOuterWidth = outerWidth / 2
      const halfOuterHeight = outerHeight / 2
      shape.moveTo(-halfOuterWidth, -halfOuterHeight)
      shape.lineTo(halfOuterWidth, -halfOuterHeight)
      shape.lineTo(halfOuterWidth, halfOuterHeight)
      shape.lineTo(-halfOuterWidth, halfOuterHeight)
      shape.lineTo(-halfOuterWidth, -halfOuterHeight)

      const halfInnerWidth = innerWidth / 2
      const halfInnerHeight = innerHeight / 2
      const hole = new THREE.Path()
      hole.moveTo(-halfInnerWidth, -halfInnerHeight)
      hole.lineTo(-halfInnerWidth, halfInnerHeight)
      hole.lineTo(halfInnerWidth, halfInnerHeight)
      hole.lineTo(halfInnerWidth, -halfInnerHeight)
      hole.lineTo(-halfInnerWidth, -halfInnerHeight)
      shape.holes.push(hole)

      return new THREE.ShapeGeometry(shape)
    }

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

    const portalRenderTarget = new THREE.WebGLRenderTarget(1024, 1024)
    portalRenderTarget.texture.colorSpace = THREE.SRGBColorSpace

    const portalWorldScene = new THREE.Scene()
    portalWorldScene.background = new THREE.Color(0x050c1a)

    const portalWorldCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 50)
    portalWorldCamera.position.set(1.4, 1.1, 3)
    portalWorldCamera.lookAt(0, 0.4, 0)

    const portalWorldAmbient = new THREE.HemisphereLight(0xbfeafc, 0x06111f, 0.85)
    portalWorldScene.add(portalWorldAmbient)

    const portalWorldLight = new THREE.DirectionalLight(0xbde0fe, 1.1)
    portalWorldLight.position.set(1.3, 1.8, 2.3)
    portalWorldScene.add(portalWorldLight)

    const centerpieceGeometry = new THREE.SphereGeometry(0.55, 32, 32)
    const centerpieceMaterial = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.3,
      roughness: 0.5,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.2,
    })
    const centerpiece = new THREE.Mesh(centerpieceGeometry, centerpieceMaterial)
    centerpiece.position.set(0, 0.55, 0)
    portalWorldScene.add(centerpiece)

    const groundGeometry = new THREE.CircleGeometry(3.5, 64)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c1a2c,
      roughness: 0.95,
      metalness: 0,
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    portalWorldScene.add(ground)

    const mistGeometry = new THREE.PlaneGeometry(4.5, 4.5)
    const mistMaterial = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    })
    const mist = new THREE.Mesh(mistGeometry, mistMaterial)
    mist.rotation.x = -Math.PI / 2
    mist.position.y = -0.015
    portalWorldScene.add(mist)

    const nebulaGeometry = new THREE.SphereGeometry(4, 48, 48)
    const nebulaMaterial = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.08,
      metalness: 0,
      roughness: 1,
      side: THREE.BackSide,
    })
    const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial)
    portalWorldScene.add(nebula)

    const firefliesGeometry = new THREE.BufferGeometry()
    const fireflyCount = 120
    const fireflyPositions = new Float32Array(fireflyCount * 3)
    for (let i = 0; i < fireflyCount; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = 0.5 + Math.random() * 1.2
      const height = 0.1 + Math.random() * 0.9
      fireflyPositions[i * 3] = Math.cos(angle) * radius
      fireflyPositions[i * 3 + 1] = height
      fireflyPositions[i * 3 + 2] = Math.sin(angle) * radius
    }
    firefliesGeometry.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3))
    const firefliesMaterial = new THREE.PointsMaterial({
      color: 0xbfdbfe,
      size: 0.02,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const fireflies = new THREE.Points(firefliesGeometry, firefliesMaterial)
    portalWorldScene.add(fireflies)

    const orbGeometry = new THREE.SphereGeometry(0.12, 16, 16)
    const orbMaterials: THREE.MeshStandardMaterial[] = []
    const orbGroup = new THREE.Group()
    for (let i = 0; i < 3; i += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.56 + i * 0.02, 0.5, 0.75),
        emissive: 0x38bdf8,
        emissiveIntensity: 0.25,
        metalness: 0.2,
        roughness: 0.4,
      })
      const orb = new THREE.Mesh(orbGeometry, material)
      orb.position.set(0, 0.3 + i * 0.12, 0)
      orb.userData.radius = 0.7 + i * 0.25
      orb.userData.speed = 0.18 + i * 0.05
      orb.userData.height = 0.25 + i * 0.08
      orbGroup.add(orb)
      orbMaterials.push(material)
    }
    portalWorldScene.add(orbGroup)

    const portalWidth = 1.7
    const portalHeight = 2.4

    const portalSurfaceGeometry = new THREE.PlaneGeometry(portalWidth, portalHeight)
    const portalSurfaceMaterial = new THREE.MeshStandardMaterial({
      map: portalRenderTarget.texture,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.25,
      emissive: 0x2563eb,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    })
    const portalSurface = new THREE.Mesh(portalSurfaceGeometry, portalSurfaceMaterial)
    portalSurface.name = 'portalEntryObject'
    portalSurface.position.set(0, 0.35, -3)
    scene.add(portalSurface)

    const frameThickness = 0.18
    const portalFrameGeometry = createRectFrameGeometry(
      portalWidth + frameThickness * 2,
      portalHeight + frameThickness * 2,
      portalWidth,
      portalHeight,
    )
    const portalFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.9,
      side: THREE.DoubleSide,
    })
    const portalFrame = new THREE.Mesh(portalFrameGeometry, portalFrameMaterial)
    portalFrame.position.copy(portalSurface.position)
    portalFrame.rotation.y = Math.PI
    scene.add(portalFrame)

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
      const intersects = raycaster.intersectObject(portalSurface)
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

    const clock = new THREE.Clock()

    const animate = () => {
      const elapsed = clock.getElapsedTime()

      centerpiece.rotation.y += 0.004
      centerpiece.position.y = 0.55 + Math.sin(elapsed * 0.5) * 0.04

      mist.rotation.z = Math.sin(elapsed * 0.2) * 0.02
      mistMaterial.opacity = 0.1 + Math.sin(elapsed * 0.6) * 0.02

      nebula.rotation.y += 0.0006
      fireflies.rotation.y += 0.0008

      orbGroup.children.forEach((child, index) => {
        if (!(child instanceof THREE.Mesh)) {
          return
        }
        const radius = (child.userData.radius as number) ?? 0.7 + index * 0.2
        const speed = (child.userData.speed as number) ?? 0.18
        const height = (child.userData.height as number) ?? 0.3
        child.position.x = Math.cos(elapsed * speed + index * 0.6) * radius
        child.position.z = Math.sin(elapsed * speed + index * 0.6) * radius
        child.position.y = 0.2 + height
      })

      portalWorldLight.intensity = 1.05 + Math.sin(elapsed * 0.4) * 0.08

      portalWorldCamera.position.x = 1.2 * Math.sin(elapsed * 0.25)
      portalWorldCamera.position.z = 2.8 + Math.cos(elapsed * 0.25)
      portalWorldCamera.lookAt(0, 0.4, 0)

      renderer.setRenderTarget(portalRenderTarget)
      renderer.render(portalWorldScene, portalWorldCamera)
      renderer.setRenderTarget(null)

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

      portalRenderTarget.dispose()
      centerpieceGeometry.dispose()
      centerpieceMaterial.dispose()
      groundGeometry.dispose()
      groundMaterial.dispose()
      mistGeometry.dispose()
      mistMaterial.dispose()
      nebulaGeometry.dispose()
      nebulaMaterial.dispose()
      firefliesGeometry.dispose()
      firefliesMaterial.dispose()
      orbGeometry.dispose()
      orbMaterials.forEach((material) => material.dispose())
      portalSurfaceGeometry.dispose()
      portalSurfaceMaterial.dispose()
      portalFrameGeometry.dispose()
      portalFrameMaterial.dispose()

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
