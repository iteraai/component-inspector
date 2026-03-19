import {
  initDevEmbeddedInspectorBridge,
  reactInspectorNextAdapterTarget,
  type ReactInspectorRuntimeConfig,
} from '@iteraai/react-component-inspector';
import { bootIterationInspectorRuntime } from '@iteraai/react-component-inspector/iterationInspector';

type NextInstrumentationEnv = {
  NODE_ENV?: string;
  NEXT_PUBLIC_ITERA_COMPONENT_INSPECTOR_ENABLED?: string;
  NEXT_PUBLIC_ITERA_COMPONENT_INSPECTOR_HOST_ORIGINS?: string;
};

const splitHostOrigins = (value: string | undefined) => {
  if (value === undefined) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export const documentedNextRuntimeFallback: ReactInspectorRuntimeConfig = {
  adapter: reactInspectorNextAdapterTarget,
};

export const bootstrapNextjsInstrumentationClient = (
  env: NextInstrumentationEnv,
) => {
  if (
    env.NODE_ENV !== 'development' ||
    env.NEXT_PUBLIC_ITERA_COMPONENT_INSPECTOR_ENABLED !== '1'
  ) {
    return null;
  }

  const hostOrigins = splitHostOrigins(
    env.NEXT_PUBLIC_ITERA_COMPONENT_INSPECTOR_HOST_ORIGINS,
  );

  bootIterationInspectorRuntime();

  if (hostOrigins.length === 0) {
    return null;
  }

  return initDevEmbeddedInspectorBridge({
    enabled: true,
    hostOrigins,
  });
};
