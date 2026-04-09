import type { AngularDevModeGlobalsApi } from '../angular';
import { createAngularInspectorAdapter } from './createAngularInspectorAdapter';
import { resolveAngularInspectorRuntimeConfig } from './runtimeConfig';

type WindowWithAngularGlobals = Window & {
  ng?: AngularDevModeGlobalsApi;
};

const windowWithAngularGlobals = window as WindowWithAngularGlobals;

const createAngularGlobalsDouble = (): AngularDevModeGlobalsApi => {
  return {
    getComponent: vi.fn(),
    getOwningComponent: vi.fn(),
    getHostElement: vi.fn(),
    getDirectiveMetadata: vi.fn(),
  };
};

afterEach(() => {
  delete windowWithAngularGlobals.ng;
});

test('runtime config resolves window.ng when no explicit globals override is provided', () => {
  const angularGlobals = createAngularGlobalsDouble();

  windowWithAngularGlobals.ng = angularGlobals;

  expect(resolveAngularInspectorRuntimeConfig().angularGlobals).toBe(
    angularGlobals,
  );
});

test('auto runtime config falls back to the noop adapter when Angular dev-mode globals are unavailable', () => {
  const adapter = createAngularInspectorAdapter();

  expect(adapter.adapterTarget).toBe('noop');
  expect(adapter.isAngularDevModeGlobalsAvailable).toBe(false);
  expect(adapter.getTreeSnapshot()).toEqual({
    nodes: [],
    rootIds: [],
  });
});

test('explicit angular dev-mode adapter stays safe when the debug global surface is incomplete', () => {
  windowWithAngularGlobals.ng = {
    getComponent: vi.fn(),
  };

  const adapter = createAngularInspectorAdapter({
    adapter: 'angular-dev-mode-globals',
  });

  expect(adapter.adapterTarget).toBe('angular-dev-mode-globals');
  expect(adapter.isAngularDevModeGlobalsAvailable).toBe(false);
  expect(adapter.getTreeSnapshot()).toEqual({
    nodes: [],
    rootIds: [],
  });
});
