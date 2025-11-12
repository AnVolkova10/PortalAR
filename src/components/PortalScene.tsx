import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type PortalSceneProps = {
  onEnterPortal?: () => void
}

const PortalScene = ({ onEnterPortal }: PortalSceneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let disposed = false
    let xrSession: XRSession | null = null
    let xrReferenceSpace: XRReferenceSpace | null = null
    let hitTestSource: XRHitTestSource | null = null
    let xrSupported = false
    let xrStarting = false
    let portalLocked = false
    let hasPlacementPose = false

    const lastHitMatrix = new THREE.Matrix4()
    const placementPosition = new THREE.Vector3()
    const placementQuaternion = new THREE.Quaternion()
    const placementScale = new THREE.Vector3()
    const cameraDirection = new THREE.Vector3()
    const tempEuler = new THREE.Euler()

    const arButton = document.createElement('button')
    arButton.type = 'button'
    arButton.textContent = 'Iniciar AR'
    Object.assign(arButton.style, {
      position: 'fixed',
      bottom: '1.25rem',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '0.9rem 2rem',
      borderRadius: '999px',
      border: 'none',
      fontSize: '1rem',
      fontWeight: '600',
      background: 'rgba(15, 23, 42, 0.9)',
      color: '#fff',
      letterSpacing: '0.08em',
      boxShadow: '0 10px 40px rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer',
      zIndex: '999',
      display: 'none',
      pointerEvents: 'auto',
    })
    container.appendChild(arButton)

    const setArButtonState = () => {
      if (disposed) {
        arButton.style.display = 'none'
        return
      }
      if (!xrSupported) {
        arButton.style.display = 'inline-flex'
        arButton.textContent = 'AR no disponible'
        arButton.disabled = true
        return
      }
      arButton.disabled = xrStarting
      arButton.textContent = xrStarting ? 'Iniciando...' : 'Iniciar AR'
      arButton.style.display = xrSession ? 'none' : 'inline-flex'
    }

    const scene = new THREE.Scene()

    const portalAnchor = new THREE.Group()
    portalAnchor.visible = false
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
    renderer.domElement.style.inset = '0'
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
      side: THREE.BackSide,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.15,
    })
    const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial)
    portalWorldScene.add(nebula)

    const firefliesGeometry = new THREE.BufferGeometry()
    const firefliesCount = 180
    const fireflyPositions = new Float32Array(firefliesCount * 3)
    const fireflySizes = new Float32Array(firefliesCount)
    for (let i = 0; i < firefliesCount; i += 1) {
      const radius = Math.random() * 3 + 0.5
      const angle = Math.random() * Math.PI * 2
      fireflyPositions[i * 3] = Math.cos(angle) * radius
      fireflyPositions[i * 3 + 1] = Math.random() * 1.2
      fireflyPositions[i * 3 + 2] = Math.sin(angle) * radius
      fireflySizes[i] = Math.random() * 0.8 + 0.4
    }
    firefliesGeometry.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3))
    firefliesGeometry.setAttribute('aSize', new THREE.BufferAttribute(fireflySizes, 1))
    const firefliesMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.08,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
    const fireflies = new THREE.Points(firefliesGeometry, firefliesMaterial)
    portalWorldScene.add(fireflies)

    const orbGeometry = new THREE.SphereGeometry(0.12, 16, 16)
    const orbMaterials: THREE.MeshStandardMaterial[] = []
    const orbGroup = new THREE.Group()
    for (let i = 0; i < 6; i += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.55 + i * 0.05, 0.7, 0.6),
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.6,
        metalness: 0.2,
        roughness: 0.3,
      })
      const orb = new THREE.Mesh(orbGeometry, material)
      orb.userData.radius = 0.7 + i * 0.18
      orb.userData.speed = 0.18 + i * 0.03
      orb.userData.height = 0.25 + i * 0.06
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
      roughness: 0.7,
      emissive: 0x0f172a,
      emissiveIntensity: 0.5,
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
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.3,
      side: THREE.DoubleSide,
    })
    const portalFrame = new THREE.Mesh(portalFrameGeometry, portalFrameMaterial)
    portalFrame.position.copy(portalSurface.position)
    portalFrame.rotation.y = Math.PI
    portalAnchor.add(portalFrame)

    const reticleGeometry = new THREE.RingGeometry(0.35, 0.4, 48)
    reticleGeometry.rotateX(-Math.PI / 2)
    const reticleMaterial = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.75,
    })
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial)
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add(reticle)

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== container) {
          continue
        }
        const { width, height } = entry.contentRect
        if (!width || !height || renderer.xr.isPresenting) {
          continue
        }
        renderer.setSize(width, height)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
    })
    resizeObserver.observe(container)

    const clock = new THREE.Clock()

    const renderPortalWorld = (elapsed: number) => {
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
    }

    const applyPlacement = () => {
      portalAnchor.visible = true
      portalAnchor.position.copy(placementPosition)
      portalAnchor.position.y = Math.max(0, portalAnchor.position.y)
      const xrCamera = renderer.xr.getCamera()
      xrCamera.getWorldDirection(cameraDirection)
      const yaw = Math.atan2(cameraDirection.x, cameraDirection.z)
      tempEuler.set(0, yaw + Math.PI, 0)
      portalAnchor.quaternion.setFromEuler(tempEuler)
      portalLocked = true
      reticle.visible = false
    }

    const handleSessionEnd = () => {
      hitTestSource?.cancel?.()
      hitTestSource = null
      xrReferenceSpace = null
      xrSession = null
      renderer.setAnimationLoop(null)
      renderer.xr.enabled = false
      portalLocked = false
      hasPlacementPose = false
      portalAnchor.visible = false
      reticle.visible = false
      setArButtonState()
    }

    const startWebXrSession = async () => {
      if (disposed || xrSession || xrStarting || !navigator.xr) {
        return
      }
      xrStarting = true
      setArButtonState()
      try {
        const session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['hit-test'],
          optionalFeatures: ['dom-overlay', 'local-floor'],
          domOverlay: { root: container },
        })
        xrSession = session
        portalLocked = false
        hasPlacementPose = false
        portalAnchor.visible = false
        reticle.visible = false
        renderer.xr.enabled = true
        await renderer.xr.setSession(session)
        xrReferenceSpace = await session.requestReferenceSpace('local')
        const viewerSpace = await session.requestReferenceSpace('viewer')
        if (!session.requestHitTestSource) {
          throw new Error('WebXR hit-test is not supported on this device')
        }
        const newHitTestSource = await session.requestHitTestSource({ space: viewerSpace })
        if (!newHitTestSource) {
          throw new Error('Unable to create hit-test source')
        }
        hitTestSource = newHitTestSource

        session.addEventListener('end', handleSessionEnd)
        session.addEventListener('select', () => {
          if (!portalLocked && hasPlacementPose) {
            applyPlacement()
            return
          }
          if (portalLocked) {
            onEnterPortal?.()
          }
        })

        renderer.setAnimationLoop((_, frame) => {
          const elapsed = clock.getElapsedTime()
          if (frame && hitTestSource && xrReferenceSpace) {
            const results = frame.getHitTestResults(hitTestSource)
            if (results.length > 0) {
              const pose = results[0].getPose(xrReferenceSpace)
              if (pose && !portalLocked) {
                lastHitMatrix.fromArray(pose.transform.matrix)
                reticle.visible = true
                reticle.matrix.copy(lastHitMatrix)
                lastHitMatrix.decompose(placementPosition, placementQuaternion, placementScale)
                hasPlacementPose = true
              }
            } else if (!portalLocked) {
              reticle.visible = false
              hasPlacementPose = false
            }
          }
          renderPortalWorld(elapsed)
        })
      } catch (error) {
        console.error('Failed to start WebXR session', error)
        if (xrSession) {
          xrSession.removeEventListener('end', handleSessionEnd)
          xrSession.end().catch(() => undefined)
        }
        xrSession = null
      } finally {
        xrStarting = false
        setArButtonState()
      }
    }

    arButton.addEventListener('click', (event) => {
      event.stopPropagation()
      void startWebXrSession()
    })

    const checkXrSupport = async () => {
      if (!navigator.xr) {
        xrSupported = false
        setArButtonState()
        return
      }
      try {
        xrSupported = await navigator.xr.isSessionSupported('immersive-ar')
      } catch (error) {
        console.warn('Unable to verify WebXR support', error)
        xrSupported = false
      }
      setArButtonState()
    }

    void checkXrSupport()

    return () => {
      disposed = true
      resizeObserver.disconnect()
      arButton.remove()

      if (xrSession) {
        xrSession.removeEventListener('end', handleSessionEnd)
        xrSession.end().catch(() => undefined)
      }

      renderer.setAnimationLoop(null)

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
      reticleGeometry.dispose()
      reticleMaterial.dispose()

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
        minHeight: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  )
}

export default PortalScene
