import type { AngularDevModeGlobalsApi } from './angularGlobals';
import type { AngularNodeLookupPayload } from './nodeLookup';

const toElement = (value: unknown): Element | undefined => {
  if (typeof Element === 'undefined' || !(value instanceof Element)) {
    return undefined;
  }

  return value;
};

export const resolveAngularHighlightTarget = (options: {
  lookupPayload: AngularNodeLookupPayload;
  angularGlobals: AngularDevModeGlobalsApi;
}): Element | null => {
  let resolvedHostElement: Element | null | undefined;

  try {
    resolvedHostElement = options.angularGlobals.getHostElement?.(
      options.lookupPayload.component,
    );
  } catch {
    resolvedHostElement = undefined;
  }

  return (
    toElement(resolvedHostElement) ??
    toElement(options.lookupPayload.hostElement) ??
    null
  );
};
