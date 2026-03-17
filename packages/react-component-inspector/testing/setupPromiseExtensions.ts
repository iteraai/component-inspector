declare global {
  interface Promise<T> {
    when<U>(callback: (resolvedValue: T) => U | Promise<U>): Promise<U>;
    thenCatch<U>(callback: (error: unknown) => U | Promise<U>): Promise<U>;
  }
}

export const setupPromiseExtensions = () => {
  Promise.prototype.when = function (callback) {
    return this.then(callback);
  };

  Promise.prototype.thenCatch = function (callback) {
    return this.catch(callback);
  };
};
