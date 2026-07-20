# Google Workspace Integration Deployment

## Architecture

A trusted integration bridge receives authorized Google Workspace changes, maps them to Nehemiah's bounded schemas, and sends them to the dedicated ingestion routes using its own rotating integration key.

## Required integration identities

Configure both identities in `NEHEMIAH_INTEGRATION_KEYS`:

- `google-calendar`
- `gmail`

Each request must include:

- `x-nehemiah-integration-id`
- `x-nehemiah-integration-key`

## Calendar payload

```json
{
  "id": "provider-event-id",
  "title": "Platform pilot decision",
  "start": "2026-07-21T15:00:00.000Z",
  "end": "2026-07-21T15:30:00.000Z",
  "attendees": ["founder@example.com"],
  "status": "confirmed",
  "location": "Google Meet"
}
```

Send to `POST /api/integrations/google-calendar`.

## Gmail payload

```json
{
  "id": "provider-message-id",
  "threadId": "provider-thread-id",
  "subject": "Approval needed: pilot boundary",
  "from": "product@example.com",
  "receivedAt": "2026-07-21T12:00:00.000Z",
  "snippet": "Please approve the restricted pilot boundary.",
  "labels": ["INBOX", "IMPORTANT"]
}
```

Send to `POST /api/integrations/gmail`.

## Required provider work before live use

- Create the Google Cloud project and OAuth consent configuration.
- Grant least-privilege Calendar and Gmail read scopes.
- Secure refresh tokens in server-only encrypted storage.
- Configure Calendar push notifications or scheduled synchronization.
- Configure Gmail history synchronization or approved polling.
- Verify webhook authenticity and deduplicate provider retries.
- Rotate integration keys and test revocation.
- Confirm that message bodies and attachments are excluded unless a later governed requirement explicitly authorizes them.

Nehemiah does not perform those provider-console actions automatically in v0.19.0.
