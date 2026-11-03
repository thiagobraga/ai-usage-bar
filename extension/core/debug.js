// Debug logging, toggled by the `debug-logging` GSettings key.
// Never pass tokens or response bodies here; log codes, statuses, and timings only.
let enabled = false;

export function setDebug(on) { enabled = Boolean(on); }
export function debugEnabled() { return enabled; }
export function debugLog(scope, ...parts) {
  if (enabled) console.log(`[ai-usage-bar] [debug] ${scope}: ${parts.join(' ')}`);
}

// One-line description of an arbitrary thrown value, keeping the original cause.
export function describeError(error) {
  if (error === null || error === undefined) return 'unknown error';
  const name = error.constructor?.name ?? typeof error;
  const message = error.message ?? String(error);
  const domain = error.domain !== undefined ? ` domain=${error.domain} code=${error.code}` : '';
  return `${name}: ${message}${domain}`;
}
