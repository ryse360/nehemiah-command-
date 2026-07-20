# Drive and Obsidian Knowledge Integration

## Purpose

Connect approved Google Drive documents and Obsidian notes to Nehemiah as governed source records. These integrations append or update source material; they do not write Founder memory, approve decisions, or execute actions.

## Integration identities

Configure rotating keys in `NEHEMIAH_INTEGRATION_KEYS` for:

- `google-drive`
- `obsidian`

Every request must include `x-nehemiah-integration-id` and `x-nehemiah-integration-key`.

## Google Drive contract

Send bounded extracted text and metadata to `POST /api/integrations/google-drive`. Required fields are provider ID, name, MIME type, modified time, HTTPS Drive link, owners, extracted text, and visibility (`enterprise` or `founder-private`). Content is capped at 4,000 characters per synchronized record.

## Obsidian contract

Send a vault-relative path, note title, modified time, bounded Markdown content, tags, visibility, and optional content hash to `POST /api/integrations/obsidian`. Absolute paths and traversal segments are rejected.

## Founder retrieval

Authenticated Founder sessions may call:

- `GET /api/founder-knowledge` for the current source index
- `GET /api/founder-knowledge?q=<query>` for ranked retrieval with citations

The Founder interface exposes the same retrieval through the Knowledge panel.

## Controlled synchronization

- Records are keyed by Founder, source type, and external ID.
- A newer modified timestamp may replace the current synchronized copy.
- An older provider payload cannot overwrite a newer source record.
- Every synchronization creates a redacted security audit event.
- Search results include source type, reference, modified time, visibility, and a grounded citation.

## Production connection boundary

Live Drive synchronization requires Google OAuth, least-privilege Drive scopes, secure refresh-token storage, provider change tracking, and webhook or scheduled synchronization. Obsidian synchronization requires an approved local plugin or bridge that hashes notes, limits configured vault paths, and sends only explicitly authorized content.
