# `@iteraai/inspector-protocol`

Protocol primitives for the Itera component inspector SDK.

## Installation

```bash
npm install @iteraai/inspector-protocol
```

## Usage

```ts
import { buildMessage, parseMessage } from '@iteraai/inspector-protocol';

const message = buildMessage('PING', { sentAt: Date.now() });
const parsed = parseMessage(message);
```

Subpath exports:

- `@iteraai/inspector-protocol/types`
- `@iteraai/inspector-protocol/errors`
- `@iteraai/inspector-protocol/validators`
- `@iteraai/inspector-protocol/origins`
