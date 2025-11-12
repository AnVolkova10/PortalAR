import { useCallback } from 'react'
import PortalScene from '../components/PortalScene'
import { theme } from '../theme'

const Portal = () => {
  const handleEnterPortal = useCallback(() => {
    // Future AR/WebXR portal activation logic will live here once the session is wired up.
    console.log('CTA clicked inside 3D')
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100svh',
        minHeight: '100vh',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100%' }}>
        <PortalScene onEnterPortal={handleEnterPortal} />

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
          <p style={{ letterSpacing: '0.08em' }}>Portal Prototype - WebXR</p>
          <span style={{ color: theme.colors.textMuted, fontSize: '0.9rem' }}>Tap “Iniciar AR” para comenzar</span>
        </header>
      </div>
    </div>
  )
}

export default Portal
