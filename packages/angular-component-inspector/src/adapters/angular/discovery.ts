import type { AngularDevModeGlobalsApi } from './angularGlobals';

type MutableAngularDiscoveryRecord = {
  key: string;
  rootIndex: number;
  component: object;
  hostElement: Element;
  parentComponent: object | null;
  parentKey: string | null;
  childComponents: object[];
  childKeys: string[];
  displayName: string;
  hostTag: string;
  tags: string[];
  discoveryIndex: number;
};

export type AngularDiscoveryRecord = Readonly<MutableAngularDiscoveryRecord>;

export type AngularDiscoveryResult = Readonly<{
  records: AngularDiscoveryRecord[];
  rootRecordKeys: string[];
}>;

const ANGULAR_NODE_TAG = 'angular';

const isInspectableObject = (value: unknown): value is object => {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
};

const readObjectValue = (value: object, key: string) => {
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
};

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
};

const toPascalCaseFromHostTag = (hostTag: string) => {
  const segments = hostTag
    .split(/[^a-zA-Z0-9]+/u)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return undefined;
  }

  return segments
    .map((segment) => {
      return `${segment[0]?.toUpperCase() ?? ''}${segment.slice(1)}`;
    })
    .join('');
};

const resolveAngularDisplayName = (component: object, hostTag: string) => {
  const constructorValue = readObjectValue(component, 'constructor');
  const constructorDisplayName = isInspectableObject(constructorValue)
    ? toNonEmptyString(readObjectValue(constructorValue, 'displayName')) ??
      toNonEmptyString(readObjectValue(constructorValue, 'name'))
    : undefined;

  return (
    constructorDisplayName ?? toPascalCaseFromHostTag(hostTag) ?? 'Anonymous'
  );
};

const toAngularTags = (hostTag: string) => {
  return [
    ANGULAR_NODE_TAG,
    'angular-kind:component',
    `angular-host:${hostTag}`,
  ];
};

const resolveHostComponent = (
  angularGlobals: AngularDevModeGlobalsApi,
  element: Element,
) => {
  let component: object | null | undefined;

  try {
    component = angularGlobals.getComponent?.(element);
  } catch {
    component = undefined;
  }

  if (!isInspectableObject(component)) {
    return undefined;
  }

  let hostElement: Element | null | undefined;

  try {
    hostElement = angularGlobals.getHostElement?.(component);
  } catch {
    hostElement = undefined;
  }

  return hostElement === element ? component : undefined;
};

const resolveOwningComponent = (
  angularGlobals: AngularDevModeGlobalsApi,
  record: MutableAngularDiscoveryRecord,
) => {
  let owningComponentFromInstance: object | null | undefined;

  try {
    owningComponentFromInstance = angularGlobals.getOwningComponent?.(
      record.component,
    );
  } catch {
    owningComponentFromInstance = undefined;
  }

  if (owningComponentFromInstance !== undefined) {
    return owningComponentFromInstance === record.component ||
      !isInspectableObject(owningComponentFromInstance)
      ? null
      : owningComponentFromInstance;
  }

  let owningComponentFromHostElement: object | null | undefined;

  try {
    owningComponentFromHostElement = angularGlobals.getOwningComponent?.(
      record.hostElement,
    );
  } catch {
    owningComponentFromHostElement = undefined;
  }

  return owningComponentFromHostElement === record.component ||
    !isInspectableObject(owningComponentFromHostElement)
    ? null
    : owningComponentFromHostElement;
};

const appendChildComponent = (
  record: MutableAngularDiscoveryRecord,
  childComponent: object,
) => {
  if (!record.childComponents.includes(childComponent)) {
    record.childComponents.push(childComponent);
  }
};

