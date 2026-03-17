export type DevtoolsProbeWindow = {
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
};

export type RendererRef = Readonly<{
  rendererId: number;
  renderer: unknown;
}>;

export type FiberRootRef = Readonly<{
  rendererId: number;
  root: unknown;
}>;

export type DevtoolsProbeUnsupportedReason =
  | 'hook-missing'
  | 'hook-malformed'
  | 'renderers-malformed'
  | 'fiber-roots-reader-missing'
  | 'fiber-roots-malformed';

export type DevtoolsProbeEmptyReason = 'renderer-empty' | 'root-empty';

export type DevtoolsProbeErrorReason = 'fiber-roots-read-failed' | 'probe-failed';

export type DevtoolsProbeOkResult = Readonly<{
  status: 'ok';
  renderers: RendererRef[];
  roots: FiberRootRef[];
}>;

export type DevtoolsProbeUnsupportedResult = Readonly<{
  status: 'unsupported';
  reason: DevtoolsProbeUnsupportedReason;
}>;

export type DevtoolsProbeEmptyResult = Readonly<{
  status: 'empty';
  reason: DevtoolsProbeEmptyReason;
  renderers: RendererRef[];
}>;

export type DevtoolsProbeErrorResult = Readonly<{
  status: 'error';
  reason: DevtoolsProbeErrorReason;
  rendererId?: number;
  details?: unknown;
}>;

export type DevtoolsProbeResult =
  | DevtoolsProbeOkResult
  | DevtoolsProbeUnsupportedResult
  | DevtoolsProbeEmptyResult
  | DevtoolsProbeErrorResult;
