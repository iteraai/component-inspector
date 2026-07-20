# `@iteraai/vite-plugin-react-inspector`

## 0.1.5

### Patch Changes

- 1ec222e: Allow React Vite inspector consumers on Vite 5 and later to resolve the plugin without a peer dependency conflict.

## 0.1.4

### Patch Changes

- fc0f970: Configure trusted iteration-runtime origins from bridge bootstrap and safely reconcile duplicate runtime bootstraps.
- Updated dependencies [fc0f970]
  - @iteraai/react-component-inspector@0.5.3

## 0.1.3

### Patch Changes

- Updated dependencies [b413bc4]
  - @iteraai/inspector-protocol@0.2.0
  - @iteraai/react-component-inspector@0.5.2

## 0.1.2

### Patch Changes

- Harden runtime-assisted element capture for production UI targets.

  DOM rasterizer captures now support request padding by drawing rasterized output
  into a padded PNG canvas instead of returning `unsupported_target`, and the DOM
  rasterization timeout has been increased to give real application elements more
  headroom before returning `dom_rasterization_failed`.

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
