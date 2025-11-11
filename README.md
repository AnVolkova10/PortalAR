# Portal AR Prototype - Step 1

This repository bootstraps the Portal AR proof of concept with Vite, React, TypeScript, and Three.js. The current milestone focuses on proving that routing works and that a Three.js scene can render and expose a clickable CTA object inside React - no AR/WebXR integrations yet.

## Getting Started

1. Install dependencies once:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Visit the landing page at `http://localhost:5173/` and navigate to `/portal` to see the Three.js scene.

## What's Included

- **Routing**: `/` (Landing) and `/portal` (3D placeholder) powered by React Router.
- **Three.js integration**: `PortalScene` mounts a scene, renderer, camera, torus, lighting, and a `portalEntryObject` CTA mesh that sits in front of the camera.
- **Interaction**: A basic raycaster listens for pointer/tap events on the CTA mesh and triggers a React callback (`console.log` for now).
- **Cleanup & resilience**: Animation loop, resize listeners, and renderer resources are properly disposed on unmount.
- **Design scaffolding**: `src/theme.ts` holds placeholder tokens, and `src/styles/globals.css` keeps the visual layer minimal but cohesive.

## Next Steps

Future steps can replace the placeholder CTA with the actual "enter portal" action, connect AR/WebXR pipelines, and introduce camera/video backgrounds. The current scene is intentionally simple so those additions can build on a clean, proven baseline.
