## Forms Core BE — Ingress

- Doc ID: 31000
- Area: backend/core/forms
- Related docs: `31000-forms-core-be-submit-actions.md`, `32000-forms-core-be-emails.md`, `33000-forms-core-be-forms-authentication.md`, `33000-forms-core-be-logging.md`
- Last verified: 2025-08-13

## Purpose in system
- Receive submission data via supported entry points and create the associated submission records.

## Observed data relationships
```
Form                -> Submission (metadata)
Field (of Form)     -> SubmissionData (customer-submitted data)
```
- "Submission" may be used to mean the overall collection of data for a form submission or specifically the metadata record, depending on context.

## Entry points (runtime/Submission creation)
 
- API 2025
  - Source of truth: API 2025 reference.
  - Path: `POST /forms/{formId}/submissions`.
  - Purpose: programmatic creation of submissions for a specific form.
  - Inputs: form-scoped field values, optional metadata (timestamp, user agent, IP, read flag, geo, device id).
  - Outputs: created submission details and identifiers.
  - Encryption: when enabled for a form, submitted field values are stored encrypted at-rest. Decryption requires the private key/passphrase. See `31000-forms-core-be-data-at-rest.md`.

- API v2 (legacy)
  - Source of truth: API v2 reference. Creation occurs via form submission endpoints rather than a standalone submissions create endpoint.
  - Purpose: legacy programmatic submission for classic clients.
  - Inputs/outputs: similar to API 2025 but may vary in field naming and optional parameters.

- Standard Live Form submission
  - Path: public submit endpoint used by the hosted live form.
  - Behavior: validates input, creates a submission (when storage is enabled and limits allow), saves field data and any uploaded files, then triggers downstream processing.
  - Dedup/guard: anti-duplicate guards (nonce/checksum) may be present; these can be used for tracing in logs during troubleshooting. These are best effort and will not prevent duplicates occurring days apart.

- Embed form submissions
  - Types: lightbox, JavaScript, iframe.
  - Backend handling: submits to the same live form endpoint; backend processing is equivalent to Standard Live Form.
  - Considerations: frontend delivery differs by embed type (layout, cross-origin, script loading). Customers should choose based on their site constraints; backend behavior remains the same.

  - CSP considerations: depending on a site's Content Security Policy, embeds may require allowing specific script, frame, and connect sources. In general:
    - JavaScript embed: allow script execution and network calls to Formstack endpoints.
    - Iframe embed: allow framing of the Formstack origin and configure frame-ancestors appropriately.
    - Lightbox: requires JavaScript to open the overlay; otherwise backend handling is unchanged.

- Submission Import (from the submissions table UI)
  - Path: import wizard in the UI for uploading a CSV and mapping columns to form fields.
  - Field mapping: unmapped columns are ignored; mapped columns populate corresponding fields. Composite fields (e.g., name/address) require mapping of sub-parts.
  - Missing/extra fields: missing mapped fields result in empty values for those fields; extra unmapped columns are ignored.
  - Submit actions: can be optionally executed per imported submission based on selection during import. File-dependent actions do not apply (CSV has no file content).
  - Validation/limits: standard form limits (e.g., max submissions, storage disabled) affect whether new submissions are stored.

## Data models used
- Form, Submission, SubmissionData
  - Submission metadata (non-field data):
    - form id
    - timestamp (client-provided or server time)
    - user agent (when provided)
    - remote IP address
    - read status
    - geo (latitude/longitude) when provided and valid
    - device identifier (when provided)
    - unique key/dedup token (live form)
  - SubmissionData (field values): stored per field; can be stored encrypted at-rest when encryption is enabled for the form. See `31000-forms-core-be-data-at-rest.md`.

## Configuration
 - Account/form limits (e.g., max submissions) can prevent storage even if a submit is received.


## Execution flow (high-level)
- Receive data
  - API (2025/v2): request body fields and optional metadata.
  - Live form / Embed: browser POST of rendered form fields and files.
  - Import: CSV rows mapped to fields via UI.
- Transmit data (downstream)
  - Initial run: submit actions execute using request-time values (off the wire). See `31000-forms-core-be-submit-actions.md`.
  - Re-run: submit actions use stored values (at-rest), which may be formatted differently.
  - Emails/notifications may be enqueued (see `32000-forms-core-be-emails.md`).
- Store data
  - Create submission metadata (form id, timestamp, user agent, IP, read, optional geo/device, dedup token).
  - Store field values as submission data; apply encryption at-rest when configured.
  - Persist files (live form only) and associate file URLs to corresponding fields.

