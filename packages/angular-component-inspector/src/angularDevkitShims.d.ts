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
    logger: {
      info: (message: string) => void;
      warn: (message: string) => void;
      error: (message: string) => void;
    };
    scheduleBuilder: (
      builderName: string,
      options: Record<string, unknown>,
    ) => Promise<BuilderRun>;
  };

  export type BuilderHandlerFn<
    TOptions extends object = Record<string, unknown>,
  > = (
    options: TOptions,
    context: BuilderContext,
  ) => Promise<BuilderOutput> | BuilderOutput;

  export type Builder<_TOptions extends object = Record<string, unknown>> =
    unknown;

  export function createBuilder<
    TOptions extends object = Record<string, unknown>,
  >(handler: BuilderHandlerFn<TOptions>): Builder<TOptions>;
}
