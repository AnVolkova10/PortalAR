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
    let viewerReferenceSpace: XRReferenceSpace | null = null
    let hitTestSource: XRHitTestSource | null = null
    let xrSupported = false
    let xrStarting = false
    let portalLocked = false
    let hasPlacementPose = false
    let insidePortal = false

    const lastHitMatrix = new THREE.Matrix4()
    const placementPosition = new THREE.Vector3()
    const placementQuaternion = new THREE.Quaternion()
    const placementScale = new THREE.Vector3()
    const cameraDirection = new THREE.Vector3()
    const tempEuler = new THREE.Euler()
    const portalForward = new THREE.Vector3(0, 0, -1)
    const portalWorldPosition = new THREE.Vector3()
    const cameraWorldPosition = new THREE.Vector3()
    const tempVector = new THREE.Vector3()

    const disposeHitTestSource = () => {
      hitTestSource?.cancel?.()
      hitTestSource = null
    }

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

    const occlusionDomeMaterial = new THREE.MeshBasicMaterial({
      color: 0x020617,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const occlusionDome = new THREE.Mesh(new THREE.SphereGeometry(25, 64, 64), occlusionDomeMaterial)
    occlusionDome.visible = false
    scene.add(occlusionDome)
    let occlusionOpacityTarget = 0

    const portalAnchor = new THREE.Group()
    portalAnchor.visible = false
    scene.add(portalAnchor)

    const interiorEnvironment = new THREE.Group()
    interiorEnvironment.visible = false
    portalAnchor.add(interiorEnvironment)

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

    let portalWorldCamera!: THREE.PerspectiveCamera
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const updateRendererSize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) {
        return
      }
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      if (portalWorldCamera) {
        portalWorldCamera.aspect = camera.aspect
        portalWorldCamera.updateProjectionMatrix()
      }
    }
    updateRendererSize()
    const baseClearColor = new THREE.Color(0x020617)
    let clearAlpha = 0
    let clearAlphaTarget = 0
    renderer.setClearColor(baseClearColor, 0)
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

    const portalWidth = 1.1
    const portalHeight = 2.8
    const portalAspect = portalWidth / portalHeight

    const portalRenderTarget = new THREE.WebGLRenderTarget(1024, Math.round(1024 / portalAspect))
    portalRenderTarget.texture.colorSpace = THREE.SRGBColorSpace

    const portalWorldScene = new THREE.Scene()
    portalWorldScene.background = new THREE.Color(0x050c1a)

    const registerEnvironmentObject = <T extends THREE.Object3D>(object: T): T => {
      portalWorldScene.add(object)
      const mirror = object.clone(true)
      interiorEnvironment.add(mirror)
      return mirror as T
    }

    portalWorldCamera = new THREE.PerspectiveCamera(55, portalAspect, 0.1, 50)
    portalWorldCamera.position.set(1.4, 1.1, 3)
    portalWorldCamera.lookAt(0, 0.4, 0)

    const portalWorldAmbient = new THREE.HemisphereLight(0xbfeafc, 0x06111f, 0.85)
    registerEnvironmentObject(portalWorldAmbient)

    const portalWorldLight = new THREE.DirectionalLight(0xbde0fe, 1.1)
    portalWorldLight.position.set(1.3, 1.8, 2.3)
    const portalWorldLightMirror = registerEnvironmentObject(portalWorldLight)

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
    const centerpieceMirror = registerEnvironmentObject(centerpiece)

    const groundGeometry = new THREE.CircleGeometry(3.5, 64)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c1a2c,
      roughness: 0.95,
      metalness: 0,
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    registerEnvironmentObject(ground)

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
    const mistMirror = registerEnvironmentObject(mist)
    const mistMirrorMaterial = mistMirror.material as THREE.MeshBasicMaterial

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
    const nebulaMirror = registerEnvironmentObject(nebula)

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
    const firefliesMirror = registerEnvironmentObject(fireflies)

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
    const orbGroupMirror = registerEnvironmentObject(orbGroup)

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

    const setPortalVisibility = (visible: boolean) => {
      portalSurface.visible = visible
      portalFrame.visible = visible
    }

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

    const restoreHitTestSource = async () => {
      if (!xrSession || !viewerReferenceSpace || !xrSession.requestHitTestSource) {
        return
      }
      const newSource = await xrSession.requestHitTestSource({ space: viewerReferenceSpace })
      if (disposed) {
        newSource?.cancel?.()
        return
      }
      hitTestSource = newSource ?? null
    }

    const enterPortalInterior = () => {
      if (insidePortal) {
        return
      }
      insidePortal = true
      disposeHitTestSource()
      reticle.visible = false
      hasPlacementPose = false
      setPortalVisibility(false)
      interiorEnvironment.visible = true
      occlusionOpacityTarget = 0.98
      occlusionDome.visible = true
      clearAlphaTarget = 1
      onEnterPortal?.()
    }

    const exitPortalInterior = () => {
      if (!insidePortal) {
        return
      }
      insidePortal = false
      setPortalVisibility(true)
      interiorEnvironment.visible = false
      occlusionOpacityTarget = 0
      occlusionDome.visible = true
      clearAlphaTarget = 0
      if (!hitTestSource) {
        void restoreHitTestSource()
      }
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== container) {
          continue
        }
        const { width, height } = entry.contentRect
        if (!width || !height || renderer.xr.isPresenting) {
          continue
        }
        updateRendererSize()
      }
    })
    resizeObserver.observe(container)

    const handleViewportResize = () => {
      if (!renderer.xr.isPresenting) {
        updateRendererSize()
      }
    }
    window.addEventListener('resize', handleViewportResize)
    window.addEventListener('orientationchange', handleViewportResize)
    window.visualViewport?.addEventListener('resize', handleViewportResize)

    const clock = new THREE.Clock()

    const renderPortalWorld = (elapsed: number) => {
      centerpiece.rotation.y += 0.004
      centerpiece.position.y = 0.55 + Math.sin(elapsed * 0.5) * 0.04
      centerpieceMirror.rotation.copy(centerpiece.rotation)
      centerpieceMirror.position.copy(centerpiece.position)

      mist.rotation.z = Math.sin(elapsed * 0.2) * 0.02
      mistMaterial.opacity = 0.1 + Math.sin(elapsed * 0.6) * 0.02
      mistMirror.rotation.copy(mist.rotation)
      mistMirrorMaterial.opacity = mistMaterial.opacity

      nebula.rotation.y += 0.0006
      nebulaMirror.rotation.copy(nebula.rotation)
      fireflies.rotation.y += 0.0008
      firefliesMirror.rotation.copy(fireflies.rotation)

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
        const mirrorChild = orbGroupMirror.children[index] as THREE.Mesh | undefined
        if (mirrorChild) {
          mirrorChild.position.copy(child.position)
        }
      })

      portalWorldLight.intensity = 1.05 + Math.sin(elapsed * 0.4) * 0.08
      portalWorldLightMirror.intensity = portalWorldLight.intensity

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
      portalForward.set(0, 0, -1).applyQuaternion(portalAnchor.quaternion).normalize()
      portalLocked = true
      reticle.visible = false
      setPortalVisibility(true)
    }

    const handleSessionEnd = () => {
      disposeHitTestSource()
      xrReferenceSpace = null
      viewerReferenceSpace = null
      xrSession = null
      renderer.setAnimationLoop(null)
      renderer.xr.enabled = false
      portalLocked = false
      hasPlacementPose = false
      insidePortal = false
      portalAnchor.visible = false
      interiorEnvironment.visible = false
      setPortalVisibility(false)
      reticle.visible = false
      occlusionOpacityTarget = 0
      occlusionDomeMaterial.opacity = 0
      occlusionDome.visible = false
      clearAlpha = 0
      clearAlphaTarget = 0
      renderer.setClearColor(baseClearColor, 0)
      setArButtonState()
    }

    const startWebXrSession = async () => {
      if (disposed || xrSession || xrStarting || !navigator.xr) {
        return
      }
      const root = container; // tu domOverlay root
      Object.assign(root.style, {
        position: 'fixed',
        inset: '0',
        width: '100vw',
        height: 'var(--viewport-height, 100vh)',
        background: 'transparent',
        pointerEvents: 'auto',
        zIndex: '999'           // para botones overlay
      });

      // asegurá que no haya fondos opacos heredados
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
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
        insidePortal = false
        portalAnchor.visible = false
        reticle.visible = false
        interiorEnvironment.visible = false
        setPortalVisibility(false)
        occlusionOpacityTarget = 0
        occlusionDomeMaterial.opacity = 0
        occlusionDome.visible = false
        renderer.xr.enabled = true
        await renderer.xr.setSession(session)
        xrReferenceSpace = await session.requestReferenceSpace('local')
        viewerReferenceSpace = await session.requestReferenceSpace('viewer')
        if (!session.requestHitTestSource) {
          throw new Error('WebXR hit-test is not supported on this device')
        }
        const newHitTestSource = await session.requestHitTestSource({ space: viewerReferenceSpace })
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
          if (portalLocked && insidePortal) {
            onEnterPortal?.()
          }
        })

        renderer.setAnimationLoop((_, frame) => {
          const elapsed = clock.getElapsedTime()
          const xrCamera = renderer.xr.getCamera()
          xrCamera.getWorldPosition(cameraWorldPosition)
          occlusionDome.position.copy(cameraWorldPosition)
          occlusionDomeMaterial.opacity += (occlusionOpacityTarget - occlusionDomeMaterial.opacity) * 0.08
          if (occlusionDomeMaterial.opacity <= 0.01 && occlusionOpacityTarget === 0) {
            occlusionDome.visible = false
            occlusionDomeMaterial.transparent = true
          } else {
            occlusionDome.visible = true
            if (occlusionDomeMaterial.opacity > 0.95 && occlusionOpacityTarget > 0.9) {
              occlusionDomeMaterial.transparent = false
              occlusionDomeMaterial.opacity = 1
            } else {
              occlusionDomeMaterial.transparent = true
            }
          }
          clearAlpha += (clearAlphaTarget - clearAlpha) * 0.08
          renderer.setClearColor(baseClearColor, Math.min(1, Math.max(0, clearAlpha)))

          if (portalLocked) {
            portalAnchor.getWorldPosition(portalWorldPosition)
            const signedDistance = tempVector.copy(cameraWorldPosition).sub(portalWorldPosition).dot(portalForward)
            if (!insidePortal && signedDistance > 0.25) {
              enterPortalInterior()
            } else if (insidePortal && signedDistance < -0.1) {
              exitPortalInterior()
            }
          }

          if (!insidePortal && frame && hitTestSource && xrReferenceSpace) {
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
          } else if (insidePortal) {
            reticle.visible = false
            hasPlacementPose = false
          }

          renderPortalWorld(elapsed)
          interiorEnvironment.visible = insidePortal
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
      window.removeEventListener('resize', handleViewportResize)
      window.removeEventListener('orientationchange', handleViewportResize)
      window.visualViewport?.removeEventListener('resize', handleViewportResize)
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
      occlusionDome.geometry.dispose()
      occlusionDomeMaterial.dispose()

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
