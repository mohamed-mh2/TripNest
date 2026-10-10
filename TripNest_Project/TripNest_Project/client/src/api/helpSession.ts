import { getFinanceSession } from './financeSession';

// #explain_notes: Traveler requests share the team's session. The support agent
// is a separate local demonstration account; production requires a real agent login.
export async function helpAccessToken(agent = false): Promise<string> {
  if (!agent || !import.meta.env.DEV) return (await getFinanceSession('traveler')).token;
  const response = await fetch('/api/dev/support-session');
  if (!response.ok)
    throw new Error(
      'The local support agent is unavailable. Run the support database migration.',
    );
  const session = await response.json();
  return session.token;
}
