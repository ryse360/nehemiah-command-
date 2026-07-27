import test from 'node:test';
import assert from 'node:assert/strict';
import { isApprovedLoopbackUrl, resolveVoiceConfig, DEFAULT_LOCALE } from './config.ts';

test('approves only loopback hosts', () => {
  assert.equal(isApprovedLoopbackUrl('http://127.0.0.1:17493'), true);
  assert.equal(isApprovedLoopbackUrl('http://localhost:17493'), true);
  assert.equal(isApprovedLoopbackUrl('http://[::1]:17493'), true);
  assert.equal(isApprovedLoopbackUrl('http://example.com'), false);
  assert.equal(isApprovedLoopbackUrl('http://10.0.0.5:17493'), false);
  assert.equal(isApprovedLoopbackUrl('not a url'), false);
});

test('disabled by default; enabled only on the literal "true"', () => {
  assert.equal(resolveVoiceConfig({}).enabled, false);
  assert.equal(resolveVoiceConfig({ enabled: 'false' }).enabled, false);
  assert.equal(resolveVoiceConfig({ enabled: 'true' }).enabled, true);
});

test('falls back to default loopback in dev when URL is unapproved', () => {
  const cfg = resolveVoiceConfig({ baseUrl: 'http://evil.example.com' });
  assert.equal(cfg.baseUrl, 'http://127.0.0.1:17493');
});

test('fail-closed: throws on an unapproved URL in strict/production mode', () => {
  assert.throws(
    () => resolveVoiceConfig({ baseUrl: 'http://evil.example.com', strict: true }),
    /Refusing non-loopback Voicebox URL/,
  );
});

test('trims trailing slashes and passes through profile pinning', () => {
  const cfg = resolveVoiceConfig({
    baseUrl: 'http://localhost:17493/',
    profileId: 'nehemiah-v1',
    profileVersion: 'sha-abc',
  });
  assert.equal(cfg.baseUrl, 'http://localhost:17493');
  assert.equal(cfg.profileId, 'nehemiah-v1');
  assert.equal(cfg.profileVersion, 'sha-abc');
});

test('exposes the default locale', () => {
  assert.equal(DEFAULT_LOCALE, 'en-US');
});