VERY IMPORTANT
- First run of submit actions uses the data received "off the wire" (request-time processed values).
- Re-run of submit actions uses the data "at-rest" (persisted submission data). Formatting and representation may differ between first-run and re-run, which can affect integrations that are sensitive to formatting.


## Failure and troubleshooting
- Storage disabled or limits exceeded
  - Symptom: submit appears successful to client but no new submission stored.
  - Where to look: Sumo logs filtered by `formId` and timeframe; absence of a stored `submissionId` event.
  - What to check: form setting to save submissions; account/form submission limits.
- Encryption configuration issues
  - Symptom: errors around secure fields or blocked operations when encryption is required.
  - Where to look: Sumo logs mentioning encryption; confirm encryption settings on the form. See `31000-forms-core-be-data-at-rest.md`.
- Live form file uploads
  - Symptom: missing attachments or size limit errors.
  - Where to look: Sumo logs for file upload handling and per-field file status; verify account storage quota.
- Import mapping problems
  - Symptom: columns not imported, data misaligned, or import aborted.
  - Where to look: import preview/mapping results and Sumo logs mentioning CSV validation or unmapped columns.
- Submit action discrepancies (first-run vs re-run)
  - Symptom: integration success on first-run but failure on re-run (or vice versa).
  - Where to look: compare values received at submit time vs stored values at-rest; review integration-side validation/format expectations.


## Logging and metrics signals
- Logging is sent to Sumo Logic. See `33000-forms-core-be-logging.md`.
- Useful filters include date range, `formId`, `submissionId`, and submit-action-specific identifiers (when applicable downstream).
- Retention: 90 days.
- Log levels may vary; some errors may appear as WARN. No DEBUG in production.
 - Metrics sources: label submissions by source such as `web` (live form), `apiv2`, `apiv2025` to distinguish ingress path.
 - For imports: search for import-related logs around the import time window and correlate with any chosen integrations.

### Example log messages (redacted)
- Submission created
```json
{
  "message": "Submission created on {formId}.",
  "context": {
    "submissionId": {submissionId},
    "isPartialSubmission": false,
    "submissionMethod": "{submissionMethod}",
    "formId": "{formId}",
    "accountId": "{accountId}",
    "submissionNonce": {submissionNonce},
    "submissionChecksum": "{submissionChecksum}",
    "event": "submission_created",
    "sessionId": "{sessionId}",
    "errorId": "{errorId}"
  },
  "level": 200,
  "level_name": "INFO",
  "channel": "formstackAppLog",
  "datetime": "{isoTimestamp}",
  "extra": {
    "hostname": "{hostname}",
    "uid": "{uid}",
    "url": "{url}",
    "ip": "{ip}",
    "http_method": "{httpMethod}",
    "server": "{server}",
    "referrer": "{referrer}",
    "memory_usage": "{memoryUsage}"
  }
}
```

- Submit action run
```json
{
  "message": "SubmitAction {type} run for {submissionId}",
  "context": {
    "accountId": "{accountId}",
    "submitActionId": "{submitActionId}",
    "formId": "{formId}",
    "submissionId": "{submissionId}",
    "type": "{type}",
    "event": "submitaction_run"
  },
  "level_name": "INFO",
  "channel": "formstackAppLog",
  "datetime": "{isoTimestamp}"
}
```

- Import success (per row)
```json
{
  "message": "Submission import successful for {submissionId}",
  "context": {
    "formId": "{formId}",
    "formVersion": "{formVersion}",
    "submissionId": "{submissionId}",
    "event": "submission_imported"
  },
  "level_name": "INFO",
  "channel": "formstackAppLog",
  "datetime": "{isoTimestamp}"
}
```

- Submit processing error during integrations
```json
{
  "message": "Exception thrown while trying to run integrations",
  "context": {
    "accountId": "{accountId}",
    "formId": "{formId}",
    "formVersion": "{formVersion}",
    "submissionId": "{submissionId}",
    "exceptionMessage": "{exceptionMessage}",
    "runtime": {runtimeSeconds},
    "error": "{lastError}"
  },
  "level_name": "INFO",
  "channel": "formstackAppLog",
  "datetime": "{isoTimestamp}"
}
```

- Commit failure after integrations
```json
{
  "message": "Failed to commit Submission after running non-queued integrations",
  "context": {
    "formId": "{formId}",
    "formVersion": "{formVersion}",
    "submissionId": "{submissionId}",
    "error": "{lastError}",
    "runtime": {runtimeSeconds}
  },
  "level_name": "ERROR",
  "channel": "formstackAppLog",
  "datetime": "{isoTimestamp}"
}
```

