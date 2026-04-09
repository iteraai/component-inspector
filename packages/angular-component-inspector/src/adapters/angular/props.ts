import type { AngularDevModeGlobalsApi } from './angularGlobals';
import type { AngularNodeLookupPayload } from './nodeLookup';

type AngularComponentInstanceLike = Record<string, unknown>;
type AngularDirectiveDebugMetadataLike = Readonly<{
  inputs?: Record<string, unknown> | null | undefined;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const readRecordValue = (record: Record<string, unknown>, key: string) => {
  try {
    return record[key];
  } catch {
    return undefined;
  }
};

const hasProperty = (record: Record<string, unknown>, key: string) => {
  try {
    return key in record;
  } catch {
    return false;
  }
};

const toComponentInstance = (
  value: unknown,
): AngularComponentInstanceLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value;
};

const toDirectiveDebugMetadata = (
  value: unknown,
): AngularDirectiveDebugMetadataLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value;
};

const toPublicInputEntries = (
  metadata: AngularDirectiveDebugMetadataLike | undefined,
) => {
  const inputs = metadata?.inputs;

  if (!isRecord(inputs)) {
    return [];
  }

  return Object.entries(inputs)
    .filter(([publicName]) => publicName.trim().length > 0)
    .sort(([leftPublicName], [rightPublicName]) =>
      leftPublicName.localeCompare(rightPublicName),
    );
};

const readComponentInputValue = (
  component: AngularComponentInstanceLike,
  publicName: string,
  metadataValue: unknown,
) => {
  if (typeof metadataValue === 'string' && metadataValue.trim().length > 0) {
    const propertyName = metadataValue.trim();

    if (propertyName !== publicName) {
      const hasMappedProperty = hasProperty(component, propertyName);
      const hasPublicProperty = hasProperty(component, publicName);

      if (!hasMappedProperty && hasPublicProperty) {
        return readRecordValue(component, publicName);
      }
    }

    return readRecordValue(component, propertyName);
  }

  return readRecordValue(component, publicName);
};

export const readAngularNodeProps = (options: {
  lookupPayload: AngularNodeLookupPayload;
  angularGlobals: AngularDevModeGlobalsApi;
}): Record<string, unknown> => {
  const component = toComponentInstance(options.lookupPayload.component);

  if (component === undefined) {
    return {};
  }

  let directiveMetadata: AngularDirectiveDebugMetadataLike | null | undefined;

  try {
    directiveMetadata = toDirectiveDebugMetadata(
      options.angularGlobals.getDirectiveMetadata?.(component),
    );
  } catch {
    directiveMetadata = undefined;
  }

  const props: Record<string, unknown> = {};

  toPublicInputEntries(directiveMetadata).forEach(
    ([publicName, metadataValue]) => {
      props[publicName] = readComponentInputValue(
        component,
        publicName,
        metadataValue,
      );
    },
  );

  return props;
};
