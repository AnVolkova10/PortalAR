# Portal AR Prototype

Web-based AR experience built with Vite + React + Three.js that lets you place a sci‑fi portal in the real world, step through it, and stay immersed in the interior scene. This milestone swaps marker tracking for WebXR hit‑tests and adds a full “inside portal” state (occludes the real world, clones the portal environment around you, and lets you re‑exit through the doorway).

## Requirements

- Node.js ≥ 18
- Chrome/Android with WebXR (`immersive-ar`) enabled
- HTTPS endpoint (local dev works via `vite --https`; expose it with ngrok so the phone can reach it)

## Setup & Run

```bash
npm install
npm run dev
ngrok http 5173
```

Expose the dev server (e.g. `ngrok http https://localhost:5173`) and open the HTTPS URL on your phone. Grant camera + motion permissions the first time.

## How It Works

- **Portal placement** – `PortalScene.tsx` boots a Three.js scene, requests a WebXR `immersive-ar` session with hit‑tests, and shows a reticle. Tap “Iniciar AR”, aim at the floor, then tap once more to anchor the door.
- **WebXR hit-test loop** – once the session starts we keep a viewer reference space + hit‑test source. Results drive the reticle pose (`placementPosition`) until you lock the portal.
- **Crossing detection** – the portal’s forward vector projects the XR camera position to compute a signed distance. When it flips positive you’re “inside”; negative re-enters the real world.
- **Interior rendering**:
  - The original portal world renders to `portalRenderTarget` for the doorway.
  - A mirrored `interiorEnvironment` (same geometry/lights) surrounds you when you cross.
  - A WebGL clear-color fade + a giant occlusion dome blocks the camera feed so you only see the virtual scene.
- **Lifecycle guards** – hit-test sources, XR references, reticles, and resources are cleaned up on exit/dispose. Returning to the real world restores the reticle so you can relocate the door.

## Key Files

- `src/components/PortalScene.tsx` – everything AR: renderer setup, WebXR session management, reticle + portal anchoring, portal crossing logic, and environment cloning.
- `src/pages/Portal.tsx` – full-screen layout + header label.
- `src/styles/globals.css` – ensures the canvas spans the entire safe viewport and disables scroll so the AR button stays reachable.

## Testing Checklist

1. Run `npm run lint` and `npm run build` (already green).
2. Launch the dev server over HTTPS, open on Android Chrome.
3. Tap “Iniciar AR”, place the portal, walk through it:
   - Outside: you should still see your room around the glowing doorway.
   - Inside: the real world disappears, the nebula/orbs surround you.
4. Walk back through the door to return to AR placement mode (reticle reappears). Repeat as needed.

Enjoy the trip to the other side ✨
