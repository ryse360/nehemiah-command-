import test from 'node:test';
import assert from 'node:assert/strict';
import { ORGANISM_STATUS_LABEL, restingLabCommandSurface } from './organism-lab-contract';

test('the resting state announces itself as BREATHING', () => {
  assert.equal(ORGANISM_STATUS_LABEL, 'BREATHING');
});

test('the command surface exists but is inactive in the resting milestone', () => {
  assert.equal(restingLabCommandSurface.active, false);
  assert.ok(restingLabCommandSurface.placeholder.length > 0);
  assert.ok(restingLabCommandSurface.helperText.length > 0);
});
