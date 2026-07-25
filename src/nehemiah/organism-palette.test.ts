import test from 'node:test';
import assert from 'node:assert/strict';
import { neoPalette } from './organism-palette';

test('palette carries the reference-derived neo tokens verbatim', () => {
  assert.equal(neoPalette.background, '#F4EBE2');
  assert.equal(neoPalette.backgroundLight, '#FBF2F0');
  assert.equal(neoPalette.shellWhite, '#FDFEF4');
  assert.equal(neoPalette.coreUmber, '#443529');
  assert.equal(neoPalette.corePlum, '#5F5157');
  assert.equal(neoPalette.goldDeep, '#8E7358');
  assert.equal(neoPalette.goldMid, '#D9B784');
  assert.equal(neoPalette.goldLight, '#EAD3B7');
  assert.equal(neoPalette.lavenderDark, '#6C5E7C');
  assert.equal(neoPalette.lavenderMid, '#A694BF');
  assert.equal(neoPalette.lavenderLight, '#E0CFED');
  assert.equal(neoPalette.contactShadow, 'rgba(68, 53, 41, 0.15)');
});

test('gold stays warm — never saturated neon yellow', () => {
  const red = parseInt(neoPalette.goldMid.slice(1, 3), 16);
  const green = parseInt(neoPalette.goldMid.slice(3, 5), 16);
  const blue = parseInt(neoPalette.goldMid.slice(5, 7), 16);

  assert.ok(green >= red * 0.6, 'green holds against red — warm, not orange-neon');
  assert.ok(blue >= red * 0.4, 'blue floor keeps gold soft, not electric yellow');
});

test('lavender stays muted — never electric purple', () => {
  const red = parseInt(neoPalette.lavenderMid.slice(1, 3), 16);
  const green = parseInt(neoPalette.lavenderMid.slice(3, 5), 16);
  const blue = parseInt(neoPalette.lavenderMid.slice(5, 7), 16);

  assert.ok(green >= blue * 0.6, 'enough green to desaturate the violet');
  assert.ok(blue > red, 'still reads lavender, not pink');
});
