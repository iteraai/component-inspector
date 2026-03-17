import type { ReactInspectorRuntimeAdapterTarget } from '../base/types';
export { createFiberReactInspectorAdapter } from './fiberAdapter';

export const reactInspectorFiberAdapterTarget: ReactInspectorRuntimeAdapterTarget =
  'fiber';
