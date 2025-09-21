## Core Forms Knowledgebase: Game Plan

### Objective
- Build a concise, reliable, code-grounded knowledgebase for Core Forms backend.
- Optimize for both humans and AI to understand components and their interactions for troubleshooting.
- Capture truth from code and observable signals; avoid speculation and conclusions.

### Guiding principles
- Document truth, not conclusions or hypotheses.
- Cite code and observable signals (logs, configs, database schemas) whenever possible.
- Use consistent structure and stable identifiers to aid search and cross-reference.
- Prefer short, factual statements over narrative; minimal commentary about importance.
- Note imperfections explicitly; this is a guide, not a manual.

### Scope and numbering
- 30000–33999: Core Forms Backend (BE) components and cross-cutting concerns.
- Current docs in this series (to be expanded):
  - `31000-forms-core-be-ingress.md`: How submission data enters the system (APIs, embeds, imports).
  - `31000-forms-core-be-submit-actions.md`: Post-submission actions/integrations.
  - `32000-forms-core-be-emails.md`: Email behaviors and constraints.
  - `33000-forms-core-be-forms-authentication.md`: Authentication mechanisms related to Core Forms.
  - `33000-forms-core-be-logging.md`: Logging practices and common queries.

Suggested future coverage (create as needed under 31xxx/32xxx/33xxx):
- Storage and persistence (submissions, submissionData, files, audits)
- Validation and field processing
- Payments and PCI boundaries
- Files and attachments handling
- Queues, retries, idempotency, deduplication
- Rate limiting and throttling
- Security/permissions/FSID interactions
- External services (webhooks, APIs) and timeouts

### Standard document outline (template)
Copy this into new docs and fill only with facts and citations.

```markdown
# <Title>
- Doc ID: <31xxx/32xxx/33xxx>
- Area: backend/core/forms
- Related docs: <IDs or filenames>
- Last verified: YYYY-MM-DD

## Purpose in system
- One or two factual sentences describing responsibility.

## Entry points (runtime)
- APIs, jobs, event/queue consumers, triggers.

## Data models used
- Tables/entities and key fields (e.g., Submission, SubmissionData, Files). Link to schemas if available.

## Configuration
- Environment variables, feature flags, per-form settings, limits.

## Execution flow (happy path)
- Ordered bullets of the main path. Keep to observed behavior.

## Failure conditions observed
- Known failure modes with signals (status codes, exceptions) without attributing cause.

## Logging and metrics signals
- Log message patterns, fields to filter (formId, submissionId, submitActionId), log levels.

## Dependencies and touchpoints
- Internal modules/services this depends on and what is read/written.

## Security/permissions
- AuthZ/AuthN expectations relevant to this component.

## External integrations
- Services called, protocols, timeouts, retries (as seen in code/config).

## Source references
- path:line-range — short description of what is implemented (repeatable list).

## Troubleshooting context
- Where to look: logs/queries, configs, related components.

## See also
- Related documents and indices.
```

### Evidence to capture in each doc
- File paths, classes, functions, and endpoints.
- Config keys (env vars, feature flags) and defaults.
- Log message substrings/fields and typical filters.
- Database tables and important columns/relations.
- Queues/topics, retry/backoff behavior as implemented.

### Cross-component relationships
- Record touchpoints, not conclusions. Example phrasing:
  - "SubmitAction X reads field configuration Y during payload construction."
  - "Email Notification references submission data fields A, B; attachment handling depends on file storage config."
- Link to related docs by ID/filename under "See also".

### Maintenance workflow
- Create/extend docs only with verifiable facts from code, configs, or logs.
- Add "Source references" with paths and (when helpful) line ranges.
- Update "Last verified" when content is checked against current code.
- When behavior changes, update all affected docs and their cross-links.

### Near-term actions
- Fill out the outline sections in existing docs:
  - `31000-forms-core-be-ingress.md`
  - `31000-forms-core-be-submit-actions.md`
  - `32000-forms-core-be-emails.md`
  - `33000-forms-core-be-forms-authentication.md`
  - `33000-forms-core-be-logging.md`
- Add missing topics called out above as separate 31xxx/32xxx/33xxx files when needed.


