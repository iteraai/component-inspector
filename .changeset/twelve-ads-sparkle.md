---
'@iteraai/react-component-inspector': patch
---

Require an authorized `HELLO` before secure bridge sessions handle inspector commands, bind secure sessions to the authorized sender and session ID, and fail closed when `HELLO` payloads omit auth details.
