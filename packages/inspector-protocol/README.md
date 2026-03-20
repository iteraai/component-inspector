# `@iteraai/inspector-protocol`

Protocol constants, message builders, validators, origin helpers, and security event constants for the Itera component inspector SDK.

Use this package anywhere you need to speak the hosted editor protocol without pulling in the React runtime package: host/editor integrations, embedded message handlers, smoke fixtures, and protocol-aware tests.

End-to-end customer integration guidance lives at [iteraai.github.io/docs](https://iteraai.github.io/docs/). Use this README for the protocol package surface, quick start, and the stable contract identifiers it exposes.

## Documentation

- [Docs home](https://iteraai.github.io/docs/)
- [Getting Started](https://iteraai.github.io/docs/getting-started)
- [Inspector Overview](https://iteraai.github.io/docs/inspector/)
- [React Integration](https://iteraai.github.io/docs/inspector/react)
- [Troubleshooting](https://iteraai.github.io/docs/inspector/troubleshooting)

## Installation

```bash
npm install @iteraai/inspector-protocol
```

Before the first npm publish, use the workspace package or a packed tarball. The package name and import paths below are the supported public contract.

## Public Surface

| Import path                              | Purpose                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@iteraai/inspector-protocol`            | Root constants, protocol/security event constants, message builders, validators, and origin helpers. |
| `@iteraai/inspector-protocol/types`      | Message envelope, payload, tree, props, and placeholder types.                                       |
| `@iteraai/inspector-protocol/errors`     | Protocol error codes and error construction helpers.                                                 |
| `@iteraai/inspector-protocol/validators` | `buildMessage`, `parseMessage`, and `isInspectorMessage`.                                            |
| `@iteraai/inspector-protocol/origins`    | Origin normalization and iframe target-origin helpers.                                               |

The root entrypoint also exports the current security event constants used by the React bridge runtime.

## Quick Start

```ts
import {
  buildMessage,
  parseMessage,
  type InspectorMessage,
} from "@iteraai/inspector-protocol";

const helloMessage: InspectorMessage<"HELLO"> = buildMessage(
  "HELLO",
  {
    capabilities: ["tree", "props", "highlight"],
    auth: {
      sessionToken: "signed-session-token",
      metadata: {
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      },
    },
  },
  {
    requestId: "request-1",
    sessionId: "session-1",
  },
);

const iframe = document.querySelector("iframe");

iframe?.contentWindow?.postMessage(
  helloMessage,
  "https://preview.customer-app.example",
);

window.addEventListener("message", (event) => {
  const parsed = parseMessage(event.data, {
    sourceOrigin: event.origin,
    trustedOrigins: ["https://preview.customer-app.example"],
  });

  if (!parsed.ok) {
    return;
  }

  if (parsed.message.type === "READY") {
    console.log("Inspector handshake complete.");
  }
});
```

`requestId` and `sessionId` are envelope fields, not payload fields. The embedded bridge echoes them back in responses so the host can correlate request/response pairs.

## Protocol Contract Snapshot

- `INSPECTOR_CHANNEL` is `itera-component-inspector`.
- `INSPECTOR_PROTOCOL_VERSION` is `1`.
- Serializable placeholders use the `__iteraType` discriminator.
- Host-to-embedded message types are `HELLO`, `REQUEST_TREE`, `REQUEST_NODE_PROPS`, `REQUEST_SNAPSHOT`, `HIGHLIGHT_NODE`, `CLEAR_HIGHLIGHT`, and `PING`.
- Embedded-to-host message types are `READY`, `TREE_SNAPSHOT`, `TREE_DELTA`, `NODE_PROPS`, `SNAPSHOT`, `NODE_SELECTED`, `PONG`, and `ERROR`.
- Pass `sourceOrigin` and `trustedOrigins` to `parseMessage` when you need exact trusted-origin validation for `postMessage`.
- The secure handshake shape lives in `HELLO.payload.auth`, including `auth.sessionToken` and optional `auth.metadata`.
- `serializablePlaceholderTypes`, `inspectorErrorCodes`, and the exported security event constants are part of the package's documented public surface.

For embedded bridge startup, framework-specific entrypoints, and host-origin troubleshooting, use the docs pages linked above.
