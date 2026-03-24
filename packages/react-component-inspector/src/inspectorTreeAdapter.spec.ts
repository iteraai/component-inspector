import {
  toInspectorTreeAdapter,
  toReactTreeAdapter,
} from './inspectorTreeAdapter';

class LegacyReactAdapter {
  calls = {
    getTreeSnapshot: 0,
    getNodeProps: 0,
    getDomElement: 0,
    getReactComponentPathForElement: 0,
  };

  getTreeSnapshot() {
    this.calls.getTreeSnapshot += 1;

    return {
      nodes: [],
      rootIds: [],
    };
  }

  getNodeProps(nodeId: string) {
    this.calls.getNodeProps += 1;

    return { nodeId };
  }

  getDomElement(nodeId: string) {
    this.calls.getDomElement += 1;

    return nodeId === 'root' ? document.createElement('div') : null;
  }

  getReactComponentPathForElement() {
    this.calls.getReactComponentPathForElement += 1;

    return ['App', 'Panel'];
  }
}

class NeutralAdapter {
  calls = {
    getTreeSnapshot: 0,
    getNodeProps: 0,
    getDomElement: 0,
    getComponentPathForElement: 0,
  };

  getTreeSnapshot() {
    this.calls.getTreeSnapshot += 1;

    return {
      nodes: [],
      rootIds: [],
    };
  }

  getNodeProps(nodeId: string) {
    this.calls.getNodeProps += 1;

    return { nodeId };
  }

  getDomElement(nodeId: string) {
    this.calls.getDomElement += 1;

    return nodeId === 'root' ? document.createElement('div') : null;
  }

  getComponentPathForElement() {
    this.calls.getComponentPathForElement += 1;

    return ['App', 'Panel'];
  }
}

describe('inspector tree adapter conversion', () => {
  it('preserves legacy adapter method context while normalizing', () => {
    const legacyAdapter = new LegacyReactAdapter();
    const normalizedAdapter = toInspectorTreeAdapter(legacyAdapter);

    normalizedAdapter.getTreeSnapshot();
    normalizedAdapter.getNodeProps('root');
    normalizedAdapter.getDomElement('root');
    normalizedAdapter.getComponentPathForElement?.(document.body);

    expect(legacyAdapter.calls).toEqual({
      getTreeSnapshot: 1,
      getNodeProps: 1,
      getDomElement: 1,
      getReactComponentPathForElement: 1,
    });
  });

  it('preserves adapter method context while converting to React contract', () => {
    const adapter = new NeutralAdapter();
    const reactAdapter = toReactTreeAdapter(adapter);

    reactAdapter.getTreeSnapshot();
    reactAdapter.getNodeProps('root');
    reactAdapter.getDomElement('root');
    reactAdapter.getReactComponentPathForElement?.(document.body);

    expect(adapter.calls).toEqual({
      getTreeSnapshot: 1,
      getNodeProps: 1,
      getDomElement: 1,
      getComponentPathForElement: 1,
    });
  });
});
