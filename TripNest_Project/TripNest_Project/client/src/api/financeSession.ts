export type FinanceRole = 'traveler' | 'family';

export type FinanceSession = { token: string; tripId?: string };
let teamSession: FinanceSession | null = null;

// #explain_notes: Student 1 can supply the signed-in session without using local demo accounts.

export function configureFinanceSession(session: FinanceSession | null) {
  teamSession = session;
}

export async function getFinanceSession(role: FinanceRole): Promise<FinanceSession> {
  if (teamSession) return teamSession;
  if (!import.meta.env.DEV) throw new Error('Sign in before opening your finances.');
  const response = await fetch(
    role === 'family' ? '/api/dev/family-session' : '/api/dev/session',
  );
  if (!response.ok)
    throw new Error(
      'Local session unavailable. Start the database and API, and run database setup.',
    );
  return response.json();
}

// #explain_notes: Read the current login token on each request; a production logout blocks further calls.

export function financeAccessToken(demoToken: string): string {
  if (teamSession) return teamSession.token;
  if (import.meta.env.DEV && demoToken) return demoToken;
  throw new Error('Sign in before opening your finances.');
}
