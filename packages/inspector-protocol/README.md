# `@iteraai/inspector-protocol`

Protocol constants, message builders, validators, origin helpers, and security event constants for the Itera component inspector SDK.

Use this package anywhere you need to speak the hosted editor protocol without pulling in the React runtime package: host/editor integrations, embedded message handlers, smoke fixtures, and protocol-aware tests.

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

## Current Protocol Contract

Protocol constants:

- `INSPECTOR_CHANNEL` is `itera-component-inspector`
- `INSPECTOR_PROTOCOL_VERSION` is `1`
- Serializable placeholders use the `__iteraType` discriminator

Host-to-embedded message types:

- `HELLO`
- `REQUEST_TREE`
- `REQUEST_NODE_PROPS`
- `REQUEST_SNAPSHOT`
- `HIGHLIGHT_NODE`
- `CLEAR_HIGHLIGHT`
- `PING`

Embedded-to-host message types:

- `READY`
- `TREE_SNAPSHOT`
- `TREE_DELTA`
- `NODE_PROPS`
- `SNAPSHOT`
- `NODE_SELECTED`
- `PONG`
- `ERROR`

The branded channel name and placeholder discriminator are part of the public protocol contract and should remain stable unless introduced as a breaking change.

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

## Origin Requirements

The protocol package does not decide which origins are trusted for your app, but it gives you the helpers needed to enforce that contract consistently.

- Pass `sourceOrigin` and `trustedOrigins` to `parseMessage` when validating inbound messages from `postMessage`.
- Trusted origins must match exact URL origins, including scheme and port.
- Use `normalizeOrigin` when you start from a full URL and need the origin only.
- Use `deriveTargetOriginFromIframeSrc` and `canHostSendToTargetOrigin` when the host needs to derive or verify the `postMessage` target origin for an iframe.

If origin validation fails, `parseMessage` returns `ERR_INVALID_ORIGIN`.

## Session Token Contract

The protocol shape for secure handshakes is carried in `HELLO.payload.auth`.

- `auth.sessionToken` is the required field used by secure embedded bridge integrations.
- The current embedded bridge expects that token to be a non-empty string.
- If `auth.metadata.expiresAt` is present and already expired, secure embedded bridges reject the handshake.
- `metadata` fields such as `tokenType`, `issuer`, `audience`, `issuedAt`, `expiresAt`, and `nonce` are part of the public protocol shape.

If you only need protocol parsing and message construction, this package does not enforce the token itself. Token validation happens in `@iteraai/react-component-inspector` when bridge security is enabled.

## Placeholder And Error Behavior

Customer-visible placeholder and error details are part of the protocol contract:

- `serializablePlaceholderTypes` includes `redacted`, `dom-node`, `date`, `error`, `map`, `set`, and other non-JSON-native value markers.
- `inspectorErrorCodes` includes origin, version, authorization, oversize-message, node-not-found, invalid-payload, and unknown-message-type failures.
- `INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED` and related root exports document the current security event naming contract used by the bridge runtime.
