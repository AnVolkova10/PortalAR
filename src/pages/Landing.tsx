import { Link } from 'react-router-dom'
import { theme } from '../theme'

const Landing = () => {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        textAlign: 'center',
        padding: theme.spacing.lg,
      }}
    >
      <p style={{ color: theme.colors.textMuted, letterSpacing: '0.08em' }}>Portal AR PoC - Step 1</p>
      <h1 style={{ fontSize: '2.5rem', maxWidth: '28rem' }}>Portal AR Demo - go to portal</h1>
      <p style={{ maxWidth: '30rem', color: theme.colors.textMuted }}>
        This is a lightweight landing screen. Head to the portal route to see the Three.js scene with the clickable CTA
        placeholder.
      </p>
      <Link
        to="/portal"
        style={{
          marginTop: theme.spacing.md,
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          borderRadius: '999px',
          background: theme.colors.accent,
          color: theme.colors.background,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Enter portal prototype
      </Link>
    </main>
  )
}

export default Landing
