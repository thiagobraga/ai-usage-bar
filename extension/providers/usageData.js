// Pure quota parsers shared by GJS providers and Node tests.
export const STALE_AFTER_MS = 5 * 60 * 1000;
const percent = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const date = value => {
  if (!(typeof value === 'string' || typeof value === 'number' || value instanceof Date)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

function window(name, used, reset) {
  if (!percent(used)) return null;
  const resetsAt = date(reset);
  return {name, usedPercent: used,
    resetLabel: resetsAt ? `Resets ${resetsAt.toLocaleString()}` : 'Reset time unavailable',
    ...(resetsAt ? {resetsAt} : {})};
}

export function parseClaudeUsage(data) {
  return [window('Session', data?.five_hour?.utilization, data?.five_hour?.resets_at),
    window('Weekly', data?.seven_day?.utilization, data?.seven_day?.resets_at)].filter(Boolean);
}

function codexWindows(primary, secondary, local) {
  const sessions = [];
  for (const entry of [primary, secondary]) {
    const minutes = local ? entry?.window_minutes : entry?.limit_window_seconds / 60;
    const name = minutes === 300 ? 'Session' : minutes === 10080 ? 'Weekly' : null;
    const seconds = local ? entry?.resets_at : entry?.reset_at;
    const parsed = name && window(name, entry?.used_percent,
      typeof seconds === 'number' && seconds > 0 ? seconds * 1000 : null);
    if (parsed && !sessions.some(s => s.name === name)) sessions.push(parsed);
  }
  return sessions.sort((a, b) => (a.name === 'Session' ? 0 : 1) - (b.name === 'Session' ? 0 : 1));
}

export function parseCodexUsage(data) {
  return codexWindows(data?.rate_limit?.primary_window, data?.rate_limit?.secondary_window, false);
}

export function parseCodexEvent(event, now = new Date()) {
  if (event?.type !== 'event_msg' || event?.payload?.type !== 'token_count') return null;
  const limits = event.payload.rate_limits;
  if (!limits || (limits.limit_id != null && limits.limit_id !== 'codex')) return null;
  const lastUpdated = typeof event.timestamp === 'string' ? date(event.timestamp) : null;
  if (!lastUpdated || lastUpdated > now) return null;
  const sessions = codexWindows(limits.primary, limits.secondary, true);
  if (!sessions.length) return null;
  const stale = now - lastUpdated > STALE_AFTER_MS || sessions.some(s => s.resetsAt && s.resetsAt <= now);
  return {sessions, lastUpdated, status: stale ? 'stale' : 'ok',
    plan: typeof limits.plan_type === 'string' ? limits.plan_type : '',
    source: 'Codex CLI local rate-limit observation (bounded scan)', cost: null};
}

export function parseCodexJsonl(text, now = new Date()) {
  let latest = null;
  for (const line of text.split('\n')) {
    try {
      const observation = parseCodexEvent(JSON.parse(line), now);
      if (observation && (!latest || observation.lastUpdated > latest.lastUpdated)) latest = observation;
    } catch { /* Truncated lines and unrelated CLI records are expected. */ }
  }
  return latest;
}

export function credentialState(token, expiresAt, now = Date.now()) {
  if (typeof token !== 'string' || !token.trim()) return 'missing';
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt <= now) return 'expired';
  return 'ready';
}
