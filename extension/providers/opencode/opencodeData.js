// OpenCode's stats JSON has one entry per model. Token counts are activity,
// never a percentage of a provider's plan.
export function parseOpenCodeStats(data, connected = []) {
  if (!Array.isArray(data?.models)) return null;
  const providers = new Map();
  for (const item of data.models) {
    const name = item?.model?.providerID;
    const parts = [item?.tokens?.input, item?.tokens?.output,
      item?.tokens?.reasoning, item?.tokens?.cache?.read, item?.tokens?.cache?.write];
    if (typeof name !== 'string' || !name ||
        parts.some(value => value !== undefined && (!Number.isFinite(value) || value < 0)) ||
        !Number.isFinite(item?.cost) || item.cost < 0) return null;
    const entry = providers.get(name) ?? {provider: name, tokens: 0, cost: 0, models: 0};
    entry.tokens += parts.reduce((sum, value) => sum + (value ?? 0), 0);
    entry.cost += item.cost;
    entry.models++;
    providers.set(name, entry);
  }
  for (const name of connected) {
    if (typeof name === 'string' && name && !providers.has(name))
      providers.set(name, {provider: name, tokens: 0, cost: 0, models: 0});
  }
  return [...providers.values()].sort((a, b) => b.tokens - a.tokens || a.provider.localeCompare(b.provider));
}
