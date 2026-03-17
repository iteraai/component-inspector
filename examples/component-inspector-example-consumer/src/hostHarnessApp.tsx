import { parseMessage } from '@iteraai/inspector-protocol';
import { useEffect, useRef, useState } from 'react';
import {
  buildClearHoverMessage,
  buildEnterSelectModeMessage,
  buildHelloMessage,
  buildNodePropsRequestMessage,
  buildTreeRequestMessage,
  defaultEmbeddedUrl,
  isExampleIterationRuntimeMessage,
  isPreviewPathUpdatedMessage,
  prettyJson,
  publishButtonNodeId,
} from './hostHarnessMessages';

type LogEntry = {
  id: string;
  direction: 'outbound' | 'inbound';
  label: string;
  payload: unknown;
};

const resolveOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const HostHarnessApp = () => {
  const params = new URLSearchParams(window.location.search);
  const initialEmbeddedUrl = params.get('embeddedUrl') ?? defaultEmbeddedUrl;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const requestCounterRef = useRef(0);
  const logCounterRef = useRef(0);

  const [draftEmbeddedUrl, setDraftEmbeddedUrl] = useState(initialEmbeddedUrl);
  const [embeddedUrl, setEmbeddedUrl] = useState(initialEmbeddedUrl);
  const [connectionState, setConnectionState] = useState('idle');
  const [previewPath, setPreviewPath] = useState<string>('waiting for READY');
  const [treePayload, setTreePayload] = useState<string>('No tree received yet.');
  const [nodePropsPayload, setNodePropsPayload] = useState<string>(
    'No node props requested yet.',
  );
  const [selectionSummary, setSelectionSummary] = useState<string>(
    'No selection message received yet.',
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const appendLog = (
    direction: LogEntry['direction'],
    label: string,
    payload: unknown,
  ) => {
    const logId = `${Date.now()}-${logCounterRef.current}`;

    logCounterRef.current += 1;

    setLogs((currentLogs) => {
      return [
        {
          id: logId,
          direction,
          label,
          payload,
        },
        ...currentLogs,
      ].slice(0, 20);
    });
  };

  const nextRequestId = () => {
    requestCounterRef.current += 1;

    return `example-request-${requestCounterRef.current}`;
  };

  const postToEmbedded = (message: unknown, label: string) => {
    const contentWindow = iframeRef.current?.contentWindow;

    if (contentWindow === null || contentWindow === undefined) {
      setConnectionState('waiting for iframe');
      return;
    }

    contentWindow.postMessage(message, resolveOrigin(embeddedUrl) ?? '*');
    appendLog('outbound', label, message);
  };

  const sendHello = () => {
    setConnectionState('connecting');
    postToEmbedded(buildHelloMessage(nextRequestId()), 'HELLO');
  };

  const requestTree = () => {
    postToEmbedded(buildTreeRequestMessage(nextRequestId()), 'REQUEST_TREE');
  };

  const requestPublishButtonProps = () => {
    postToEmbedded(
      buildNodePropsRequestMessage(publishButtonNodeId, nextRequestId()),
      'REQUEST_NODE_PROPS',
    );
  };

  const enterSelectMode = () => {
    postToEmbedded(buildEnterSelectModeMessage(), 'enter_select_mode');
  };

  const clearHover = () => {
    postToEmbedded(buildClearHoverMessage(), 'clear_hover');
  };

  useEffect(() => {
    setConnectionState('idle');
    setPreviewPath('waiting for READY');
    setTreePayload('No tree received yet.');
    setNodePropsPayload('No node props requested yet.');
    setSelectionSummary('No selection message received yet.');
  }, [embeddedUrl]);

  useEffect(() => {
    const expectedOrigin = resolveOrigin(embeddedUrl);

    const onMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;

      if (iframeWindow === null || iframeWindow === undefined) {
        return;
      }

      if (event.source !== iframeWindow) {
        return;
      }

      if (expectedOrigin !== null && event.origin !== expectedOrigin) {
        return;
      }

      if (isPreviewPathUpdatedMessage(event.data)) {
        appendLog('inbound', 'PATH_UPDATED', event.data);
        setPreviewPath(event.data.path);
        return;
      }

      if (isExampleIterationRuntimeMessage(event.data)) {
        appendLog('inbound', event.data.kind, event.data);

        if (event.data.kind === 'element_selected') {
          setSelectionSummary(event.data.selection.displayText);
        }

        return;
      }

      const parsedMessage = parseMessage(event.data);

      if (!parsedMessage.ok) {
        return;
      }

      appendLog('inbound', parsedMessage.message.type, parsedMessage.message);

      switch (parsedMessage.message.type) {
        case 'READY': {
          setConnectionState('connected');
          requestTree();
          requestPublishButtonProps();
          return;
        }
        case 'TREE_SNAPSHOT': {
          setTreePayload(prettyJson(parsedMessage.message.payload));
          return;
        }
        case 'NODE_PROPS': {
          setNodePropsPayload(prettyJson(parsedMessage.message.payload));
          return;
        }
        case 'HELLO':
        case 'REQUEST_TREE':
        case 'REQUEST_NODE_PROPS':
        case 'REQUEST_SNAPSHOT':
        case 'HIGHLIGHT_NODE':
        case 'CLEAR_HIGHLIGHT':
        case 'PING':
        case 'TREE_DELTA':
        case 'NODE_SELECTED':
        case 'PONG':
        case 'ERROR':
        case 'SNAPSHOT':
        default: {
          return;
        }
      }
    };

    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [embeddedUrl]);

  return (
    <div className='example-page example-page--host'>
      <div className='example-shell example-shell--wide'>
        <header className='example-card example-toolbar'>
          <div className='example-toolbar__copy'>
            <p className='example-eyebrow'>Host Harness</p>
            <h1>Editor-side Example Consumer</h1>
            <p className='example-copy'>
              This page behaves like the hosted editor: it embeds the customer
              iframe, performs the `HELLO` handshake, and requests tree, props,
              and iteration selection messages.
            </p>
          </div>

          <label className='example-field'>
            <span>Embedded URL</span>
            <input
              aria-label='Embedded URL'
              className='example-input'
              onChange={(event) => setDraftEmbeddedUrl(event.target.value)}
              value={draftEmbeddedUrl}
            />
          </label>

          <div className='example-button-row'>
            <button
              type='button'
              className='example-button'
              onClick={() => setEmbeddedUrl(draftEmbeddedUrl)}
            >
              Apply iframe URL
            </button>
            <button
              type='button'
              className='example-button'
              onClick={sendHello}
            >
              Connect
            </button>
            <button
              type='button'
              className='example-button'
              onClick={requestTree}
            >
              Request tree
            </button>
            <button
              type='button'
              className='example-button'
              onClick={requestPublishButtonProps}
            >
              Request button props
            </button>
            <button
              type='button'
              className='example-button'
              onClick={enterSelectMode}
            >
              Enter select mode
            </button>
            <button
              type='button'
              className='example-button'
              onClick={clearHover}
            >
              Clear hover
            </button>
          </div>
        </header>

        <section className='example-status-grid'>
          <article className='example-card example-status-card'>
            <p className='example-section-label'>Connection</p>
            <strong>{connectionState}</strong>
          </article>
          <article className='example-card example-status-card'>
            <p className='example-section-label'>Preview path</p>
            <strong>{previewPath}</strong>
          </article>
          <article className='example-card example-status-card'>
            <p className='example-section-label'>Iteration selection</p>
            <strong>{selectionSummary}</strong>
          </article>
        </section>

        <section className='example-two-column'>
          <div className='example-card example-frame-card'>
            <p className='example-section-label'>Embedded fixture</p>
            <iframe
              ref={iframeRef}
              className='example-frame'
              onLoad={sendHello}
              src={embeddedUrl}
              title='Component inspector embedded example'
            />
          </div>

          <div className='example-column'>
            <article className='example-card example-code-card'>
              <p className='example-section-label'>TREE_SNAPSHOT payload</p>
              <pre>{treePayload}</pre>
            </article>
            <article className='example-card example-code-card'>
              <p className='example-section-label'>NODE_PROPS payload</p>
              <pre>{nodePropsPayload}</pre>
            </article>
          </div>
        </section>

        <section className='example-card example-code-card'>
          <p className='example-section-label'>Recent message log</p>
          <div className='example-log-list'>
            {logs.map((log) => (
              <article key={log.id} className='example-log-entry'>
                <div className='example-log-entry__header'>
                  <span>{log.direction}</span>
                  <strong>{log.label}</strong>
                </div>
                <pre>{prettyJson(log.payload)}</pre>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
