import { isWorkspaceHash } from '../workspace.ts';

// #explain_notes: Keep a private support link or booking destination through sign-in,
// while accepting only known local app routes as a return address.
export function loginDestination(pathname: string, search = '', hash = ''): string {
  const candidate =
    new URLSearchParams(search).get('returnTo') || pathname + search + hash;
  if (
    candidate.length > 1024 ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    /[\\\r\n]/.test(candidate)
  )
    return '/trips';
  const address = new URL(candidate, 'https://tripnest.local');
  if (address.origin !== 'https://tripnest.local') return '/trips';
  if (address.pathname === '/' && isWorkspaceHash(address.hash))
    return address.pathname + address.search + address.hash;
  if (
    /^\/(trips|bookings)(\/[a-f0-9-]{36})?$/.test(address.pathname) ||
    /^\/services(\/\d+)?$/.test(address.pathname) ||
    /^\/(readiness|help|account)$/.test(address.pathname)
  )
    return address.pathname + address.search + address.hash;
  return '/trips';
}
