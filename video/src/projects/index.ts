const context = require.context('./', false, /\.json$/);

export type ProjectEntry = { id: string; raw: unknown };

/** Every src/projects/<slug>.json, discovered at bundle time — adding a project needs no registry edit. */
export const PROJECT_ENTRIES: readonly ProjectEntry[] = context
  .keys()
  .filter(key => key.startsWith('./'))
  .sort()
  .map(key => ({ id: key.slice(2, -'.json'.length), raw: context(key) }));
