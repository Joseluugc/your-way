import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldApplyRemote } from '../src/domain/sync/mergeRemoteEvento.ts';

test('applies a remote row that does not exist locally', () => {
  assert.equal(shouldApplyRemote(null), true);
});

test('applies a remote row over a synced local row', () => {
  assert.equal(shouldApplyRemote({ sync_status: 'synced' }), true);
});

test('keeps a pending local row until it is uploaded', () => {
  assert.equal(shouldApplyRemote({ sync_status: 'pending' }), false);
});
