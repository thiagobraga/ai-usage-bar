// Pure display rules, shared by the Shell widgets and Node tests.
export function meterValue(result, name, now = Date.now()) {
  if (!result || !['ok', 'stale'].includes(result.status)) return null;
  const session = result.sessions?.find(item => item.name === name);
  if (!session || typeof session.usedPercent !== 'number' ||
      !Number.isFinite(session.usedPercent)) return null;
  if (session.resetsAt && new Date(session.resetsAt).getTime() <= now) return null;
  return Math.max(0, Math.min(100, session.usedPercent));
}

// Colour follows how much quota is consumed: low use is good, high use is bad.
export function meterSeverity(percent) {
  if (percent === null) return 'unknown';
  if (percent >= 85) return 'high';
  if (percent >= 60) return 'medium';
  return 'low';
}

export function unicodeSegments(percent, count = 5) {
  if (percent === null) return '—';
  const filled = Math.round(Math.max(0, Math.min(100, percent)) * count / 100);
  return '■'.repeat(filled) + '·'.repeat(count - filled);
}

export function meterOrientation(style, orientation) {
  return orientation === 'auto' ? (style === 'colored' ? 'vertical' : 'horizontal') : orientation;
}

export function usageSummary(result, now = Date.now()) {
  const values = ['Session', 'Weekly'].map(name => {
    const value = meterValue(result, name, now);
    return `${name}: ${value === null ? 'unavailable' : `${value}% used`}`;
  });
  return `${result.label} — ${values.join(', ')}${result.status === 'stale' ? ' (stale)' : ''}`;
}
