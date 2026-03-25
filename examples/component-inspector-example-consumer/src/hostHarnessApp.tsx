import { parseMessage } from '@iteraai/inspector-protocol';
import type {
  ChangeEvent,
} from 'react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  buildClearPreviewEditsMessage,
  buildClearHoverMessage,
  buildEnterSelectModeMessage,
  buildHelloMessage,
  buildNodePropsRequestMessage,
  buildSyncPreviewEditsMessage,
  buildTreeRequestMessage,
  defaultEmbeddedUrl,
  defaultReactEmbeddedUrl,
  defaultVueEmbeddedUrl,
  isExampleIterationRuntimeMessage,
  isPreviewEditsStatusMessage,
  isPreviewPathUpdatedMessage,
  prettyJson,
  publishButtonDisplayName,
} from './hostHarnessMessages';
import type {
  IterationElementSelection,
  IterationPreviewEditOperation,
} from '@iteraai/react-component-inspector/iterationInspector';

type LogEntry = {
  id: string;
  direction: 'outbound' | 'inbound';
  label: string;
  payload: unknown;
};

type PreviewEditDraft = {
  textContent: string;
  backgroundColor: string;
  textColor: string;
  padding: string;
  borderRadius: string;
  assetReference: string;
};

const createEmptyPreviewEditDraft = (): PreviewEditDraft => ({
  textContent: '',
  backgroundColor: '',
  textColor: '',
  padding: '',
  borderRadius: '',
  assetReference: '',
});

const toPreviewEditOperations = (
  draft: PreviewEditDraft,
): ReadonlyArray<IterationPreviewEditOperation> => {
  const operations: IterationPreviewEditOperation[] = [];

  if (draft.textContent.trim().length > 0) {
    operations.push({
      fieldId: 'textContent',
      value: draft.textContent,
    });
  }

  if (draft.backgroundColor.trim().length > 0) {
    operations.push({
      fieldId: 'backgroundColor',
      value: draft.backgroundColor,
    });
  }

  if (draft.textColor.trim().length > 0) {
    operations.push({
      fieldId: 'textColor',
      value: draft.textColor,
    });
  }

  if (draft.padding.trim().length > 0) {
    operations.push({
      fieldId: 'padding',
      value: draft.padding,
    });
  }

  if (draft.borderRadius.trim().length > 0) {
    operations.push({
      fieldId: 'borderRadius',
      value: draft.borderRadius,
    });
  }

  if (draft.assetReference.trim().length > 0) {
    operations.push({
      fieldId: 'assetReference',
      value: draft.assetReference,
      valueType: 'asset_reference',
    });
  }

  return operations;
};

const resolveOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const resolveFixtureNodeId = (payload: unknown, displayName: string) => {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('nodes' in payload) ||
    !Array.isArray(payload.nodes)
  ) {
    return null;
  }

  const matchingNode = payload.nodes.find((node) => {
    return (
      typeof node === 'object' &&
      node !== null &&
      'displayName' in node &&
      'id' in node &&
      node.displayName === displayName &&
      typeof node.id === 'string'
    );
  });

  return matchingNode?.id ?? null;
};

