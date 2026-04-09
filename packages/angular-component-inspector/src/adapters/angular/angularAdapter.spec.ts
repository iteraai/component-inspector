import { createAngularDevModeGlobalsAdapter } from './angularAdapter';
import type { AngularDevModeGlobalsApi } from './angularGlobals';

type AngularComponentRegistration = {
  component: object;
  hostElement: Element;
  owner?: object | null;
  componentElements?: readonly Element[];
  ownedElements?: readonly Element[];
};

const createAngularComponentDouble = (
  displayName: string,
  sourceMetadata?: Record<string, unknown>,
) => {
  return Object.defineProperty({}, 'constructor', {
    configurable: true,
    value: {
      name: displayName,
      ...(sourceMetadata !== undefined && {
        __iteraSource: sourceMetadata,
      }),
    },
  });
};

const createAngularGlobalsDouble = (
  registrations: readonly AngularComponentRegistration[],
): AngularDevModeGlobalsApi => {
  const componentByElement = new Map<Element, object>();
  const hostElementByComponent = new Map<object, Element>();
  const ownerByTarget = new Map<Element | object, object | null>();

  registrations.forEach((registration) => {
    componentByElement.set(registration.hostElement, registration.component);
    registration.componentElements?.forEach((element) => {
      componentByElement.set(element, registration.component);
      ownerByTarget.set(element, registration.component);
    });
    registration.ownedElements?.forEach((element) => {
      ownerByTarget.set(element, registration.component);
    });
    hostElementByComponent.set(registration.component, registration.hostElement);
    ownerByTarget.set(registration.component, registration.owner ?? null);
    ownerByTarget.set(registration.hostElement, registration.owner ?? null);
  });

  return {
    getComponent: vi.fn((target: Element) => {
      return componentByElement.get(target) ?? null;
    }),
    getOwningComponent: vi.fn((target: Element | object) => {
      return ownerByTarget.get(target) ?? null;
    }),
    getHostElement: vi.fn((target: object) => {
      return hostElementByComponent.get(target) ?? null;
    }),
    getDirectiveMetadata: vi.fn(() => null),
  };
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test('includes normalized source metadata on Angular tree nodes when the builder has instrumented the component type', () => {
  const appShellElement = document.createElement('app-shell');
  const appShellComponent = createAngularComponentDouble('AppShell', {
    file: 'src/app/app-shell.component.ts',
    line: 9,
    column: 15,
  });
  const angularGlobals = createAngularGlobalsDouble([
    {
      component: appShellComponent,
      hostElement: appShellElement,
      owner: null,
    },
  ]);
  const adapter = createAngularDevModeGlobalsAdapter({
    angularGlobals,
  });

  document.body.append(appShellElement);

  expect(adapter.getTreeSnapshot().nodes).toEqual([
    expect.objectContaining({
      displayName: 'AppShell',
      source: {
        file: 'src/app/app-shell.component.ts',
        line: 9,
        column: 15,
      },
    }),
  ]);
});

test('resolves projected-content ancestry from Angular ownership instead of DOM ancestry', () => {
  const appShellElement = document.createElement('app-shell');
  const toolbarPanelElement = document.createElement('toolbar-panel');
  const projectedTextElement = document.createElement('span');
  const appShellComponent = createAngularComponentDouble('AppShell');
  const toolbarPanelComponent = createAngularComponentDouble('ToolbarPanel');
  const angularGlobals = createAngularGlobalsDouble([
    {
      component: appShellComponent,
      hostElement: appShellElement,
      owner: null,
      ownedElements: [projectedTextElement],
    },
    {
      component: toolbarPanelComponent,
      hostElement: toolbarPanelElement,
      owner: appShellComponent,
    },
  ]);
  const adapter = createAngularDevModeGlobalsAdapter({
    angularGlobals,
  });

  toolbarPanelElement.append(projectedTextElement);
  appShellElement.append(toolbarPanelElement);
  document.body.append(appShellElement);

  expect(adapter.getComponentPathForElement?.(projectedTextElement)).toEqual([
    'AppShell',
  ]);
});

test('resolves overlay ancestry even when the component host is rendered outside its owner subtree', () => {
  const appShellElement = document.createElement('app-shell');
  const overlayLauncherElement = document.createElement('overlay-launcher');
  const overlayPanelElement = document.createElement('overlay-panel');
  const overlayActionElement = document.createElement('button');
  const appShellComponent = createAngularComponentDouble('AppShell');
  const overlayLauncherComponent =
    createAngularComponentDouble('OverlayLauncher');
  const overlayPanelComponent = createAngularComponentDouble('OverlayPanel');
  const angularGlobals = createAngularGlobalsDouble([
    {
      component: appShellComponent,
      hostElement: appShellElement,
      owner: null,
    },
    {
      component: overlayLauncherComponent,
      hostElement: overlayLauncherElement,
      owner: appShellComponent,
    },
    {
      component: overlayPanelComponent,
      hostElement: overlayPanelElement,
      owner: overlayLauncherComponent,
      ownedElements: [overlayActionElement],
    },
  ]);
  const adapter = createAngularDevModeGlobalsAdapter({
    angularGlobals,
  });

  overlayPanelElement.append(overlayActionElement);
  appShellElement.append(overlayLauncherElement);
  document.body.append(appShellElement, overlayPanelElement);

  expect(adapter.getComponentPathForElement?.(overlayActionElement)).toEqual([
    'AppShell',
    'OverlayLauncher',
    'OverlayPanel',
  ]);
});

test('returns no ancestry for detached elements after a dynamic Angular component is removed', () => {
  const appShellElement = document.createElement('app-shell');
  const dialogLauncherElement = document.createElement('dialog-launcher');
  const dialogPanelElement = document.createElement('dialog-panel');
  const dialogButtonElement = document.createElement('button');
  const appShellComponent = createAngularComponentDouble('AppShell');
  const dialogLauncherComponent =
    createAngularComponentDouble('DialogLauncher');
  const dialogPanelComponent = createAngularComponentDouble('DialogPanel');
  const angularGlobals = createAngularGlobalsDouble([
    {
      component: appShellComponent,
      hostElement: appShellElement,
      owner: null,
    },
    {
      component: dialogLauncherComponent,
      hostElement: dialogLauncherElement,
      owner: appShellComponent,
    },
    {
      component: dialogPanelComponent,
      hostElement: dialogPanelElement,
      owner: dialogLauncherComponent,
      ownedElements: [dialogButtonElement],
    },
  ]);
  const adapter = createAngularDevModeGlobalsAdapter({
    angularGlobals,
  });

  dialogPanelElement.append(dialogButtonElement);
  appShellElement.append(dialogLauncherElement);
  document.body.append(appShellElement, dialogPanelElement);

  expect(adapter.getComponentPathForElement?.(dialogButtonElement)).toEqual([
    'AppShell',
    'DialogLauncher',
    'DialogPanel',
  ]);

  dialogPanelElement.remove();

  expect(adapter.getComponentPathForElement?.(dialogButtonElement)).toBeUndefined();
});