- Deletion log (when a submission is deleted)
```json
{
  "message": "Submission {submissionId} deleted",
  "context": {
    "formId": "{formId}",
    "submissionId": "{submissionId}",
    "deletionType": "{hardOrSoft}",
    "event": "submission_deleted"
  },
  "level_name": "INFO",
  "channel": "formstackAppLog",
  "datetime": "{isoTimestamp}"
}
```

Non-technical context for logging
- Not a ledger: logs are diagnostic signals, not a canonical record. Multiple lines can exist for one submission; absence of a line is not definitive.
- Sources: creation logs typically appear under web app logs; submit actions usually under worker logs; imports under worker logs.
- Timing: order can vary under load; use `context.submissionId`, `context.formId`, timestamps, and where available `submissionNonce`/`submissionChecksum` to correlate.
- Privacy: values may be redacted or minimized; do not expect full payloads.

- Submit action run
```json
{
  "message": "SubmitAction {type} run for {submissionId}",
  "context": {
    "accountId": "{accountId}",
    "submitActionId": "{submitActionId}",
    "formId": "{formId}",
    "submissionId": "{submissionId}",
    "type": "{type}",
    "event": "submitaction_run",
    "sessionId": "{sessionId}",
    "errorId": "{errorId}"
  },
  "level": 200,
  "level_name": "INFO",
  "channel": "formstackAppLog",
  "datetime": "{isoTimestamp}"
}
```

## Sumo queries (examples)
- All submissions created via API 2025 in a time window
  - `_sourceCategory="formstack/prod/web/*" and level_name=INFO and http_method=POST and url matches "/forms/.*/submissions"`
  - With breakdown by form: `| json auto | parse regex field=url "/forms/(?<formId>\\\\d+)/submissions" | count by formId`
- Specific submission lifecycle (any source)
  - `_sourceCategory=("formstack/prod/web/*" or "formstack/prod/worker/*") | json auto | where context.submissionId = "{submissionId}"`
  - Fallback (string match): `_sourceCategory=("formstack/prod/web/*" or "formstack/prod/worker/*") and ("submissionId": "{submissionId}" or "Submission {submissionId}")`
- Distinguish live form vs API
  - Live/Embed (web submits): `_sourceCategory="formstack/prod/web/formstack-app/log" and level_name=INFO | json auto | where context.event = "submission_created"`
  - API 2025: `_sourceCategory="formstack/prod/web/*" and http_method=POST and url matches "/forms/.*/submissions"`
  - Heuristic to infer embed vs hosted: filter on `extra.referrer` where the domain is not a Formstack domain to infer embed; hosted forms typically have a Formstack domain in `server` or `referrer`.
- Imported submissions
  - `_sourceCategory="formstack/prod/worker/*" and level_name=INFO and "submission_imported" and formId={formId}`
- Deletions
  - `_sourceCategory=("formstack/prod/web/*" or "formstack/prod/worker/*") and level_name=INFO and ("Submission deleted" or deletionType=hard)`
  - By id: add `| json auto | where context.submissionId = "{submissionId}"`

### Counting examples
- Number of submit actions that ran for a given form in a range
  - `_sourceCategory="formstack/prod/worker/*" and level_name=INFO and event="submitaction_run" | json auto | where context.formId = "{formId}" | count by context.type`
- Number of submissions for a given form in a range
  - `_sourceCategory="formstack/prod/web/formstack-app/log" and level_name=INFO | json auto | where context.event = "submission_created" and context.formId = "{formId}" | count`

## Dependencies and touchpoints
- Downstream components include Submit Actions (`31000-forms-core-be-submit-actions.md`) and Emails (`32000-forms-core-be-emails.md`).
- Files/attachments use S3 uploads in both API and live form flows.
- Cache is used to set short-lived keys for de-duplication/guard checks in live form submissions.

## Security/permissions
- Authentication topics relevant to forms and FSID/SSO are tracked in `33000-forms-core-be-forms-authentication.md`.

## External integrations
- Ingress itself does not call external systems directly; external calls are performed by submit actions post-ingress.

## Search indexing (OpenSearch)
- Relationship to stored data: submissions may be indexed for search/reporting; indexing generally occurs after storage events.
- Not a source of truth: indexing is eventually consistent. Recent submissions/edits may not appear immediately; deleted submissions may briefly appear until indices refresh.
- Troubleshooting: when search results and stored data differ, compare Sumo logs (ingress + submit actions) and check index update schedules.

