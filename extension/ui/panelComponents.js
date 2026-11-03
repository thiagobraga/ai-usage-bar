import {meterOrientation, meterValue, orientationFor} from './meterModel.js';

const WINDOWS = ['Session', 'Weekly'];
const ANTIGRAVITY = [
  ...WINDOWS,
  'Gemini · 5h', 'Gemini · weekly',
  'Claude and GPT · 5h', 'Claude and GPT · weekly',
];

// Stable IDs let a user configure a quota even before its first successful fetch.
export function componentChoices(result) {
  const icon = {id: `${result.id}:icon`, label: 'Icon', kind: 'icon'};
  if (result.id === 'opencode')
    return [icon, {id: 'opencode:activity', label: '7-day tokens', kind: 'activity'}];

  const known = result.id === 'antigravity' ? ANTIGRAVITY : WINDOWS;
  const observed = (result.sessions ?? []).map(session => session.name)
    .filter(name => typeof name === 'string' && name.length <= 80 && name.length > 0);
  return [icon, ...[...new Set([...known, ...observed])]
    .map(name => ({id: `${result.id}:${name}`, label: name, kind: 'meter', name}))];
}

export function visibleComponents(result, visible, orientations, defaultOrientation) {
  const selected = new Set(visible);
  const choices = componentChoices(result);
  return {
    icon: selected.has(`${result.id}:icon`),
    activity: result.id === 'opencode' && selected.has('opencode:activity'),
    meters: choices.filter(choice => choice.kind === 'meter' && selected.has(choice.id))
      .map(choice => ({name: choice.name, orientation: meterOrientation(
        orientationFor(choice.id, orientations, defaultOrientation))})),
  };
}

export function panelDescription(result, display) {
  const parts = display.meters.map(({name}) => {
    const value = meterValue(result, name);
    return `${name}: ${value === null ? 'unavailable' : `${value}% used`}`;
  });
  if (display.activity) parts.push(['ok', 'stale'].includes(result.status)
    ? `${Number(result.totalTokens ?? 0).toLocaleString()} tokens in 7 days` : 'activity unavailable');
  return [result.label, ...parts, ...(result.status === 'stale' ? ['stale'] : [])].join(', ');
}