const visitElementSubtree = (
  element: Element,
  visitor: (element: Element) => void,
) => {
  visitor(element);

  const shadowRoot =
    (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot ?? null;

  if (shadowRoot !== null) {
    Array.from(shadowRoot.children).forEach((childElement) => {
      visitElementSubtree(childElement, visitor);
    });
  }

  Array.from(element.children).forEach((childElement) => {
    visitElementSubtree(childElement, visitor);
  });
};

const visitDocumentElements = (
  documentRoot: Document,
  visitor: (element: Element) => void,
) => {
  if (documentRoot.documentElement === null) {
    return;
  }

  visitElementSubtree(documentRoot.documentElement, visitor);
};

const assignRecordKeys = (
  records: MutableAngularDiscoveryRecord[],
  recordByComponent: ReadonlyMap<object, MutableAngularDiscoveryRecord>,
) => {
  const visitedComponents = new Set<object>();
  const rootRecordKeys: string[] = [];
  let nextRootIndex = 0;

  const assignRecord = (
    record: MutableAngularDiscoveryRecord,
    parentKey: string | null,
    rootIndex: number,
    childIndex?: number,
  ) => {
    if (visitedComponents.has(record.component)) {
      return;
    }

    visitedComponents.add(record.component);
    record.rootIndex = rootIndex;
    record.parentKey = parentKey;
    record.key =
      parentKey === null ? `root:${rootIndex}` : `${parentKey}:child:${childIndex}`;
    record.childKeys = [];

    record.childComponents.forEach((childComponent, index) => {
      const childRecord = recordByComponent.get(childComponent);

      if (childRecord === undefined || visitedComponents.has(childRecord.component)) {
        return;
      }

      assignRecord(childRecord, record.key, rootIndex, index);
      record.childKeys.push(childRecord.key);
    });
  };

  const assignRootRecord = (record: MutableAngularDiscoveryRecord) => {
    if (visitedComponents.has(record.component)) {
      return;
    }

    const rootIndex = nextRootIndex;

    nextRootIndex += 1;
    rootRecordKeys.push(`root:${rootIndex}`);
    assignRecord(record, null, rootIndex);
  };

  records.forEach((record) => {
    if (record.parentComponent === null) {
      assignRootRecord(record);
    }
  });

  records.forEach((record) => {
    assignRootRecord(record);
  });

  return rootRecordKeys;
};

export const discoverAngularComponentTree = (options: {
  angularGlobals: AngularDevModeGlobalsApi;
  documentRoot?: Document | undefined;
}): AngularDiscoveryResult => {
  const documentRoot =
    options.documentRoot ?? (typeof document === 'undefined' ? undefined : document);

  if (documentRoot === undefined) {
    return {
      records: [],
      rootRecordKeys: [],
    };
  }

  const records: MutableAngularDiscoveryRecord[] = [];
  const recordByComponent = new Map<object, MutableAngularDiscoveryRecord>();

  visitDocumentElements(documentRoot, (element) => {
    const component = resolveHostComponent(options.angularGlobals, element);

    if (component === undefined || recordByComponent.has(component)) {
      return;
    }

    const hostTag = element.tagName.toLowerCase();
    const record: MutableAngularDiscoveryRecord = {
      key: '',
      rootIndex: -1,
      component,
      hostElement: element,
      parentComponent: null,
      parentKey: null,
      childComponents: [],
      childKeys: [],
      displayName: resolveAngularDisplayName(component, hostTag),
      hostTag,
      tags: toAngularTags(hostTag),
      discoveryIndex: records.length,
    };

    records.push(record);
    recordByComponent.set(component, record);
  });

  records.forEach((record) => {
    const owningComponent = resolveOwningComponent(options.angularGlobals, record);

    if (owningComponent === null) {
      record.parentComponent = null;
      return;
    }

    const parentRecord = recordByComponent.get(owningComponent);

    if (parentRecord === undefined) {
      record.parentComponent = null;
      return;
    }

    record.parentComponent = parentRecord.component;
    appendChildComponent(parentRecord, record.component);
  });

  return {
    records,
    rootRecordKeys: assignRecordKeys(records, recordByComponent),
  };
};
