## Forms Core BE — Submit Actions (Integrations/Webhooks)

- Doc ID: 31200
- Area: backend/core/forms
- Scope: post-submit processing configured per form

### What they are
- Submit Actions (aka integrations/webhooks) run after a submission is received. They are distinct from plugins (which influence form behavior/collection).
- Actions can be blocking (run inline) or queued (asynchronous). Some actions handle uploaded files explicitly.

### Where they run in the flow
- Initial run uses request-time values (off the wire) during submit.
- Queued actions run asynchronously after initial processing.
- Re-run uses stored values (at-rest) and may differ in formatting from the initial run.

### Types (examples)
- Webhooks/HTTP callbacks
- CRM/marketing integrations
- File upload processors (run before other actions when files are present)
- Payment processors (card/token-based)

### Blocking vs queued
- Blocking: executed inline during submit; can impact user-facing result (redirects, messages). Failures can abort submit or trigger cleanup paths.
- Queued: scheduled for background execution; downstream systems receive data after submit completion.
- File-related actions: upload actions run first so subsequent actions can reference file URLs.

### Conditional logic
- Each action may have run conditions evaluated against submitted values. If conditions do not match, the action is skipped without error.

### Re-run behavior
- Data source: re-run uses `submissionData` (at-rest). If field configuration changed since initial submit, values may serialize differently for the integration.
- Files: re-run actions that depend on transient upload context may lack temporary file metadata; ensure actions are resilient to re-run without transient state.
- Payments: see payment-specific notes below; re-running may not re-charge and often performs idempotent checks.

### Payments
- Payment submit actions can be treated as blocking to produce redirects/confirmations. On error, payment status and messaging are surfaced; cleanup avoids double-charging.

### Error handling and deletion impacts
- If a blocking action (or earlier step) raises an exception, the system may delete the just-created submission as cleanup before bubbling the error (see ingress doc). Some action-specific exceptions are exempt from this deletion path.
- Queued actions log failures and may retry depending on job configuration.

### Logging and observability (facts)
- Action run (bulk re-run logging and typical worker runs): message "SubmitAction {type} run for {submissionId}" with context including `submitActionId`, `formId`, `accountId`, `submissionId`, `type`.
- Submit-stage errors: message "Exception thrown while trying to run integrations" with context `formId`, `formVersion`, `submissionId`, `exceptionMessage`, `error`.

### Sumo queries (runnable)
- Actions executed by form in time window
```
_sourceCategory=formstack/prod/*
 "SubmitAction {type} run for {submissionId}"
| json auto
| where context.formId = "_FORM_ID_"
| count by context.type
```

- Action runs for a specific submission
```
_sourceCategory=formstack/prod/*
 "SubmitAction {type} run for {submissionId}"
| json auto
| where context.submissionId = "_SUBMISSION_ID_"
```

- Action run by submitActionId
```
_sourceCategory=formstack/prod/*
 "SubmitAction {type} run for {submissionId}"
| json auto
| where context.submitActionId = "_SUBMIT_ACTION_ID_"
```

- Blocking-stage failures (submit stage)
```
_sourceCategory=formstack/prod/*
 "Exception thrown while trying to run integrations"
| json auto
| where context.formId = "_FORM_ID_" and context.submissionId = "_SUBMISSION_ID_"
```

Additional examples (preferred formatting)
- Find action runs for a form (count by type)
```
_sourceCategory=formstack/prod/*
 "SubmitAction {type} run for {submissionId}"
| json auto
| where context.formId = "_FORM_ID_"
| count by context.type
```

- Find action runs by submitActionId
```
_sourceCategory=formstack/prod/*
 "SubmitAction {type} run for {submissionId}"
| json auto
| where context.submitActionId = "_SUBMIT_ACTION_ID_"
```

- Find action runs that reference a specific fieldId (Webhook debug logs)
```
_sourceCategory=formstack/prod/*
 "Processing field for data preparation"
| json auto
| where context.submitActionId = "_SUBMIT_ACTION_ID_" and context.fieldId = "_FIELD_ID_"
```

Note: using `_sourceCategory=formstack/prod/*` captures both inline and worker logs; narrower scopes like `_sourceCategory="formstack/prod/worker/*"` may show only a subset.

### Operational notes
- Storage setting: when forms are configured not to store submissions, actions can still run with `submissionId=0`; ensure downstream systems do not require a stored id.
- Field changes: integration mappings relying on option labels/values should consider drift (value vs label vs value | label) between initial run and re-run.
- File availability: ensure actions re-fetch files by persisted URLs rather than relying on ephemeral upload handles.



### Submit action types grouped by execution behavior (from code)
- Blocking (cannot queue)
  - default
  - message
  - display_image
  - redirect
  - paypal
  - paypalpro
  - payflowpro
  - authorizenet
  - firstdata
  - chargify
  - stripe
  - beanstream
  - testpayment
- Non-blocking (can queue)
  - webhook
  - salesforce
  - emailcenterpro
  - highrise
  - batchbook
  - hubspot
  - pardot
  - helpspot
  - zendesk
  - desk
  - slack
  - twitter
  - aweber
  - campaignmonitor
  - constantcontact
  - emma
  - exacttarget
  - icontact
  - mailchimp
  - pardothandler
  - freshbooks
  - googlecalendar
  - googlespreadsheets
  - googlecontacts
  - smartsheet
  - webmerge
- Conditionally-blocking (upload-focused; run first; queuing depends on implementation)
  - boxnet
  - dropbox
  - googledrive
  - amazons3customer
  - onedrive
