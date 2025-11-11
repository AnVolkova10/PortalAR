import { type CSSProperties, useEffect, useRef, useState } from 'react'

const videoStyles: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: 0,
  backgroundColor: '#000',
}

const fallbackStyles: CSSProperties = {
  position: 'absolute',
  bottom: '1rem',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: '#fff',
  padding: '0.5rem 1rem',
  borderRadius: '999px',
  fontSize: '0.85rem',
  zIndex: 1,
}

const CameraBackground = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activeStream: MediaStream | null = null

    const enableCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is not supported on this device.')
        return
      }

      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = activeStream
          // Autoplay requires the element to be muted.
          videoRef.current.muted = true
          await videoRef.current.play().catch(() => undefined)
        }
      } catch (err) {
        console.error('Unable to start camera', err)
        setError('Unable to access the camera. Please allow video permissions.')
      }
    }

    enableCamera()

    return () => {
      activeStream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <video ref={videoRef} style={videoStyles} playsInline autoPlay muted />
      {error && <div style={fallbackStyles}>{error}</div>}
    </div>
  )
}

export default CameraBackground
