const VIEWPORT_VAR = '--viewport-height'
const UPDATE_DELAY_MS = 250

declare global {
  interface Window {
    __portalArViewportCleanup?: () => void
  }
}

const readViewportHeight = () => {
  const viewport = window.visualViewport
  if (viewport) {
    return viewport.height
  }
  return window.innerHeight
}

const setViewportHeightVar = () => {
  const height = Math.round(readViewportHeight())
  const heightValue = `${height}px`
  document.documentElement.style.setProperty(VIEWPORT_VAR, heightValue)
  document.documentElement.style.height = heightValue
  document.body.style.height = heightValue
}

const scheduleViewportUpdate = () => {
  setViewportHeightVar()
  requestAnimationFrame(setViewportHeightVar)
  window.setTimeout(setViewportHeightVar, UPDATE_DELAY_MS)
}

export const initViewportHeightWatcher = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.__portalArViewportCleanup?.()

  const handleViewportChange = () => {
    scheduleViewportUpdate()
  }

  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('orientationchange', handleViewportChange)
  window.addEventListener('focus', handleViewportChange)
  window.addEventListener('pageshow', handleViewportChange)
  document.addEventListener('visibilitychange', handleViewportChange)

  const viewport = window.visualViewport
  if (viewport) {
    viewport.addEventListener('resize', handleViewportChange)
    viewport.addEventListener('scroll', handleViewportChange)
  }

  window.__portalArViewportCleanup = () => {
    window.removeEventListener('resize', handleViewportChange)
    window.removeEventListener('orientationchange', handleViewportChange)
    window.removeEventListener('focus', handleViewportChange)
    window.removeEventListener('pageshow', handleViewportChange)
    document.removeEventListener('visibilitychange', handleViewportChange)
    viewport?.removeEventListener('resize', handleViewportChange)
    viewport?.removeEventListener('scroll', handleViewportChange)
  }

  scheduleViewportUpdate()
}
