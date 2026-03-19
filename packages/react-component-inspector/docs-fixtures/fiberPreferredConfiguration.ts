import {
  bootstrapEmbeddedInspectorBridge,
  reactInspectorRuntimeAdapterTargets,
  resolveReactInspectorRuntimeConfig,
  type ReactInspectorRuntimeConfig,
} from '@iteraai/react-component-inspector';

export const documentedFiberRuntimeConfig: ReactInspectorRuntimeConfig = {
  adapter: 'fiber',
  capabilities: {
    tree: true,
    props: true,
    highlight: true,
  },
};

export const bootstrapFiberPreferredInspector = () => {
  const resolvedRuntimeConfig = resolveReactInspectorRuntimeConfig(
    documentedFiberRuntimeConfig,
  );

  if (
    !reactInspectorRuntimeAdapterTargets.includes(resolvedRuntimeConfig.adapter)
  ) {
    throw new Error(
      `Unsupported runtime adapter: ${resolvedRuntimeConfig.adapter}`,
    );
  }

  return bootstrapEmbeddedInspectorBridge({
    enabled: true,
    hostOrigins: ['https://app.iteradev.ai'],
    runtimeConfig: documentedFiberRuntimeConfig,
  });
};
