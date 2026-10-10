export type WorkspacePage = 'budget' | 'wallet' | 'funds';

// #explain_notes: Real URLs keep refresh, shared links and browser Back working.

export function workspacePage(hash: string): WorkspacePage {
  const value = hash.replace(/^#/, '');
  if (value === 'wallet') return 'wallet';
  if (value === 'funds' || value === 'cash' || new URLSearchParams(value).has('support'))
    return 'funds';
  return 'budget';
}

export function workspaceHash(page: WorkspacePage): string {
  return page === 'budget' ? 'planner' : page;
}
