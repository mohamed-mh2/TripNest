import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWorkspaceHash,
  workspacePage,
  workspaceHash,
} from '../src/features/workspace.ts';

test('public landing anchors do not open the protected finance workspace', () => {
  for (const hash of ['', '#', '#possibilities', '#photo-credits-title'])
    assert.equal(isWorkspaceHash(hash), false);
});

test('existing shared links and planner anchors still open the appropriate workspace', () => {
  for (const hash of ['#planner', '#budget', '#plan-settings', '#planned-expenses']) {
    assert.equal(isWorkspaceHash(hash), true);
    assert.equal(workspacePage(hash), 'budget');
  }
  assert.equal(workspacePage('#wallet'), 'wallet');
  for (const hash of ['#cash', '#funds', '#support=TN-EXAMPLE']) {
    assert.equal(isWorkspaceHash(hash), true);
    assert.equal(workspacePage(hash), 'funds');
  }
  for (const page of ['budget', 'wallet', 'funds'] as const) {
    assert.equal(workspacePage('#' + workspaceHash(page)), page);
  }
});
