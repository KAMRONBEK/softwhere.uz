// Webpack (Remotion's bundler) resolves require.context at bundle time.
interface WebpackRequireContext {
  keys(): string[];
  (id: string): unknown;
}

declare const require: {
  context(directory: string, useSubdirectories: boolean, regExp: RegExp): WebpackRequireContext;
};
