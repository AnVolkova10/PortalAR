import { useCallback, useState } from 'react'
import CameraBackground from '../components/CameraBackground'
import PortalScene from '../components/PortalScene'
import { theme } from '../theme'

const Portal = () => {
  const [cameraBackgroundDisabled, setCameraBackgroundDisabled] = useState(false)

  const handleEnterPortal = useCallback(() => {
    // Future AR/WebXR portal activation logic will live here once the session is wired up.
    console.log('CTA clicked inside 3D')
  }, [])

  const handleTrackingModeChange = useCallback((mode: 'ar' | 'fallback') => {
    setCameraBackgroundDisabled(mode === 'ar')
  }, [])

  return (
    <div style={{ width: '100%', height: '100vh', backgroundColor: theme.colors.background, overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Camera layer is active until AR.js successfully takes over the video feed inside the PortalScene. */}
        <CameraBackground disabled={cameraBackgroundDisabled} />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
          }}
        >
          <PortalScene onEnterPortal={handleEnterPortal} onTrackingModeChange={handleTrackingModeChange} />
        </div>

        <header
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            display: 'flex',
            justifyContent: 'space-between',
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            color: theme.colors.text,
            mixBlendMode: 'difference',
          }}
        >
          <p style={{ letterSpacing: '0.08em' }}>Portal Prototype - 3D Scene</p>
          <span style={{ color: theme.colors.textMuted, fontSize: '0.9rem' }}>Camera preview active</span>
        </header>
      </div>
    </div>
  )
}

export default Portal
