import type { IntegrationSignal, IntegrationSignalInput } from './data-boundaries';

export type CalendarEventInput = {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  location?: string;
  description?: string;
};

export type GmailMessageInput = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  receivedAt: string;
  snippet: string;
  labels: string[];
};

export type FounderAgendaItem = {
  id: string;
  kind: 'commitment' | 'decision-request' | 'communication';
  source: 'google-calendar' | 'gmail';
  title: string;
  summary: string;
  occurredAt: string;
  urgency: 'high' | 'normal';
  externalId: string;
};

export type FounderAgenda = {
  generatedAt: string;
  decisionRequests: number;
  commitments: number;
  communications: number;
  items: FounderAgendaItem[];
};

function assertTimestamp(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid ISO timestamp.`);
}

export function normalizeCalendarSignal(event: CalendarEventInput): IntegrationSignalInput {
  if (!event.id.trim() || !event.title.trim()) throw new Error('Calendar event id and title are required.');
  assertTimestamp(event.start, 'Calendar start');
  assertTimestamp(event.end, 'Calendar end');
  return {
    externalId: event.id,
    type: 'calendar.commitment',
    occurredAt: event.start,
    summary: `${event.title} · ${event.status}`,
    payload: {
      title: event.title,
      end: event.end,
      attendees: [...event.attendees],
      status: event.status,
      location: event.location,
      description: event.description,
    },
  };
}

function isDecisionRequest(message: GmailMessageInput): boolean {
  const text = `${message.subject} ${message.snippet}`.toLowerCase();
  return /(approval|approve|decision required|decision needed|authorize|sign[- ]?off|unblock)/.test(text);
}

export function normalizeGmailSignal(message: GmailMessageInput): IntegrationSignalInput {
  if (!message.id.trim() || !message.threadId.trim() || !message.subject.trim() || !message.from.trim()) {
    throw new Error('Gmail message id, thread, subject, and sender are required.');
  }
  assertTimestamp(message.receivedAt, 'Gmail receivedAt');
  const decisionRequest = isDecisionRequest(message);
  return {
    externalId: message.id,
    type: decisionRequest ? 'gmail.decision-request' : 'gmail.communication',
    occurredAt: message.receivedAt,
    summary: `${message.subject} · from ${message.from}`,
    payload: {
      threadId: message.threadId,
      subject: message.subject,
      from: message.from,
      snippet: message.snippet.slice(0, 500),
      labels: [...message.labels],
    },
  };
}

function agendaItem(signal: IntegrationSignal): FounderAgendaItem | null {
  if (signal.type === 'calendar.commitment') {
    return {
      id: `${signal.integrationId}:${signal.externalId}`,
      kind: 'commitment',
      source: 'google-calendar',
      title: String(signal.payload?.title ?? signal.summary),
      summary: signal.summary,
      occurredAt: signal.occurredAt,
      urgency: 'normal',
      externalId: signal.externalId,
    };
  }
  if (signal.type === 'gmail.decision-request' || signal.type === 'gmail.communication') {
    return {
      id: `${signal.integrationId}:${signal.externalId}`,
      kind: signal.type === 'gmail.decision-request' ? 'decision-request' : 'communication',
      source: 'gmail',
      title: String(signal.payload?.subject ?? signal.summary),
      summary: signal.summary,
      occurredAt: signal.occurredAt,
      urgency: signal.type === 'gmail.decision-request' ? 'high' : 'normal',
      externalId: signal.externalId,
    };
  }
  return null;
}

export function buildFounderAgenda(signals: IntegrationSignal[], now = new Date()): FounderAgenda {
  const items = signals
    .map(agendaItem)
    .filter((item): item is FounderAgendaItem => Boolean(item))
    .sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency === 'high' ? -1 : 1;
      return Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
    });
  return {
    generatedAt: now.toISOString(),
    decisionRequests: items.filter((item) => item.kind === 'decision-request').length,
    commitments: items.filter((item) => item.kind === 'commitment').length,
    communications: items.filter((item) => item.kind === 'communication').length,
    items,
  };
}
