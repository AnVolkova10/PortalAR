import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type TrackingMode = 'ar' | 'fallback'

type PortalSceneProps = {
  onEnterPortal?: () => void
  onTrackingModeChange?: (mode: TrackingMode) => void
}

type ArToolkitSourceInstance = {
  domElement: HTMLVideoElement
  ready: boolean
  init: (onReady: () => void, onError?: (error: Error) => void) => void
  onResizeElement: () => void
  copyElementSizeTo: (element: HTMLElement) => void
  dispose: () => void
}

type ArToolkitContextInstance = {
  arController: { canvas: HTMLCanvasElement } | null
  init: (onCompleted: () => void) => void
  getProjectionMatrix: () => THREE.Matrix4
  update: (element: HTMLVideoElement) => void
  dispose?: () => void
}

type ThreexModule = {
  ArToolkitSource: new (config: Record<string, unknown>) => ArToolkitSourceInstance
  ArToolkitContext: new (config: Record<string, unknown>) => ArToolkitContextInstance
  ArMarkerControls: new (
    context: ArToolkitContextInstance,
    anchor: THREE.Group,
    config: Record<string, unknown>,
  ) => void
}

const ensureThreeOnGlobal = () => {
  const globalObject = globalThis as typeof globalThis & { THREE?: typeof THREE }
  if (!globalObject.THREE) {
    globalObject.THREE = THREE
  }
}

const loadArToolkitModule = (() => {
  let loader: Promise<ThreexModule> | null = null
  return () => {
    if (!loader) {
      loader = (async () => {
        ensureThreeOnGlobal()
        const module = await import('@ar-js-org/ar.js/three.js/build/ar-threex.js')
        const candidate = ((module as { default?: unknown }).default ?? module) as Partial<ThreexModule>
        if (!candidate.ArToolkitSource || !candidate.ArToolkitContext || !candidate.ArMarkerControls) {
          throw new Error('AR.js module is missing expected exports (ArToolkitSource/Context/MarkerControls)')
        }
        return candidate as ThreexModule
      })()
    }
    return loader
  }
})()

const PortalScene = ({ onEnterPortal, onTrackingModeChange }: PortalSceneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let currentTrackingMode: TrackingMode = 'fallback'
    const updateTrackingMode = (mode: TrackingMode) => {
      if (currentTrackingMode === mode) {
        return
      }
      currentTrackingMode = mode
      onTrackingModeChange?.(mode)
    }

    updateTrackingMode('fallback')

    let arToolkitSource: ArToolkitSourceInstance | null = null
    let arToolkitContext: ArToolkitContextInstance | null = null
    let disposed = false

    const scene = new THREE.Scene()
    const portalAnchor = new THREE.Group()
    portalAnchor.matrixAutoUpdate = true
    portalAnchor.position.set(0, 0, -3)
    scene.add(portalAnchor)

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
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.zIndex = '1'
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
    portalSurface.position.set(0, portalHeight / 2, 0)
    portalAnchor.add(portalSurface)

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
    portalAnchor.add(portalFrame)

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

    const handleResize = () => {
      if (!container) {
        return
      }

      if (!arToolkitSource || !arToolkitSource.ready) {
        const width = container.clientWidth
        const height = container.clientHeight
        if (!width || !height) {
          return
        }
        renderer.setSize(width, height)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        return
      }

      arToolkitSource.onResizeElement()
      arToolkitSource.copyElementSizeTo(renderer.domElement)
      if (arToolkitContext?.arController?.canvas) {
        arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(container)
    window.addEventListener('resize', handleResize)

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const setupMarkerTracking = async () => {
      try {
        const threexModule = await loadArToolkitModule()
        if (disposed) {
          return
        }

        const wasFallback = currentTrackingMode === 'fallback'
        updateTrackingMode('ar')
        if (wasFallback) {
          // Give the CameraBackground hook a frame to release its MediaStream before AR.js requests it.
          await wait(150)
        }

        const source = new threexModule.ArToolkitSource({
          sourceType: 'webcam',
          sourceParameters: {
            facingMode: { ideal: 'environment' },
          },
        })
        arToolkitSource = source

        await new Promise<void>((resolve, reject) => {
          source.init(
            () => resolve(),
            (error: Error) => reject(error),
          )
        })
        if (disposed) {
          return
        }

        const videoElement = source.domElement
        videoElement.setAttribute('playsinline', 'true')
        videoElement.style.position = 'absolute'
        videoElement.style.top = '0'
        videoElement.style.left = '0'
        videoElement.style.width = '100%'
        videoElement.style.height = '100%'
        videoElement.style.objectFit = 'cover'
        videoElement.style.zIndex = '0'
        videoElement.muted = true
        if (!videoElement.parentElement) {
          container.prepend(videoElement)
        }

        const context = new threexModule.ArToolkitContext({
          cameraParametersUrl: '/ar-data/camera_para.dat',
          detectionMode: 'mono',
          maxDetectionRate: 30,
          canvasWidth: 1280,
          canvasHeight: 720,
        })
        arToolkitContext = context

        await new Promise<void>((resolve) => {
          context.init(() => {
            if (disposed) {
              resolve()
              return
            }
            camera.matrixAutoUpdate = false
            camera.position.set(0, 0, 0)
            camera.rotation.set(0, 0, 0)
            camera.projectionMatrix.copy(context.getProjectionMatrix())
            resolve()
          })
        })
        if (disposed) {
          return
        }

        portalAnchor.matrixAutoUpdate = false
        portalAnchor.position.set(0, 0, 0)
        portalAnchor.rotation.set(0, 0, 0)

        new threexModule.ArMarkerControls(context, portalAnchor, {
          type: 'pattern',
          patternUrl: '/ar-data/patt.hiro',
          size: 1,
        })

        handleResize()
      } catch (error) {
        console.error('Failed to initialize AR.js marker tracking', error)
        if (arToolkitSource) {
          const videoElement = arToolkitSource.domElement
          if (videoElement?.parentElement) {
            videoElement.parentElement.removeChild(videoElement)
          }
          arToolkitSource.dispose()
          arToolkitSource = null
        }
        portalAnchor.matrixAutoUpdate = true
        portalAnchor.position.set(0, 0, -3)
        portalAnchor.rotation.set(0, 0, 0)
        updateTrackingMode('fallback')
      }
    }

    void setupMarkerTracking()

    renderer.render(scene, camera)
    handleResize()

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

      if (arToolkitSource?.ready && arToolkitContext) {
        arToolkitContext.update(arToolkitSource.domElement)
      }

      renderer.render(scene, camera)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      disposed = true
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      container.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()

      if (arToolkitSource) {
        const videoElement = arToolkitSource.domElement
        if (videoElement?.parentElement) {
          videoElement.parentElement.removeChild(videoElement)
        }
        arToolkitSource.dispose()
        arToolkitSource = null
      }

      if (arToolkitContext) {
        arToolkitContext.dispose?.()
        arToolkitContext = null
      }
      if (rendererRef.current) {
        container.removeChild(rendererRef.current.domElement)
        rendererRef.current.dispose()
        rendererRef.current = null
      }

      portalRenderTarget.dispose()
      updateTrackingMode('fallback')
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
  }, [onEnterPortal, onTrackingModeChange])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  )
}

export default PortalScene
