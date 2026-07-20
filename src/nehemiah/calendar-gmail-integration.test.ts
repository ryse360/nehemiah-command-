import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFounderAgenda,
  normalizeCalendarSignal,
  normalizeGmailSignal,
  type CalendarEventInput,
  type GmailMessageInput,
} from './calendar-gmail-integration';

test('normalizes a calendar event into a governed integration signal', () => {
  const event: CalendarEventInput = {
    id: 'evt-1',
    title: 'Platform pilot decision',
    start: '2026-07-21T15:00:00.000Z',
    end: '2026-07-21T15:30:00.000Z',
    attendees: ['founder@mip.example', 'product@mip.example'],
    status: 'confirmed',
  };

  const signal = normalizeCalendarSignal(event);
  assert.equal(signal.externalId, 'evt-1');
  assert.equal(signal.type, 'calendar.commitment');
  assert.equal(signal.occurredAt, event.start);
  assert.match(signal.summary, /Platform pilot decision/);
  assert.deepEqual(signal.payload?.attendees, event.attendees);
});

test('normalizes a Gmail message without storing message body content', () => {
  const message: GmailMessageInput = {
    id: 'msg-1',
    threadId: 'thread-1',
    subject: 'Approval needed: pilot boundary',
    from: 'product@mip.example',
    receivedAt: '2026-07-21T12:00:00.000Z',
    snippet: 'Please approve the restricted pilot boundary before noon.',
    labels: ['INBOX', 'IMPORTANT'],
  };

  const signal = normalizeGmailSignal(message);
  assert.equal(signal.type, 'gmail.decision-request');
  assert.equal(signal.externalId, 'msg-1');
  assert.equal(signal.payload?.threadId, 'thread-1');
  assert.equal('body' in (signal.payload ?? {}), false);
});

test('builds a Founder agenda ordered by urgency and time', () => {
  const signals = [
    { ...normalizeCalendarSignal({ id: 'evt-2', title: 'Weekly review', start: '2026-07-22T16:00:00.000Z', end: '2026-07-22T17:00:00.000Z', attendees: [], status: 'confirmed' }), integrationId: 'google-calendar', receivedAt: '2026-07-21T10:00:00.000Z' },
    { ...normalizeGmailSignal({ id: 'msg-2', threadId: 'thread-2', subject: 'Urgent decision required', from: 'ops@mip.example', receivedAt: '2026-07-21T11:00:00.000Z', snippet: 'Decision required today to unblock launch.', labels: ['IMPORTANT'] }), integrationId: 'gmail', receivedAt: '2026-07-21T11:01:00.000Z' },
  ];

  const agenda = buildFounderAgenda(signals, new Date('2026-07-21T09:00:00.000Z'));
  assert.equal(agenda.items[0]?.kind, 'decision-request');
  assert.equal(agenda.decisionRequests, 1);
  assert.equal(agenda.commitments, 1);
});