export const HostHarnessApp = () => {
  const params = new URLSearchParams(window.location.search);
  const initialEmbeddedUrl = params.get('embeddedUrl') ?? defaultEmbeddedUrl;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const requestCounterRef = useRef(0);
  const logCounterRef = useRef(0);
  const previewRevisionRef = useRef(0);

  const [draftEmbeddedUrl, setDraftEmbeddedUrl] = useState(initialEmbeddedUrl);
  const [embeddedUrl, setEmbeddedUrl] = useState(initialEmbeddedUrl);
  const [connectionState, setConnectionState] = useState('idle');
  const [previewPath, setPreviewPath] = useState<string>('waiting for READY');
  const [treePayload, setTreePayload] = useState<string>('No tree received yet.');
  const [nodePropsPayload, setNodePropsPayload] = useState<string>(
    'No node props requested yet.',
  );
  const [publishButtonNodeId, setPublishButtonNodeId] = useState<string | null>(
    null,
  );
  const [selectionSummary, setSelectionSummary] = useState<string>(
    'No selection message received yet.',
  );
  const [selectedElement, setSelectedElement] =
    useState<IterationElementSelection | null>(null);
  const [previewCapabilityState, setPreviewCapabilityState] = useState(
    'waiting for runtime_ready',
  );
  const [previewStatusSummary, setPreviewStatusSummary] = useState(
    'No preview edits applied yet.',
  );
  const [previewStatusPayload, setPreviewStatusPayload] = useState<string>(
    'No preview edit status received yet.',
  );
  const [previewEditDraft, setPreviewEditDraft] = useState<PreviewEditDraft>(
    createEmptyPreviewEditDraft,
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
    if (publishButtonNodeId === null) {
      setNodePropsPayload(
        'PublishButton node id is unknown for the current fixture. Request the tree first.',
      );
      requestTree();
      return;
    }

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

  const syncPreviewEdits = (draft: PreviewEditDraft) => {
    if (selectedElement === null) {
      setPreviewStatusSummary('Select an element before applying preview edits.');
      return;
    }

    previewRevisionRef.current += 1;
    const revision = previewRevisionRef.current;
    const operations = toPreviewEditOperations(draft);

    if (operations.length === 0) {
      postToEmbedded(
        buildClearPreviewEditsMessage(revision),
        'clear_preview_edits',
      );
      setPreviewStatusSummary(`Clearing preview edits (revision ${revision}).`);
      setPreviewStatusPayload(
        prettyJson({
          revision,
          action: 'clear_preview_edits',
        }),
      );
      return;
    }

    const targets = [
      {
        locator: selectedElement.element,
        operations,
      },
    ] as const;

    postToEmbedded(
      buildSyncPreviewEditsMessage(revision, targets),
      'sync_preview_edits',
    );
    setPreviewStatusSummary(
      `Applying ${operations.length} preview edit(s) to ${selectedElement.displayText}.`,
    );
    setPreviewStatusPayload(
      prettyJson({
        revision,
        targets,
      }),
    );
  };

  const handlePreviewEditFieldChange = (
    field: keyof PreviewEditDraft,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextValue = event.currentTarget.value;

    setPreviewEditDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        [field]: nextValue,
      };

      syncPreviewEdits(nextDraft);
      return nextDraft;
    });
  };

  const handleClearPreviewEdits = () => {
    const nextDraft = createEmptyPreviewEditDraft();

    setPreviewEditDraft(nextDraft);
    syncPreviewEdits(nextDraft);
  };

  useEffect(() => {
    setConnectionState('idle');
    setPreviewPath('waiting for READY');
    setTreePayload('No tree received yet.');
    setNodePropsPayload('No node props requested yet.');
    setPublishButtonNodeId(null);
    setSelectionSummary('No selection message received yet.');
    setSelectedElement(null);
    setPreviewCapabilityState('waiting for runtime_ready');
    setPreviewStatusSummary('No preview edits applied yet.');
    setPreviewStatusPayload('No preview edit status received yet.');
    setPreviewEditDraft(createEmptyPreviewEditDraft());
    previewRevisionRef.current = 0;
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

        if (event.data.kind === 'runtime_ready') {
          setPreviewCapabilityState(
            event.data.capabilities?.includes('preview_edits_v1')
              ? 'preview_edits_v1 available'
              : 'preview edits unavailable',
          );
        }

        if (event.data.kind === 'element_selected') {
          setSelectedElement(event.data.selection);
        }

        if (
          event.data.kind === 'element_selected' &&
          event.data.selection?.displayText !== undefined
        ) {
          setSelectionSummary(event.data.selection.displayText);
        }

        if (isPreviewEditsStatusMessage(event.data)) {
          setPreviewStatusSummary(
            event.data.errors === undefined || event.data.errors.length === 0
              ? `Applied ${event.data.appliedTargetCount} target(s) at revision ${event.data.revision}.`
              : `Applied ${event.data.appliedTargetCount} target(s) with ${event.data.errors.length} error(s).`,
          );
          setPreviewStatusPayload(prettyJson(event.data));
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
          return;
        }
        case 'TREE_SNAPSHOT': {
          const nextPublishButtonNodeId = resolveFixtureNodeId(
            parsedMessage.message.payload,
            publishButtonDisplayName,
          );

          setPublishButtonNodeId(nextPublishButtonNodeId);
          setTreePayload(prettyJson(parsedMessage.message.payload));

          if (nextPublishButtonNodeId === null) {
            setNodePropsPayload(
              `${publishButtonDisplayName} was not found in the current tree snapshot.`,
            );
            return;
          }

          postToEmbedded(
            buildNodePropsRequestMessage(
              nextPublishButtonNodeId,
              nextRequestId(),
            ),
            'REQUEST_NODE_PROPS',
          );
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
              onClick={() => {
                setDraftEmbeddedUrl(defaultReactEmbeddedUrl);
                setEmbeddedUrl(defaultReactEmbeddedUrl);
              }}
            >
              Use React fixture
            </button>
            <button
              type='button'
              className='example-button'
              onClick={() => {
                setDraftEmbeddedUrl(defaultVueEmbeddedUrl);
                setEmbeddedUrl(defaultVueEmbeddedUrl);
              }}
            >
              Use Vue fixture
            </button>
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
          <article className='example-card example-status-card'>
            <p className='example-section-label'>Preview edits</p>
            <strong>{previewCapabilityState}</strong>
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
              <p className='example-section-label'>Visual edit debugger</p>
              <div className='example-edit-grid'>
                <article className='example-edit-section'>
                  <p className='example-section-label'>Content</p>
                  <label className='example-field'>
                    <span>Text content</span>
                    <input
                      className='example-input'
                      onChange={(event) =>
                        handlePreviewEditFieldChange('textContent', event)
                      }
                      placeholder='Ship faster'
                      value={previewEditDraft.textContent}
                    />
                  </label>
                </article>

                <article className='example-edit-section'>
                  <p className='example-section-label'>Colors</p>
                  <div className='example-edit-section-grid'>
                    <label className='example-field'>
                      <span>Background color</span>
                      <input
                        className='example-input'
                        onChange={(event) =>
                          handlePreviewEditFieldChange('backgroundColor', event)
                        }
                        placeholder='#1f5eff'
                        value={previewEditDraft.backgroundColor}
                      />
                    </label>
                    <label className='example-field'>
                      <span>Text color</span>
                      <input
                        className='example-input'
                        onChange={(event) =>
                          handlePreviewEditFieldChange('textColor', event)
                        }
                        placeholder='#ffffff'
                        value={previewEditDraft.textColor}
                      />
                    </label>
                  </div>
                </article>

                <article className='example-edit-section'>
                  <p className='example-section-label'>Spacing</p>
                  <label className='example-field'>
                    <span>Padding</span>
                    <input
                      className='example-input'
                      onChange={(event) =>
                        handlePreviewEditFieldChange('padding', event)
                      }
                      placeholder='12px 18px'
                      value={previewEditDraft.padding}
                    />
                  </label>
                </article>

                <article className='example-edit-section'>
                  <p className='example-section-label'>Assets</p>
                  <label className='example-field'>
                    <span>Asset URL</span>
                    <input
                      className='example-input'
                      onChange={(event) =>
                        handlePreviewEditFieldChange('assetReference', event)
                      }
                      placeholder='https://example.com/replacement.png'
                      value={previewEditDraft.assetReference}
                    />
                  </label>
                </article>

                <article className='example-edit-section'>
                  <p className='example-section-label'>Effects</p>
                  <label className='example-field'>
                    <span>Border radius</span>
                    <input
                      className='example-input'
                      onChange={(event) =>
                        handlePreviewEditFieldChange('borderRadius', event)
                      }
                      placeholder='20px'
                      value={previewEditDraft.borderRadius}
                    />
                  </label>
                </article>

                <div className='example-button-row'>
                  <button
                    type='button'
                    className='example-button'
                    onClick={() => syncPreviewEdits(previewEditDraft)}
                  >
                    Resend preview edits
                  </button>
                  <button
                    type='button'
                    className='example-button example-button--secondary'
                    onClick={handleClearPreviewEdits}
                  >
                    Clear preview edits
                  </button>
                </div>
              </div>
              <p className='example-edit-status'>{previewStatusSummary}</p>
              <pre>{previewStatusPayload}</pre>
            </article>
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
