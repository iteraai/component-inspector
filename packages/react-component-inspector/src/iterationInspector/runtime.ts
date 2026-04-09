import {
  bootIterationInspectorRuntime as bootSharedIterationInspectorRuntime,
  buildIterationElementSelection as buildSharedIterationElementSelection,
  createIterationInspectorRuntime as createSharedIterationInspectorRuntime,
} from '../../../inspector-runtime-core/src/iterationInspector/runtime';
import type { IterationElementSelection } from './types';

type CreateIterationInspectorRuntimeArgs = {
  allowSelfMessaging?: boolean;
  win?: Window;
  doc?: Document;
};

type BootIterationInspectorRuntimeArgs = Omit<
  CreateIterationInspectorRuntimeArgs,
  'win' | 'doc'
>;

export type IterationInspectorRuntime = {
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
};

declare global {
  interface Window {
    __ITERA_ITERATION_INSPECTOR_RUNTIME__?: IterationInspectorRuntime;
    __ITERA_EMBEDDED_INSPECTOR_SELECTION__?: {
      getComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
      getReactComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
    };
    __ITERA_EMBEDDED_REACT_INSPECTOR_SELECTION__?: {
      getComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
      getReactComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
    };
    __ARA_EMBEDDED_INSPECTOR_SELECTION__?: {
      getComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
      getReactComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
    };
    __ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__?: {
      getComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
      getReactComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
    };
  }
}

export const buildIterationElementSelection = (
  element: Element,
  win: Window = window,
  doc: Document = document,
): IterationElementSelection => {
  return buildSharedIterationElementSelection(element, win, doc);
};

export const createIterationInspectorRuntime = (
  args: CreateIterationInspectorRuntimeArgs = {},
): IterationInspectorRuntime => {
  return createSharedIterationInspectorRuntime(args);
};

export const bootIterationInspectorRuntime = (
  args: BootIterationInspectorRuntimeArgs = {},
): IterationInspectorRuntime | null => {
  return bootSharedIterationInspectorRuntime(args);
};
