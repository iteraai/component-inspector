# `@iteraai/vite-plugin-react-inspector`

## 0.1.2

### Patch Changes

- Re-release the capture-enabled Vite plugin package against `@iteraai/react-component-inspector@0.5.1` for npm publishing.

- Updated dependencies
  - @iteraai/react-component-inspector@0.5.1

## 0.1.1

### Patch Changes

- Add runtime-assisted iteration element capture for canvas annotation screenshots.

  The iteration inspector runtime now advertises `element_capture_v1`, accepts
  `capture_element_crop` requests, re-resolves selected element locators inside the
  embedded runtime, and returns `element_crop_captured` responses carrying PNG
  `Blob` payloads or typed failures. DOM targets use a small rasterization
  dependency, while image and canvas targets use native canvas export where
  possible.

  The React, Vue, Angular, and React Vite plugin package surfaces now expose the
  capture contract, and the example host harness can request and display a
  selected element screenshot from the embedded runtime.

- Updated dependencies
  - @iteraai/react-component-inspector@0.5.0

## 0.1.0

### Minor Changes

- 1e79b3e: Add the initial React-Vite inspector plugin package with Vite HTML injection and a guarded virtual runtime module.
