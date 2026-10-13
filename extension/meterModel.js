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

// Fill colour stops: green until 50%, blending through yellow (60), orange (80)
// and near-red (90) to pure red (100). Values between stops are interpolated.
const COLOR_STOPS = [
  [50, [0x19, 0xd3, 0x9b]],
  [60, [0xf5, 0xd9, 0x0a]],
  [80, [0xff, 0x8c, 0x00]],
  [85, [0xff, 0x5f, 0x00]],
  [90, [0xff, 0x2a, 0x00]],
  [95, [0xff, 0x11, 0x00]],
  [100, [0xff, 0x00, 0x00]],
];

export function meterColor(percent) {
  if (percent === null) return null;
  const hex = rgb => `#${rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  if (percent <= COLOR_STOPS[0][0]) return hex(COLOR_STOPS[0][1]);
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [hi, to] = COLOR_STOPS[i];
    if (percent > hi) continue;
    const [lo, from] = COLOR_STOPS[i - 1];
    const t = (percent - lo) / (hi - lo);
    return hex(from.map((c, k) => c + (to[k] - c) * t));
  }
  return hex(COLOR_STOPS.at(-1)[1]);
}

export function unicodeSegments(percent, count = 5) {
  const filled = percent === null ? 0 : Math.round(Math.max(0, Math.min(100, percent)) * count / 100);
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
