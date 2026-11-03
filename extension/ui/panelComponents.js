import {meterOrientation, meterValue, orientationFor} from './meterModel.js';
import {compactResetTime} from './usageSummary.js';

const PAIR_LABELS = {horizontal: 'Bars', vertical: 'Columns', percent: 'Percent', reset: 'Reset time', rings: 'Rings'};
const WINDOWS = ['Session', 'Weekly'];
const ANTIGRAVITY = [
  ...WINDOWS,
  'Gemini · 5h', 'Gemini · weekly',
  'Claude and GPT · 5h', 'Claude and GPT · weekly',
];

// Stable IDs let a user configure a quota even before its first successful fetch.
export function componentChoices(result) {
  const known = result.id === 'antigravity' ? ANTIGRAVITY : WINDOWS;
  const observed = (result.sessions ?? []).filter(session =>
    typeof session.name === 'string' && session.name.length <= 80 && session.name.length > 0);
  const labels = new Map(observed.map(session => [session.name,
    typeof session.label === 'string' ? session.label : session.name]));
  const singles = [...new Set([...known, ...labels.keys()])]
    .map(name => ({
      id: `${result.id}:${name}`, label: labels.get(name) ?? name, kind: 'meter',
      name, group: 'Individual windows',
    }));
  const pairs = Object.entries(PAIR_LABELS).map(([variant, label]) => ({
    id: `${result.id}:pair:${variant}`, kind: 'pair', variant, label, group: 'Both windows',
  }));
  const activity = result.id === 'opencode'
    ? [{id: 'opencode:activity', label: '7-day tokens', kind: 'activity', group: 'Provider'}] : [];
  return [...activity, ...singles, ...pairs];
}

export function visibleComponents(result, visible, orientations, defaultOrientation) {
  const selected = new Set(visible);
  const choices = componentChoices(result);
  return {
    icon: true, // the provider icon is always shown, never a choice
    activity: result.id === 'opencode' && selected.has('opencode:activity'),
    meters: choices.filter(choice => ['meter', 'pair'].includes(choice.kind) && selected.has(choice.id))
      .map(choice => {
        if (choice.kind === 'pair') return {variant: choice.variant};
        const orientation = orientationFor(choice.id, orientations, defaultOrientation);
        return {name: choice.name, orientation: meterOrientation(orientation)};
      }),
  };
}

export function panelDescription(result, display) {
  const names = new Set(display.meters.flatMap(meter => meter.variant ? WINDOWS : [meter.name]));
  const parts = [...names].map(name => {
    const value = meterValue(result, name);
    return `${name}: ${value === null ? 'unavailable' : `${value}% used`}`;
  });
  if (display.meters.some(meter => meter.variant === 'reset')) {
    for (const {name, reset} of pairedReadings(result))
      parts.push(reset ? `${name} resets in ${reset}` : `${name} reset unavailable`);
  }
  if (display.activity) parts.push(['ok', 'stale'].includes(result.status)
    ? `${Number(result.totalTokens ?? 0).toLocaleString()} tokens in 7 days` : 'activity unavailable');
  return [result.label, ...parts, ...(result.status === 'stale' ? ['stale'] : [])].join(', ');
}

export function pairedReadings(result, now = Date.now()) {
  return WINDOWS.map((name, index) => ({
    name, label: index === 0 ? '5h' : 'W', percent: meterValue(result, name, now),
    reset: ['ok', 'stale'].includes(result.status)
      ? compactResetTime(result.sessions?.find(item => item.name === name)?.resetsAt, now) : null,
  }));
}
