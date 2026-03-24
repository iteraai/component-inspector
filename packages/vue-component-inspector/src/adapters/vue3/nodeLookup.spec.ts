import type { InspectorTreeSnapshot } from '../base/types';
import { createVueNodeLookup } from './nodeLookup';
import type { VueTraversalResult } from './traversal';

const createTraversalRecord = (
  key: string,
  options: {
    instance?: unknown;
    displayName: string;
    rootIndex?: number;
    parentKey?: string | null;
    childKeys?: string[];
  },
): VueTraversalResult['records'][number] => {
  return {
    key,
    appRecord: {
      app: {} as never,
      container: document.createElement('div'),
      source: 'explicit',
    },
    rootIndex: options.rootIndex ?? 0,
    instance: options.instance ?? {},
    parentKey: options.parentKey ?? null,
    childKeys: options.childKeys ?? [],
    displayName: options.displayName,
    tags: ['vue', 'vue-kind:component'],
  };
};

const createSnapshot = (nodeIds: readonly string[]): InspectorTreeSnapshot => {
  const [rootNodeId, childNodeId] = nodeIds;

  return {
    nodes: [
      {
        id: rootNodeId ?? 'root-node',
        displayName: 'RootNode',
        parentId: null,
        childrenIds: childNodeId === undefined ? [] : [childNodeId],
      },
      ...(childNodeId === undefined
        ? []
        : [
            {
              id: childNodeId,
              displayName: 'LeafNode',
              parentId: rootNodeId ?? 'root-node',
              childrenIds: [],
            },
          ]),
    ],
    rootIds: [rootNodeId ?? 'root-node'],
  };
};

describe('nodeLookup', () => {
  test('resolves the current node payloads from a refreshed snapshot', () => {
    const lookup = createVueNodeLookup();
    const traversalResult: VueTraversalResult = {
      records: [
        createTraversalRecord('root', {
          displayName: 'RootNode',
          childKeys: ['leaf', 'missing'],
        }),
        createTraversalRecord('leaf', {
          displayName: 'LeafNode',
          parentKey: 'root',
        }),
      ],
      rootRecordKeys: ['root'],
    };
    const nodeIdByRecordKey = new Map([
      ['root', 'node-root'],
      ['leaf', 'node-leaf'],
    ]);
    const snapshot = createSnapshot(['node-root', 'node-leaf']);

    lookup.refreshFromSnapshot({
      traversalResult,
      nodeIdByRecordKey,
      snapshot,
    });

    expect(lookup.resolveByNodeId('node-root')).toEqual({
      nodeId: 'node-root',
      recordKey: 'root',
      appRecord: traversalResult.records[0].appRecord,
      rootIndex: 0,
      instance: traversalResult.records[0].instance,
      displayName: 'RootNode',
      parentNodeId: null,
      childNodeIds: ['node-leaf'],
    });
    expect(lookup.resolveByNodeId('missing-node')).toBeUndefined();
  });

  test('drops stale node ids after a subsequent refresh', () => {
    const lookup = createVueNodeLookup();
    const firstTraversalResult: VueTraversalResult = {
      records: [
        createTraversalRecord('root', {
          displayName: 'RootNode',
          childKeys: ['leaf'],
        }),
        createTraversalRecord('leaf', {
          displayName: 'LeafNode',
          parentKey: 'root',
        }),
      ],
      rootRecordKeys: ['root'],
    };

    lookup.refreshFromSnapshot({
      traversalResult: firstTraversalResult,
      nodeIdByRecordKey: new Map([
        ['root', 'node-root'],
        ['leaf', 'node-leaf'],
      ]),
      snapshot: createSnapshot(['node-root', 'node-leaf']),
    });

    const secondTraversalResult: VueTraversalResult = {
      records: [
        createTraversalRecord('root', {
          displayName: 'RootNode',
        }),
      ],
      rootRecordKeys: ['root'],
    };

    lookup.refreshFromSnapshot({
      traversalResult: secondTraversalResult,
      nodeIdByRecordKey: new Map([['root', 'node-root-v2']]),
      snapshot: createSnapshot(['node-root-v2']),
    });

    expect(lookup.resolveByNodeId('node-leaf')).toBeUndefined();
    expect(lookup.resolveByNodeId('node-root-v2')).toMatchObject({
      nodeId: 'node-root-v2',
      recordKey: 'root',
    });
  });

  test('resolves the nearest component path from Vue DOM markers', () => {
    const lookup = createVueNodeLookup();
    const rootElement = document.createElement('section');
    const leafElement = document.createElement('button');
    const selectionElement = document.createElement('span');
    const rootInstance = {
      parent: null,
      subTree: {
        el: rootElement,
      },
    };
    const leafInstance = {
      parent: rootInstance,
      subTree: {
        el: leafElement,
      },
    };
    const traversalResult: VueTraversalResult = {
      records: [
        createTraversalRecord('root', {
          displayName: 'RootNode',
          childKeys: ['leaf'],
          instance: rootInstance,
        }),
        createTraversalRecord('leaf', {
          displayName: 'LeafNode',
          parentKey: 'root',
          instance: leafInstance,
        }),
      ],
      rootRecordKeys: ['root'],
    };

    leafElement.append(selectionElement);
    rootElement.append(leafElement);
    Object.defineProperty(selectionElement, '__vueParentComponent', {
      configurable: true,
      value: leafInstance,
    });

    lookup.refreshFromSnapshot({
      traversalResult,
      nodeIdByRecordKey: new Map([
        ['root', 'node-root'],
        ['leaf', 'node-leaf'],
      ]),
      snapshot: createSnapshot(['node-root', 'node-leaf']),
    });

    expect(lookup.resolveClosestComponentPathForElement(selectionElement)).toEqual(
      ['RootNode', 'LeafNode'],
    );
  });

  test('falls back to known component root elements when Vue DOM markers are absent', () => {
    const lookup = createVueNodeLookup();
    const rootElement = document.createElement('section');
    const leafElement = document.createElement('button');
    const selectionElement = document.createElement('span');
    const unmatchedElement = document.createElement('div');
    const rootInstance = {
      parent: null,
      subTree: {
        el: rootElement,
      },
    };
    const leafInstance = {
      parent: rootInstance,
      subTree: {
        el: leafElement,
      },
    };
    const traversalResult: VueTraversalResult = {
      records: [
        createTraversalRecord('root', {
          displayName: 'RootNode',
          childKeys: ['leaf'],
          instance: rootInstance,
        }),
        createTraversalRecord('leaf', {
          displayName: 'LeafNode',
          parentKey: 'root',
          instance: leafInstance,
        }),
      ],
      rootRecordKeys: ['root'],
    };

    leafElement.append(selectionElement);
    rootElement.append(leafElement);

    lookup.refreshFromSnapshot({
      traversalResult,
      nodeIdByRecordKey: new Map([
        ['root', 'node-root'],
        ['leaf', 'node-leaf'],
      ]),
      snapshot: createSnapshot(['node-root', 'node-leaf']),
    });

    expect(lookup.resolveClosestComponentPathForElement(selectionElement)).toEqual(
      ['RootNode', 'LeafNode'],
    );
    expect(lookup.resolveClosestComponentPathForElement(unmatchedElement)).toBeUndefined();
  });
});
