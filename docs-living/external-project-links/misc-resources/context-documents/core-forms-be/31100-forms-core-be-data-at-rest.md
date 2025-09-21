## Forms Core BE — Data at Rest (SubmissionData)

- Doc ID: 31100
- Area: backend/core/forms
- Focus: stored submission field values (`submissionData`)

### Scope and premise
- We store field values as `submissionData` items linked to a submission and field identifier; we do not store a row-shaped record per field set.
- Storage security follows industry practices; some forms also enable encryption-at-rest for `submissionData` values.

### Field formats (stored representation)
- Complex/advanced fields
  - Name, Address: stored as multiple sub-values under the same field, keyed by subfield (e.g., first/last; street/city/state/postal/country). Reconstitution depends on the field’s current definition at view time.
  - Example (Name):
    - value:
      first = John
      last = Smith
  - Example (Address):
    - value:
      street = 123 Main St
      city = Indianapolis
      state = IN
      postal = 46204
      country = US

- Multi-select inputs
  - Radio: single selected option stored as a single value.
  - Select (single): one selected option stored as a single value.
  - Select (multi) / Checkbox groups: multiple selections are stored as newline-separated entries. Depending on field settings, entries may be stored as:
    - value only (e.g., option_a)
    - label only (e.g., Option A)
    - value | label (e.g., option_a | Option A)
  - Server-side validation checks values against the configured options at submit time. If the field configuration changes later, previously stored values may no longer match the new options, but the stored `submissionData` remains unchanged.
  - Example (checkbox group, two selected, store both value and label):
    - value:
      option_a | Option A
      option_b | Option B
    - note:
      Field configuration drift can cause missing/hidden display values if the current options no longer match the format stored at submit time.

   

- Credit card fields
  - Stored as encrypted data at-rest. Raw PAN is not readable without valid decryption keys; CVV is not retained in sanitized views.
  - Encryption: the persisted value is an encrypted string derived from the field’s sub-parts (card number, expiration, cvv). When encryption-at-rest is enabled, storage uses the form’s encryption keys.
  - Viewing: secure field values can be viewed/exported only when the appropriate private key/passphrase is available in the viewing context; otherwise sanitized/masked representations are shown. Integrations may receive masked values when PCI compliance requires.

  - Temporary unsanitized view (code):
    - Retrieval/delete endpoint: `lib/Formstack/Controller/TemporaryUnsanitizedDataController.php` (GET/DELETE per submissionId/fieldId; logs view/delete events)
    - Storage/purge service: `lib/Formstack/Submission/TemporaryUnsanitizedData/TemporaryUnsanitizedDataService.php` (encrypts unsanitized value with customer encryptor; periodic purge)
    - Formatting/masking: `lib/Formstack/Submission/FieldData/CreditcardFieldData.php` (`toPersistanceString`, `sanitized()`, `toHumanReadableString`)
  - Distinction: form-level encryption applies to all `submissionData` when enabled; credit card fields additionally use sanitization and temporary-unsanitized storage specifically for secure handling of raw details.

### Encryption at rest
- When enabled on a form, `submissionData` values are stored encrypted. Decryption requires the customer’s private key/passphrase.
- Operational note: if the encryption key changes or is unavailable, secure fields may not be viewable or exportable until valid keys are provided.


 

### Mutability and deletion
- Changes
  - Field edits post-submit (via API or UI) update the stored `submissionData` for that field. Advanced fields (e.g., Name/Address) update relevant subfields; multi-select fields update the selected entries.
  - If a field’s type or options change after submission, previously stored values remain as-is. Re-display uses the current field definition and may differ. Example: a field was formerly Name (stored as subfields) but later changed to Short Answer; viewing historical submissions may show the raw subfield representation (e.g., "first = John\nlast = Smith").
- Deletions
  - Submission deletion removes associated `submissionData` and related artifacts (files, approvals, logs). See ingress doc for deletion scenarios.
  - Auto-delete policies may remove aged submissions (and their `submissionData`) per account/form settings.
  - Auto-delete: per-account/form retention settings can schedule removal of older submissions. Retention jobs soft-delete eligible submissions and may later hard-delete them as part of purge cycles.
  - Soft-delete vs hard-delete:
    - Soft-delete: marks a submission as deleted (flag with timestamp). UI/API may hide it; data remains in storage until purged.
    - Hard-delete: permanently removes the submission row, its `submissionData`, and related artifacts (files, approvals, logs). This is irreversible.

### Troubleshooting context
- Mismatches between stored values and current field definitions can lead to unexpected display formats (e.g., name saved earlier, field later changed to short answer).
- For encrypted fields, ensure proper keys are available for decryption in the viewing/exporting context.

### Field types — at-rest examples (non-exhaustive)
- Short Answer / Paragraph: value is the submitted text (multi-line for paragraph).
- Number / Email / URL / Phone: value is the submitted string in that format.
- Name: stored as subfields, e.g.,
  - first = John
  - last = Smith
- Address: stored as subfields, e.g.,
  - street = 123 Main St
  - city = Indianapolis
  - state = IN
  - postal = 46204
  - country = US
- Radio / Select (single): one entry; could be "value", "label", or "value | label" based on field settings.
- Checkbox group / Select (multi): newline-separated entries; each line follows the same value/label configuration as above.
- File / Signature: stored as a file location (URL) referencing the uploaded content.
- Credit Card: encrypted string at-rest; masked when presented without decryption keys.