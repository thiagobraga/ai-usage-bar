// Keep account selection separate from credential I/O. Never return refresh tokens.
export function selectOpenAIAuth(source, now = Date.now()) {
  let value;
  if (Array.isArray(source)) {
    const active = source.find(row => row?.active === 1 || row?.active === true) ?? source[0];
    if (!active) return {credential: null, issue: 'missing'};
    if (typeof active.value === 'string') {
      try { value = JSON.parse(active.value); } catch { return {credential: null, issue: 'missing'}; }
    } else value = active.value;
  } else {
    value = source?.openai;
  }
  if (value?.type !== 'oauth') return {credential: null, issue: 'missing'};
  if (value.methodID && !['chatgpt-browser', 'chatgpt-headless'].includes(value.methodID))
    return {credential: null, issue: 'unsupported-auth'};
  const access = value.access;
  const accountID = value.metadata?.accountID ?? value.accountId;
  if (typeof access !== 'string' || !access.trim() ||
      typeof accountID !== 'string' || !accountID.trim()) return {credential: null, issue: 'missing'};
  if (!Number.isFinite(value.expires) || value.expires <= now)
    return {credential: null, issue: 'expired'};
  return {credential: {access, accountID}, issue: null};
}

export function selectOpenAICredential(source, now = Date.now()) {
  return selectOpenAIAuth(source, now).credential;
}
