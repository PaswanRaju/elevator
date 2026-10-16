# THE ELEVATOR

An 18-second cinematic experience built in the existing Next.js App Router project with React, TypeScript and Three.js. Three connected scenes, two visitor actions, and an optional replay. No accounts, backend, remote assets, or API keys.

## The experience

1. **The Arrival:** a dimensional stone hallway, champagne metal elevator doors, recessed lighting, polished floor reflections, floating dust, and a subtle drifting camera. Select **Step inside**.
2. **The Ride:** doors open; the camera enters and turns inside the cabin. Press the illuminated **13** control. Doors close, the floor display counts upward, and subtle acceleration and vibration accompany the ascent.
3. **The Reveal:** doors open onto a nighttime rooftop. The camera moves out toward a layered city, glass balustrade, luminous tower, moon, aircraft lights, and the message: “You weren’t meant to find this. But somehow, you knew where to look.” As the doors part, Raju's photo (`public/raju.png`) rises into a floating gold frame behind glass, turns to face the visitor, emerges from shadow into its true colors, catches a light sweep, then drifts gently and tilts toward the mouse. It sits beside the copy in landscape and beneath it in portrait. Replay returns to the arrival.

**The guide.** A small animated companion (`public/avatar.jpg`, zoomed onto the eyes in a gold-ringed medallion) sits in the bottom corner. Its speech bubbles are triggered by the journey's actual scene changes: a welcome and wave on arrival, “See that elevator?”, a nudge to press 13 in the cabin, a startled reaction while ascending, a “Ding!” on arrival, and a welcome to Floor 13. Tapping it gives a few extra lines per scene. The × hides it; a “Guide” pill reopens it, and the choice is remembered for the browser session. Bubbles retire on their own, and they hold while the journey is paused. All dialogue is local; no AI or paid service is involved.

The entry takes 5.6 seconds and the ride/reveal takes 12.4 seconds. Time spent deciding to enter or pressing 13 is additional. The journey pauses when the page is hidden. The pause control also holds the animation and sound. Reduced motion replaces the camera travel and turn with stationary viewpoints and shortens the sequence to 3.8 seconds.

Sound is off initially. The sound control enables locally synthesized motor rumble, door movement, arrival chimes, and rooftop air after a user gesture. No audio files are downloaded. Replay retains the visitor's sound preference for the current session.

## Run locally

Node.js 22.18+ and npm are required.

```sh
npm install
npm run dev
```

Open http://localhost:3000. For production preview:

```sh
npm run build
npm start
```

## Rendering and phone performance

- Three.js loads in a separate client chunk. The HTML, controls, and loading view render before it loads.
- The architecture, city, window lights, materials, and textures are generated locally. There are no remote models, HDR files, fonts, or media requests. The portrait texture is requested through Next's image optimizer as a WebP (about 56 KB at 1080px, versus 1.9 MB for the PNG), and falls back to the original file. Neither image file is modified. Next 16 only accepts the configured quality (`q=75` by default); any other value returns 400.
- The portrait uses no extra light source: its gold frame is lit by the environment map plus a faint emissive, so it adds no per-pixel lighting cost to the rooftop. Its shader compiles with the rest of the rooftop during loading, so the reveal does not stutter.
- Shared structural geometry and instanced windows keep draw calls down.
- A generated environment provides metal reflections; a single low-resolution planar reflector renders the hallway and terrace reflections.
- Coarse-pointer devices and narrow screens use a 30 fps target, a 1.35 pixel-ratio cap, no canvas MSAA, and a 384px reflection. Desktop caps pixel ratio at 1.75 with a 768px reflection. Sustained slow frames lower pixel ratio to 1.
- There is no full-screen bloom or postprocessing chain. Lighting halos use local sprite textures.
- Portrait and landscape have distinct camera framing. Floor 13's accessible HTML hit target follows the actual 3D panel projection.
- WebGL failure or context loss activates a clearly labeled lightweight view that retains the journey and replay.
- GPU resources, observers, animation frames, and audio are cleaned up on unmount.

These are implementation budgets, not measured phone performance guarantees. Real device profiling remains necessary.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser
# Save screenshots for visual inspection:
npm run test:browser -- --screenshots
```

The unit suite checks the total duration, door/environment sequencing, bounded and monotonic floor/progress values, reduced motion, and replay state.

The browser runner starts its own production server on port 3107, drives installed Chrome using its debugging pipe, and checks:

- Real WebGL startup and browser/shader errors.
- Normal-speed entry, Floor 13, reveal, replay, keyboard activation and focus.
- Guide tap dialogue, hide and reopen, and that the guide never overlaps journey controls or scene copy at any tested viewport.
- Pause/resume and explicit sound enable/mute controls.
- Touch/mouse input, viewport containment and 44px button targets.
- Seven viewports from 320 × 568 through 1920 × 1080, including tablet and phone landscape, with reduced motion.
- Actual WebGL context loss and completion through the compatibility view.

Set `CHROME_PATH` for a nonstandard Chrome location or `QA_PORT` for another port. `QA_LAYOUT_ONLY=1` skips the slow normal-speed desktop journey when iterating on layout.

Software WebGL renders the rooftop at roughly 1–2 fps. Because the journey clock caps each frame step at 0.1s (so a backgrounded tab cannot skip ahead), the 12.4s ride takes about 60s of wall time in this suite. The timeouts allow for that, and the suite logs the measured duration. Screenshots are written to ignored `.qa/`. Chrome uses software WebGL for deterministic automated checks; those checks do not establish physical GPU performance or audible sound quality.

## Verification status

ESLint, TypeScript, all 13 unit tests, the production build, and the complete browser suite (headless Chrome with software WebGL, seven viewports, context-loss fallback) pass locally, and the screenshots from every scene were inspected.

Not yet verified: real GPU frame rate, physical phones (Safari/iPhone, Android Chrome, the Instagram in-app browser), audible sound quality, and the normal-speed animation feel on a real display. The automated suite runs the animations far below real speed. Check these on devices before launch.

No deployment has been performed.

## Files

- `components/Elevator.tsx`: accessible controls, timeline loop, audio lifecycle, pause, replay, and fallback handling.
- `components/Guide.tsx`: the avatar guide, its scene-triggered dialogue, tap lines, and hide/reopen state.
- `public/raju.png`: the personal photo, used only by the Floor 13 reveal (3D portrait and compatibility view).
- `public/avatar.jpg`: used only by the corner guide. The browser suite asserts each image appears in its own place.
- `lib/world.ts`: real 3D architecture, materials, lighting, reflections, city, camera and GPU resource lifecycle.
- `lib/journey.ts`: shared animation timing and state calculation.
- `lib/sound.ts`: gesture-gated Web Audio soundscape.
- `lib/journey.test.ts`: journey behavior tests.
- `app/globals.css`: cinematic typography, controls, responsive layout and compatibility view.
- `scripts/browser-check.mjs`: production browser checks and optional screenshots.
- `app/layout.tsx`, `app/opengraph-image.tsx`: social metadata and preview image.

Social preview metadata uses Vercel's production URL when available, with the existing `the-elevator.vercel.app` fallback. Set the correct canonical origin before sharing a deployment on another host.