## Troubleshooting context
- Use Sumo Logic queries to trace ingress requests by `formId` and time range. See `33000-forms-core-be-logging.md` for patterns and tips.
- For live form issues, filter metrics/logs where source is `web`, and include `nonce` or checksum values when available.
- For API v2025, filter by `POST /forms/{formId}/submissions` and source `apiv2025`.
- For imports, search for `submission_imported` and correlate with the import job time; verify temporary S3 import path exists.
 - For imports, search for `submission_imported` and correlate with the import job time.

## See also
- `31000-forms-core-be-submit-actions.md`
- `32000-forms-core-be-emails.md`
- `33000-forms-core-be-forms-authentication.md`
- `33000-forms-core-be-logging.md`

## API 2025 operations (Submissions)
- Create
  - Endpoint: `POST /forms/{formId}/submissions` (see API 2025 reference)
  - Writes: creates a submission for the specified form and stores field values as submission data
  - Notes: supports optional metadata (timestamp, user agent, IP, read flag, geo, device id). Field data may be stored encrypted at-rest when enabled.
- Get details
  - Endpoint: `GET /submissions/{submissionId}`
  - Reads: returns submission metadata and, where permitted, associated field data; separate endpoint retrieves specific file uploads
- Edit
  - Endpoint: `PUT /submissions/{submissionId}`
  - Writes: updates submission field values and permitted metadata; field-level rules/validation apply
- Delete
  - Endpoint: `DELETE /submissions/{submissionId}`
  - Effect: deletes the submission; associated field data and related artifacts (e.g., approvals, comments, integration logs, file uploads) are removed. This is irreversible.
- Retrieve upload file
  - Endpoint: `GET /submissions/{submissionId}/upload?fieldId=...&index=...`
  - Reads: returns the binary content of an uploaded file for a specific field and file index

## API v2 operations (legacy)
- Create
  - Creation is performed via the v2 form submission flow rather than a standalone submissions create endpoint; see API v2 reference
- Get details
  - Endpoint(s): submissions read endpoints in v2; returns metadata and, where permitted, field data
- Edit
  - Endpoint(s): submissions update endpoints in v2; updates field values and permitted metadata
- Delete
  - Endpoint(s): submissions delete endpoints in v2; removes the submission and associated artifacts

 
## Ingress non-storage and pre-storage deletions
- Reasons a submission may not persist on ingress:
  - Form/account configured to not store submissions.
  - Certain submit action types may be configured to prevent storage when they fail during initial processing.
- Consequences and identifiers:
  - A persistent `submissionId` may not be assigned; some logs will show `submissionId` as `0` or omit it entirely.
  - Data is not retrievable via UI or API post-request.
  - Submit actions may still execute based on request-time data; verify run logs to understand behavior.

## Deletion during creation (cleanup path)
- When it happens
  - During live form submit, after field processing and before/while running blocking integrations, if an exception occurs and storage is enabled, the system can delete the just-created submission as cleanup and then rethrow the error.
  - Notable exception: known Salesforce integration exception bypasses this deletion path.
- What gets removed
  - The submission row and associated submission data, plus related artifacts such as submit action logs, approvals, comments, and uploaded files are removed as part of deletion routines.
- Observability
  - You may see a “submission_created” log followed by error logs and deletion messages in the same timeframe.
  - After deletion, the `submissionId` will not be retrievable via UI or API.
- Why this exists
  - To avoid retaining incomplete/invalid data when critical submit processing fails prior to the “point of no return.”

### Sumo checks for deletion during creation
- Single submission trace
  - `_sourceCategory=("formstack/prod/web/*" or "formstack/prod/worker/*") | json auto | where context.submissionId = "{submissionId}"`
  - Add error context: `| where message matches "Exception thrown while trying to run integrations" or message matches "Failed to delete Submission due to exception" or message matches "Failed to commit after deleting Submission"`
- Window scan for likely deletes
  - `_sourceCategory=("formstack/prod/web/*" or "formstack/prod/worker/*") and level_name=ERROR and (message matches "Exception thrown while trying to run integrations" or message matches "Failed to delete Submission due to exception")`
- Distinguish non-storage paths (submissionId=0) for a form
  - `_sourceCategory=("formstack/prod/worker/*") | json auto | where context.formId = "{formId}" and context.submissionId = "0"`


