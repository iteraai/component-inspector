declare module '@angular-devkit/architect' {
  export type BuilderOutput = {
    success: boolean;
    error?: string;
  };

  export type BuilderRun = {
    result: Promise<BuilderOutput>;
    stop?: () => Promise<void> | void;
  };

  export type BuilderContext = {
    workspaceRoot: string;
    target?: {
      project?: string;
      target?: string;
      configuration?: string;
    };
    logger: {
      info: (message: string) => void;
      warn: (message: string) => void;
      error: (message: string) => void;
    };
    scheduleBuilder: (
      builderName: string,
      options: Record<string, unknown>,
    ) => Promise<BuilderRun>;
    getBuilderNameForTarget: (target: Record<string, unknown>) => Promise<string>;
    getTargetOptions: (
      target: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
    validateOptions: (
      options: Record<string, unknown>,
      builderName: string,
    ) => Promise<Record<string, unknown>>;
    addTeardown: (teardown: () => Promise<void> | void) => void;
  };

  export type BuilderHandlerFn<
    TOptions extends object = Record<string, unknown>,
  > = (
    options: TOptions,
    context: BuilderContext,
  ) =>
    | Promise<BuilderOutput>
    | BuilderOutput
    | AsyncIterable<BuilderOutput>;

  export type Builder<_TOptions extends object = Record<string, unknown>> =
    unknown;

  export function createBuilder<
    TOptions extends object = Record<string, unknown>,
  >(handler: BuilderHandlerFn<TOptions>): Builder<TOptions>;
}
