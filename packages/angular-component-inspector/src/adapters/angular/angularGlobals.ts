import type { AngularInspectorAdapterContract } from '../base/types';
import { createAngularDevModeGlobalsAdapter } from './angularAdapter';

export type AngularDevModeGlobalsApi = {
  getComponent?: (target: Element) => object | null | undefined;
  getOwningComponent?: (
    target: Element | object,
  ) => object | null | undefined;
  getRootComponents?: (target?: Element) => readonly object[] | undefined;
  getHostElement?: (target: object) => Element | null | undefined;
  getDirectiveMetadata?: (
    target: object,
  ) => Record<string, unknown> | null | undefined;
};

type WindowWithAngularGlobals = Window & {
  ng?: AngularDevModeGlobalsApi;
};

export const angularInspectorRequiredDevModeGlobalNames = [
  'getComponent',
  'getOwningComponent',
  'getHostElement',
  'getDirectiveMetadata',
] as const;

export const resolveAngularDevModeGlobals = (
  win: Window | undefined =
    typeof window === 'undefined' ? undefined : window,
): AngularDevModeGlobalsApi | null => {
  if (win === undefined) {
    return null;
  }

  const angularGlobals = (win as WindowWithAngularGlobals).ng;

  return angularGlobals === undefined ? null : angularGlobals;
};

export const hasRequiredAngularDevModeGlobals = (
  angularGlobals: AngularDevModeGlobalsApi | null | undefined,
): angularGlobals is AngularDevModeGlobalsApi => {
  if (angularGlobals === null || angularGlobals === undefined) {
    return false;
  }

  return angularInspectorRequiredDevModeGlobalNames.every((propertyName) => {
    return typeof angularGlobals[propertyName] === 'function';
  });
};

export const createAngularDevModeGlobalsInspectorAdapter = (options: {
  angularGlobals: AngularDevModeGlobalsApi | null;
}): AngularInspectorAdapterContract => {
  if (hasRequiredAngularDevModeGlobals(options.angularGlobals)) {
    return {
      adapterTarget: 'angular-dev-mode-globals',
      isAngularDevModeGlobalsAvailable: true,
      ...createAngularDevModeGlobalsAdapter({
        angularGlobals: options.angularGlobals,
      }),
    };
  }

  return {
    adapterTarget: 'angular-dev-mode-globals',
    isAngularDevModeGlobalsAvailable: false,
    getTreeSnapshot: () => ({
      nodes: [],
      rootIds: [],
    }),
    getNodeProps: () => undefined,
    getDomElement: () => null,
  };
};
