export const given: {
  <T>(value: () => T): Promise<Awaited<T>>;
  <T>(value: T): Promise<Awaited<T>>;
} = <T>(value: T | (() => T)): Promise<Awaited<T>> => {
  const resolvedValue = typeof value === 'function' ? (value as () => T)() : value;

  if (resolvedValue instanceof Promise) {
    return resolvedValue as Promise<Awaited<T>>;
  }

  return Promise.resolve(resolvedValue as Awaited<T>);
};

declare global {
  interface Promise<T> {
    when<U>(callback: (resolvedValue: T) => U | Promise<U>): Promise<U>;
    thenCatch<U>(callback: (error: unknown) => U | Promise<U>): Promise<U>;
  }
}
