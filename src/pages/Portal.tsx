import { useCallback } from 'react'
import PortalScene from '../components/PortalScene'
import { theme } from '../theme'

const Portal = () => {
  const handleEnterPortal = useCallback(() => {
    // Placeholder for future AR/WebXR hook
    console.log('CTA clicked inside 3D')
  }, [])

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: `${theme.spacing.md} ${theme.spacing.lg}`,
          borderBottom: `1px solid rgba(255, 255, 255, 0.1)`,
        }}
      >
        <p style={{ color: theme.colors.textMuted, letterSpacing: '0.08em' }}>Portal Prototype - 3D Scene</p>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
        }}
      >
        <PortalScene onEnterPortal={handleEnterPortal} />
      </div>
    </div>
  )
}

export default Portal
