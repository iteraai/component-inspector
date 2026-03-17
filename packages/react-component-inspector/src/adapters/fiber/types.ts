export type RootDiscoveryWindow = {
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

export type RootDiscoveryUnsupportedReason =
  | 'hook-missing'
  | 'hook-malformed'
  | 'renderers-malformed'
  | 'fiber-roots-reader-missing'
  | 'fiber-roots-malformed';

export type RootDiscoveryEmptyReason = 'renderer-empty' | 'root-empty';

export type RootDiscoveryErrorReason =
  | 'fiber-roots-read-failed'
  | 'probe-failed';

export type RootDiscoveryOkResult = Readonly<{
  status: 'ok';
  renderers: RendererRef[];
  roots: FiberRootRef[];
}>;

export type RootDiscoveryUnsupportedResult = Readonly<{
  status: 'unsupported';
  reason: RootDiscoveryUnsupportedReason;
}>;

export type RootDiscoveryEmptyResult = Readonly<{
  status: 'empty';
  reason: RootDiscoveryEmptyReason;
  renderers: RendererRef[];
}>;

export type RootDiscoveryErrorResult = Readonly<{
  status: 'error';
  reason: RootDiscoveryErrorReason;
  rendererId?: number;
  details?: unknown;
}>;

export type RootDiscoveryResult =
  | RootDiscoveryOkResult
  | RootDiscoveryUnsupportedResult
  | RootDiscoveryEmptyResult
  | RootDiscoveryErrorResult;
