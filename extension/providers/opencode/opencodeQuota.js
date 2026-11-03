import { readOpenCodeAuth } from './opencodeAuth.js';
import { parseCodexUsage } from '../shared/usageData.js';
import { UsageError, getUsage } from '../shared/usageIO.js';

export const OPENAI_QUOTA_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';

// ChatGPT plan quota for the OpenAI account OpenCode is signed in with.
// Throws UsageError: missing, expired, unsupported-auth, no-usage or a transport code.
export async function fetchOpenAIQuota({readAuth = readOpenCodeAuth, request = getUsage} = {}, cancellable) {
  const credential = await readAuth(cancellable);
  if (!credential) throw new UsageError('missing');
  const data = await request(OPENAI_QUOTA_ENDPOINT, {
    Authorization: `Bearer ${credential.access}`,
    'ChatGPT-Account-Id': credential.accountID,
  }, cancellable);
  const sessions = parseCodexUsage(data);
  if (!sessions.length) throw new UsageError('no-usage');
  return {sessions, plan: typeof data.plan_type === 'string' ? data.plan_type : ''};
}
