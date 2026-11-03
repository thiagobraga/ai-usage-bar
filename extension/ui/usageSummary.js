import {compactTokens, meterValue} from './meterModel.js';

export function compactResetTime(resetsAt, now = Date.now()) {
  if (!resetsAt) return null;
  const minutes = Math.ceil((new Date(resetsAt).getTime() - now) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24) + 'd';
    return hours % 24 ? `${days} ${hours % 24}h` : days;
  }
  if (hours > 0) return minutes % 60 ? `${hours}h ${minutes % 60}m` : hours + 'h';
  return minutes + 'm';
}

const percentText = percent => percent === null ? '–' : Math.round(percent) + '%';

function limitRows(result, now, readable) {
  const names = ['Session', 'Weekly'];
  const sessions = result.sessions ?? [];
  return [...new Set([...names, ...sessions.map(session => session.name)])].map(name => {
    const session = sessions.find(item => item.name === name);
    const percent = meterValue(result, name, now);
    const remaining = readable && compactResetTime(session?.resetsAt, now);
    const expired = readable && session?.resetsAt && new Date(session.resetsAt).getTime() <= now;
    return {label: name === 'Session' ? '5-hour limit' : name === 'Weekly' ? 'Weekly limit' : session.label ?? name,
      percent, value: percent === null ? 'Unavailable' : percentText(percent) + ' used',
      reset: remaining ? 'Resets in ' + remaining : expired ? 'Reset passed · awaiting update' : 'Reset time unavailable'};
  });
}

// OpenCode's OpenAI sign-in has its own quota; show it only when there is something to say.
function openCodeQuota(result, now, readable) {
  if (result.sessions?.length) return {heading: 'OpenAI quota', rows: limitRows(result, now, readable)};
  if (result.quotaError) return {heading: 'OpenAI quota', rows: [], empty: 'Quota unavailable'};
  return undefined;
}

export function providerSummary(result, now = Date.now()) {
  const readable = ['ok', 'stale'].includes(result.status);
  const status = result.status === 'stale' ? 'Stale reading' : '';
  if (result.id === 'opencode') {
    const value = readable && Number.isFinite(result.totalTokens) ? compactTokens(result.totalTokens) : '–';
    return {rings: [], value, secondary: 'tokens', status,
      heading: '7-day activity',
      rows: readable ? (result.activity ?? []).map(item => ({label: item.provider,
        value: compactTokens(item.tokens) + ' tokens', reset: '$' + item.cost.toFixed(2)})) : [],
      empty: readable ? 'No recorded activity' : 'Activity unavailable',
      quota: readable ? openCodeQuota(result, now, readable) : undefined};
  }
  const rings = ['Session', 'Weekly'].map(name => meterValue(result, name, now));
  // rings = [5h, weekly]; the card shows both percentages inside the rings.
  return {rings, value: percentText(rings[0]), secondary: percentText(rings[1]), status,
    heading: 'Usage limits', rows: limitRows(result, now, readable)};
}
